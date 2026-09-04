import { fetchWithAuth } from "./utils/apiHelper.js";
import { formatDateToBR } from "./utils/dateUtils.js";
import { escapeHtml, formatCPF, formatBeneficiaryType } from "./utils/detailsView.js";
import { openRequestReanalysisModal } from "./managementModals/requestReanalysisModal.js";
import { openCloseNegotiationModal } from "./managementModals/closeNegotiationModal.js";

// guarda os dados completos de cada ficha reprovada, pra abrir o modal de reanálise sem precisar de uma nova requisição
const rejectedFormsById = new Map();

// guarda a lista completa carregada do backend; os filtros atuam sobre ela sem novo request
let allRejectedForms = [];

// é uma fila de decisão: a ficha reprovada há mais tempo aparece primeiro
let currentSort = { key: "date", dir: "asc" };

// colunas cujo primeiro clique já faz mais sentido em ordem decrescente
const DESC_FIRST_SORT_KEYS = new Set(["date"]);

// a partir de quantos dias parada na fila a ficha passa a ser destacada
const AGING_THRESHOLD_DAYS = 7;

// atalho de triagem selecionado. Todas as fichas desta tela têm o mesmo status
// (11. Reprovado pela Gerência), então os chips recortam por sinalização/atraso.
let triageFilter = "";

const TRIAGE_CHIPS = [
    { value: "", label: "Todos" },
    { value: "discount", label: "Com desconto" },
    { value: "portability", label: "Portabilidade" },
    { value: "aging", label: `Parado há +${AGING_THRESHOLD_DAYS} dias` },
];

// normaliza a data de inclusão (que vem como "Mon, 01 Jan 2001 00:00:00 GMT")
// para "YYYY-MM-DD" em UTC, mesmo formato do <input type="date">
function getFormDateISO(form) {
    if (!form.inclusion_date) return "";

    const date = new Date(form.inclusion_date);
    if (isNaN(date)) return "";

    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, "0");
    const day = String(date.getUTCDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
}

// há quantos dias a ficha está na fila. Os dois lados são reduzidos à meia-noite UTC para que
// a conta dê dias inteiros, sem depender da hora em que a tela foi aberta.
function getDaysWaiting(form) {
    const dateISO = getFormDateISO(form);
    if (!dateISO) return null;

    const now = new Date();
    const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
    const inclusion = Date.parse(`${dateISO}T00:00:00Z`);

    return Math.max(0, Math.round((today - inclusion) / 86400000));
}

// "hoje" / "há 1 dia" / "há 12 dias"
function formatAging(days) {
    if (days === null) return "";
    if (days === 0) return "hoje";
    if (days === 1) return "há 1 dia";
    return `há ${days} dias`;
}

// converte o discount_percentage (numeric(3,2): 0.15 no banco) para "15%"
function formatDiscount(value) {
    const percentage = Number(value);
    if (isNaN(percentage)) return "";
    return `${(percentage * 100).toFixed(0)}%`;
}

// preenche um <select> de filtro com os valores distintos presentes nos dados carregados
function fillFilterSelect(selectId, values) {
    const select = document.getElementById(selectId);
    const options = [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b, "pt-BR"));

    // mantém o valor selecionado ao recarregar a lista
    const previous = select.value;

    select.innerHTML = `<option value="">Todos</option>` +
        options.map(option => `<option value="${escapeHtml(option)}">${escapeHtml(option)}</option>`).join("");

    if (options.includes(previous)) select.value = previous;
}

function populateFilterOptions(forms) {
    fillFilterSelect("filterConsultant", forms.map(form => form.consultant_name));
    fillFilterSelect("filterInclusionType", forms.map(form => form.inclusion_type));
    fillFilterSelect("filterPlan", forms.map(form => form.plan_type));
}

// lê de uma vez os valores dos filtros, já normalizados para a comparação
function getActiveFilters() {
    return {
        search: document.getElementById("filterBeneficiary").value.trim().toLowerCase(),
        consultant: document.getElementById("filterConsultant").value,
        inclusionType: document.getElementById("filterInclusionType").value,
        plan: document.getElementById("filterPlan").value,
        dateFrom: document.getElementById("filterDateFrom").value, // "YYYY-MM-DD" ou ""
        dateTo: document.getElementById("filterDateTo").value,
        triage: triageFilter,
    };
}

function hasActiveFilters(filters) {
    return Boolean(
        filters.search || filters.consultant || filters.inclusionType ||
        filters.plan || filters.dateFrom || filters.dateTo || filters.triage
    );
}

function matchesTriage(form, triage) {
    if (triage === "discount") return Boolean(form.is_discount);
    if (triage === "portability") return Boolean(form.is_portability);
    if (triage === "aging") return getDaysWaiting(form) > AGING_THRESHOLD_DAYS;
    return true;
}

// aplica os filtros sobre allRejectedForms. `ignoreTriage` é usado para contar os chips:
// cada chip mostra quantas fichas daquele recorte sobram com os *demais* filtros.
function getFilteredForms(filters, { ignoreTriage = false } = {}) {
    return allRejectedForms.filter(form => {
        // a busca cobre nome, CPF (cru e mascarado) e o número da ficha
        const cpf = form.beneficiary_cpf || "";
        const haystack = `${form.beneficiary_name || ""} ${cpf} ${formatCPF(cpf)} ${form.id}`.toLowerCase();
        const matchesSearch = !filters.search || haystack.includes(filters.search);
        const matchesConsultant = !filters.consultant || form.consultant_name === filters.consultant;
        const matchesInclusionType = !filters.inclusionType || form.inclusion_type === filters.inclusionType;
        const matchesPlan = !filters.plan || form.plan_type === filters.plan;

        // período de inclusão: comparação lexicográfica funciona no formato "YYYY-MM-DD",
        // e os dois extremos entram no resultado
        const formDate = getFormDateISO(form);
        const matchesDateFrom = !filters.dateFrom || (formDate && formDate >= filters.dateFrom);
        const matchesDateTo = !filters.dateTo || (formDate && formDate <= filters.dateTo);

        const matchesTriageFilter = ignoreTriage || !filters.triage || matchesTriage(form, filters.triage);

        return matchesSearch && matchesConsultant && matchesInclusionType && matchesPlan
            && matchesDateFrom && matchesDateTo && matchesTriageFilter;
    });
}

// valor usado na comparação de cada coluna ordenável
function getSortValue(form, key) {
    if (key === "date") {
        const time = new Date(form.inclusion_date).getTime();
        return isNaN(time) ? 0 : time;
    }
    if (key === "type") return form.inclusion_type || "";
    if (key === "plan") return form.plan_type || "";
    if (key === "consultant") return form.consultant_name || "";
    return form.beneficiary_name || "";
}

// ordena uma cópia da lista para não mexer na ordem original de allRejectedForms
function sortForms(forms) {
    const { key, dir } = currentSort;
    const factor = dir === "desc" ? -1 : 1;

    return [...forms].sort((a, b) => {
        const valueA = getSortValue(a, key);
        const valueB = getSortValue(b, key);

        const comparison = typeof valueA === "number"
            ? valueA - valueB
            : String(valueA).localeCompare(String(valueB), "pt-BR", { sensitivity: "base" });

        // empate cai para o id mais recente, para a ordem não ficar instável entre renders
        if (comparison === 0) return Number(b.id) - Number(a.id);

        return comparison * factor;
    });
}

// reflete a ordenação atual nos cabeçalhos (seta + aria-sort para leitores de tela)
function updateSortIndicators() {
    document.querySelectorAll(".rejected-management-table th.is-sortable").forEach(th => {
        const isActive = th.dataset.sort === currentSort.key;

        th.classList.toggle("is-sorted-asc", isActive && currentSort.dir === "asc");
        th.classList.toggle("is-sorted-desc", isActive && currentSort.dir === "desc");
        th.setAttribute("aria-sort", isActive ? (currentSort.dir === "asc" ? "ascending" : "descending") : "none");
    });
}

// "12 fichas reprovadas" quando não há filtro; "5 de 12 fichas reprovadas" quando há
function updateRejectedCount(shown, total) {
    const counter = document.getElementById("rejectedCount");
    const label = total === 1 ? "ficha reprovada" : "fichas reprovadas";

    counter.textContent = shown === total ? `${total} ${label}` : `${shown} de ${total} ${label}`;
}

// desenha os atalhos de triagem: "Todos" + um chip por recorte, cada um com a própria contagem
function renderTriageChips(filters) {
    const container = document.getElementById("triageChips");

    // as contagens ignoram o atalho selecionado, senão todos os outros chips zerariam
    const scoped = getFilteredForms(filters, { ignoreTriage: true });

    container.innerHTML = TRIAGE_CHIPS.map(chip => {
        const isActive = filters.triage === chip.value;
        const count = chip.value
            ? scoped.filter(form => matchesTriage(form, chip.value)).length
            : scoped.length;

        return `
        <button type="button" class="pill forms-status-chip forms-status-chip--plain${isActive ? " is-active" : ""}"
                data-triage="${escapeHtml(chip.value)}" aria-pressed="${isActive}">
            ${escapeHtml(chip.label)}<span class="forms-status-chip-count">${count}</span>
        </button>`;
    }).join("");
}

// monta as etiquetas da coluna "Sinalizações" a partir das flags da ficha
function renderFormTags(form) {
    const tags = [];

    if (form.is_discount) {
        const discount = formatDiscount(form.discount_percentage);
        tags.push(`<span class="forms-tag forms-tag--discount">${discount ? `${escapeHtml(discount)} desc.` : "Desconto"}</span>`);
    }
    if (form.is_portability) tags.push(`<span class="forms-tag forms-tag--portability">Portabilidade</span>`);
    if (form.is_pa_digital) tags.push(`<span class="forms-tag forms-tag--digital">PA Digital</span>`);
    if (form.is_aeromedic) tags.push(`<span class="forms-tag forms-tag--aero">Aeromédico</span>`);

    if (tags.length === 0) return `<span class="forms-tag-empty">—</span>`;

    return `<div class="forms-tags">${tags.join("")}</div>`;
}

// renderiza a tabela a partir de uma lista já filtrada e ordenada
function renderRejectedTable(forms, filters) {
    const tbodyRejected = document.getElementById("tbodyRejectedManagementForms");
    tbodyRejected.innerHTML = ``;

    if (forms.length === 0) {
        // sem resultado por causa dos filtros é diferente de não haver ficha reprovada nenhuma
        tbodyRejected.innerHTML = hasActiveFilters(filters)
            ? `<tr class="forms-empty-row"><td colspan="7">
                   <div class="forms-empty-state">
                       <span>Nenhuma ficha encontrada para os filtros selecionados.</span>
                       <button type="button" class="btn btn--outline btn--sm" id="emptyClearFilters">Limpar filtros</button>
                   </div>
               </td></tr>`
            : `<tr class="forms-empty-row"><td colspan="7">Nenhuma ficha reprovada pela gerência.</td></tr>`;
        return;
    }

    const rejectedFragment = document.createDocumentFragment();

    forms.forEach(form => {
        const trRejected = document.createElement("tr");

        // a linha inteira abre o modal de reanálise (ver delegação no DOMContentLoaded)
        trRejected.dataset.id = form.id;
        trRejected.tabIndex = 0;

        const cpf = form.beneficiary_cpf ? formatCPF(form.beneficiary_cpf) : "";
        const days = getDaysWaiting(form);
        const isAging = days !== null && days > AGING_THRESHOLD_DAYS;

        trRejected.innerHTML = `
            <td>
                <div class="beneficiary-cell">
                    <span class="beneficiary-cell-name">${escapeHtml(form.beneficiary_name)}</span>
                    <span class="beneficiary-cell-meta">${cpf ? `${escapeHtml(cpf)} · ` : ""}#${escapeHtml(form.id)}</span>
                </div>
            </td>
            <td class="forms-cell-type">
                <div class="forms-cell-stack">
                    <span class="forms-cell-stack-name">${escapeHtml(form.inclusion_type)}</span>
                    <span class="forms-cell-stack-meta">${escapeHtml(formatBeneficiaryType(form.beneficiary_type))}</span>
                </div>
            </td>
            <td class="forms-cell-plan">
                <div class="forms-cell-stack">
                    <span class="forms-cell-stack-name">${escapeHtml(form.plan_type)}</span>
                    <span class="forms-cell-stack-meta">${escapeHtml(form.contract_type)}</span>
                </div>
            </td>
            <td class="forms-cell-consultant">${escapeHtml(form.consultant_name)}</td>
            <td class="forms-cell-date">
                <div class="forms-cell-stack">
                    <span class="forms-cell-stack-name">${formatDateToBR(form.inclusion_date)}</span>
                    <span class="forms-aging${isAging ? " forms-aging--warn" : ""}">${escapeHtml(formatAging(days))}</span>
                </div>
            </td>
            <td class="forms-cell-flags">${renderFormTags(form)}</td>
            <td class="actions-column">
                <div class="table-actions">
                    <button class="icon-btn icon-btn--primary" title="Solicitar reanálise" aria-label="Solicitar reanálise" data-action="reanalysis" data-form-id="${form.id}">
                        <svg viewBox="0 0 16 16" fill="none"><path d="M13.5 8A5.5 5.5 0 1 1 11 3.4" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/><path d="M11 1v3h-3" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>
                    </button>
                    <button class="icon-btn icon-btn--danger" title="Encerrar negociação" aria-label="Encerrar negociação" data-action="close" data-form-id="${form.id}">
                        <svg viewBox="0 0 16 16" fill="none"><path d="M3 3l10 10M13 3L3 13" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>
                    </button>
                </div>
            </td>
        `;

        rejectedFragment.appendChild(trRejected);
    });

    tbodyRejected.appendChild(rejectedFragment);
}

// aplica os filtros, reordena e re-renderiza tudo que depende deles
function applyFilters() {
    const filters = getActiveFilters();
    const filtered = getFilteredForms(filters);

    renderTriageChips(filters);
    renderRejectedTable(sortForms(filtered), filters);
    updateSortIndicators();
    updateRejectedCount(filtered.length, allRejectedForms.length);

    document.getElementById("filterClear").classList.toggle("is-hidden", !hasActiveFilters(filters));
}

// zera todos os filtros e volta ao estado padrão da listagem
function clearFilters() {
    document.getElementById("filterBeneficiary").value = "";
    document.getElementById("filterConsultant").value = "";
    document.getElementById("filterInclusionType").value = "";
    document.getElementById("filterPlan").value = "";
    document.getElementById("filterDateFrom").value = "";
    document.getElementById("filterDateTo").value = "";
    triageFilter = "";
    applyFilters();
}

// função para preencher tabela de formulários reprovados pela gerência
export async function populateRejectedManagementFormsTable() {
    const tbodyRejected = document.getElementById("tbodyRejectedManagementForms");

    try {
        const response = await fetchWithAuth(`/entrevista-adesao/application-forms/status?status_id=11`);

        if (!response.ok) {
            const errorJSON = await response.json().catch(() => null);
            throw new Error(errorJSON?.message || "Erro ao carregar os formulários");
        }

        allRejectedForms = await response.json();

        rejectedFormsById.clear();
        allRejectedForms.forEach(form => rejectedFormsById.set(form.id, form));

        populateFilterOptions(allRejectedForms);
        applyFilters();
    } catch (error) {
        // sem isso a tabela ficava presa em "Carregando..." e o erro só aparecia no console
        tbodyRejected.innerHTML = `<tr class="forms-empty-row"><td colspan="7">Não foi possível carregar os formulários.</td></tr>`;
        notyf.error(error.message || "Houve um erro ao carregar os formulários");
    }
}

// abre o modal de reanálise a partir do id da linha/botão, reaproveitando o cache da listagem
function openReanalysisById(applicationFormId) {
    const applicationForm = rejectedFormsById.get(Number(applicationFormId));
    if (!applicationForm) return;

    openRequestReanalysisModal(applicationForm);
}

// idem, para o modal de encerrar negociação
function openCloseNegotiationById(applicationFormId) {
    const applicationForm = rejectedFormsById.get(Number(applicationFormId));
    if (!applicationForm) return;

    openCloseNegotiationModal(applicationForm);
}

document.addEventListener("DOMContentLoaded", () => {
    populateRejectedManagementFormsTable();

    // ---------- Filtros ----------
    const filterBeneficiary = document.getElementById("filterBeneficiary");
    const filterConsultant = document.getElementById("filterConsultant");
    const filterInclusionType = document.getElementById("filterInclusionType");
    const filterPlan = document.getElementById("filterPlan");
    const filterDateFrom = document.getElementById("filterDateFrom");
    const filterDateTo = document.getElementById("filterDateTo");
    const filterClear = document.getElementById("filterClear");

    // "input" no campo de texto reage a cada tecla; "change" nos selects/datas
    filterBeneficiary.addEventListener("input", applyFilters);
    filterConsultant.addEventListener("change", applyFilters);
    filterInclusionType.addEventListener("change", applyFilters);
    filterPlan.addEventListener("change", applyFilters);
    filterDateFrom.addEventListener("change", applyFilters);
    filterDateTo.addEventListener("change", applyFilters);

    filterClear.addEventListener("click", clearFilters);

    // ---------- Atalhos de triagem ----------
    document.getElementById("triageChips").addEventListener("click", (event) => {
        const chip = event.target.closest(".forms-status-chip");
        if (!chip) return;

        triageFilter = chip.dataset.triage;
        applyFilters();
    });

    // ---------- Ordenação (delegação no thead) ----------
    const thead = document.querySelector(".rejected-management-table thead");

    function toggleSort(th) {
        const key = th.dataset.sort;

        // clicar de novo na mesma coluna inverte; trocar de coluna recomeça na direção padrão dela
        currentSort = key === currentSort.key
            ? { key, dir: currentSort.dir === "asc" ? "desc" : "asc" }
            : { key, dir: DESC_FIRST_SORT_KEYS.has(key) ? "desc" : "asc" };

        applyFilters();
    }

    thead.addEventListener("click", (event) => {
        const th = event.target.closest("th.is-sortable");
        if (th) toggleSort(th);
    });

    // os cabeçalhos são focáveis (role="button"), então precisam responder ao teclado
    thead.addEventListener("keydown", (event) => {
        if (event.key !== "Enter" && event.key !== " ") return;

        const th = event.target.closest("th.is-sortable");
        if (!th) return;

        event.preventDefault(); // espaço rolaria a página
        toggleSort(th);
    });

    // ---------- Ações da tabela (delegação de evento) ----------
    // o tbody é recriado a cada render, mas o listener no elemento pai permanece
    const tbodyRejected = document.getElementById("tbodyRejectedManagementForms");

    tbodyRejected.addEventListener("click", async (event) => {
        if (event.target.closest("#emptyClearFilters")) {
            clearFilters();
            return;
        }

        const actionButton = event.target.closest("[data-action][data-form-id]");

        // clique fora dos botões abre a reanálise, que é a ação não destrutiva desta tela;
        // encerrar a negociação continua exigindo o clique no botão vermelho
        if (!actionButton) {
            if (event.target.closest(".table-actions")) return;

            const row = event.target.closest("tr[data-id]");
            if (row) openReanalysisById(row.dataset.id);
            return;
        }

        const formId = Number(actionButton.dataset.formId);
        const action = actionButton.dataset.action;

        try {
            if (action === "reanalysis") {
                // a solicitação em si é enviada pelo modal, que também recarrega a tabela
                openReanalysisById(formId);
                return;
            }

            if (action === "close") {
                // a confirmação e o encerramento em si acontecem no modal, que também recarrega a tabela
                openCloseNegotiationById(formId);
                return;
            }

            populateRejectedManagementFormsTable();
        } catch (error) {
            notyf.error(error.message || "Houve um erro ao processar a ação");
        }
    });

    // as linhas são focáveis, então Enter também abre a reanálise
    tbodyRejected.addEventListener("keydown", (event) => {
        if (event.key !== "Enter") return;

        const row = event.target.closest("tr[data-id]");
        if (row && event.target === row) openReanalysisById(row.dataset.id);
    });
})
