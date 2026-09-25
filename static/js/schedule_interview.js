import { fetchWithAuth } from "./utils/apiHelper.js";
import { formatDateToBR } from "./utils/dateUtils.js";
import { escapeHtml, formatCPF, formatPhone, formatBeneficiaryType } from "./utils/detailsView.js";
import { openScheduleInterviewModal } from "./scheduleModals/scheduleInterviewModal.js";

// guarda os dados completos de cada ficha aguardando agendamento, pra abrir o modal sem precisar de uma nova requisição
const pendingFormsById = new Map();

// guarda a lista completa carregada do backend; os filtros atuam sobre ela sem novo request
let allPendingForms = [];

// esta tela é uma fila de trabalho, e não um histórico: o que interessa primeiro é a ficha
// que está esperando há mais tempo. Por isso abre em ordem crescente de data, ao contrário
// da listagem geral (/fichas), que abre com a mais recente no topo.
let currentSort = { key: "date", dir: "asc" };

// colunas cujo primeiro clique já faz mais sentido em ordem decrescente
const DESC_FIRST_SORT_KEYS = new Set(["date"]);

// a partir de quantos dias parada na fila a ficha passa a ser destacada (e entra no chip de atraso)
const AGING_THRESHOLD_DAYS = 7;

// atalho de triagem selecionado. Todas as fichas desta tela têm o mesmo status
// (2. Aguardando Agendamento de Entrevista), então os chips recortam por sinalização/atraso.
// Como não existe um <select> equivalente, o valor escolhido vive nesta variável.
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

// converte o discount_percentage (numeric(5,4): 0.1050 no banco) para "10,5%",
// o mesmo cálculo que formatValue(..., "percentage") faz nos modais
function formatDiscount(value) {
    const percentage = Number(value);
    if (isNaN(percentage)) return "";
    return `${(percentage * 100).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`;
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
}

// lê de uma vez os valores dos filtros, já normalizados para a comparação
function getActiveFilters() {
    return {
        search: document.getElementById("filterBeneficiary").value.trim().toLowerCase(),
        consultant: document.getElementById("filterConsultant").value,
        inclusionType: document.getElementById("filterInclusionType").value,
        dateFrom: document.getElementById("filterDateFrom").value, // "YYYY-MM-DD" ou ""
        dateTo: document.getElementById("filterDateTo").value,
        triage: triageFilter,
    };
}

function hasActiveFilters(filters) {
    return Boolean(
        filters.search || filters.consultant || filters.inclusionType ||
        filters.dateFrom || filters.dateTo || filters.triage
    );
}

function matchesTriage(form, triage) {
    if (triage === "discount") return Boolean(form.is_discount);
    if (triage === "portability") return Boolean(form.is_portability);
    if (triage === "aging") return getDaysWaiting(form) > AGING_THRESHOLD_DAYS;
    return true;
}

// aplica os filtros sobre allPendingForms. `ignoreTriage` é usado para contar os chips:
// cada chip mostra quantas fichas daquele recorte sobram com os *demais* filtros.
function getFilteredForms(filters, { ignoreTriage = false } = {}) {
    return allPendingForms.filter(form => {
        // a busca cobre nome e CPF, cru e mascarado, para achar "12345678900" e "123.456.789-00"
        const cpf = form.beneficiary_cpf || "";
        const haystack = `${form.beneficiary_name || ""} ${cpf} ${formatCPF(cpf)}`.toLowerCase();
        const matchesSearch = !filters.search || haystack.includes(filters.search);
        const matchesConsultant = !filters.consultant || form.consultant_name === filters.consultant;
        const matchesInclusionType = !filters.inclusionType || form.inclusion_type === filters.inclusionType;

        // período de inclusão: comparação lexicográfica funciona no formato "YYYY-MM-DD",
        // e os dois extremos entram no resultado
        const formDate = getFormDateISO(form);
        const matchesDateFrom = !filters.dateFrom || (formDate && formDate >= filters.dateFrom);
        const matchesDateTo = !filters.dateTo || (formDate && formDate <= filters.dateTo);

        const matchesTriageFilter = ignoreTriage || !filters.triage || matchesTriage(form, filters.triage);

        return matchesSearch && matchesConsultant && matchesInclusionType
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
    if (key === "consultant") return form.consultant_name || "";
    return form.beneficiary_name || "";
}

// ordena uma cópia da lista para não mexer na ordem original de allPendingForms
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
    document.querySelectorAll(".schedule-table th.is-sortable").forEach(th => {
        const isActive = th.dataset.sort === currentSort.key;

        th.classList.toggle("is-sorted-asc", isActive && currentSort.dir === "asc");
        th.classList.toggle("is-sorted-desc", isActive && currentSort.dir === "desc");
        th.setAttribute("aria-sort", isActive ? (currentSort.dir === "asc" ? "ascending" : "descending") : "none");
    });
}

// "12 fichas aguardando agendamento" quando não há filtro; "5 de 12 ..." quando há
function updateScheduleCount(shown, total) {
    const counter = document.getElementById("scheduleCount");
    const label = total === 1 ? "ficha aguardando agendamento" : "fichas aguardando agendamento";

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
function renderScheduleTable(forms, filters) {
    const tbodyScheduleInterview = document.getElementById("tbodyScheduleInterview");
    tbodyScheduleInterview.innerHTML = ``;

    if (forms.length === 0) {
        // sem resultado por causa dos filtros é diferente de não haver ficha nenhuma na fila
        tbodyScheduleInterview.innerHTML = hasActiveFilters(filters)
            ? `<tr class="forms-empty-row"><td colspan="7">
                   <div class="forms-empty-state">
                       <span>Nenhuma ficha encontrada para os filtros selecionados.</span>
                       <button type="button" class="btn btn--outline btn--sm" id="emptyClearFilters">Limpar filtros</button>
                   </div>
               </td></tr>`
            : `<tr class="forms-empty-row"><td colspan="7">Nenhuma ficha aguardando agendamento de entrevista.</td></tr>`;
        return;
    }

    const formPendingFragment = document.createDocumentFragment();

    forms.forEach(form => {
        const trPendingForm = document.createElement("tr");

        // a linha inteira abre o modal de agendamento (ver delegação no DOMContentLoaded)
        trPendingForm.dataset.id = form.id;
        trPendingForm.tabIndex = 0;

        const cpf = form.beneficiary_cpf ? formatCPF(form.beneficiary_cpf) : "";
        const phone = form.beneficiary_phone ? formatPhone(form.beneficiary_phone) : "";
        const days = getDaysWaiting(form);
        const isAging = days !== null && days > AGING_THRESHOLD_DAYS;

        trPendingForm.innerHTML = `
            <td>
                <div class="beneficiary-cell">
                    <span class="beneficiary-cell-name">${escapeHtml(form.beneficiary_name)}</span>
                    <span class="beneficiary-cell-meta">${cpf ? `${escapeHtml(cpf)} · ` : ""}#${escapeHtml(form.id)}</span>
                </div>
            </td>
            <td class="forms-cell-contact">
                <div class="forms-cell-stack">
                    <span class="forms-cell-stack-name">${phone ? escapeHtml(phone) : "—"}</span>
                    <span class="forms-cell-stack-meta">${form.beneficiary_email ? escapeHtml(form.beneficiary_email) : ""}</span>
                </div>
            </td>
            <td class="forms-cell-type">
                <div class="forms-cell-stack">
                    <span class="forms-cell-stack-name">${escapeHtml(form.inclusion_type)}</span>
                    <span class="forms-cell-stack-meta">${escapeHtml(formatBeneficiaryType(form.beneficiary_type))}</span>
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
                    <button class="icon-btn icon-btn--primary" title="Agendar Entrevista" aria-label="Agendar Entrevista" data-form-id="${form.id}">
                        <svg viewBox="0 0 16 16" fill="none"><rect x="2" y="2.5" width="12" height="11" rx="1.3" stroke="currentColor" stroke-width="1.4"/><path d="M2 6h12" stroke="currentColor" stroke-width="1.4"/><path d="M5 1.5v2M11 1.5v2" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>
                    </button>
                </div>
            </td>
        `;

        formPendingFragment.appendChild(trPendingForm);
    });

    tbodyScheduleInterview.appendChild(formPendingFragment);
}

// aplica os filtros, reordena e re-renderiza tudo que depende deles
function applyFilters() {
    const filters = getActiveFilters();
    const filtered = getFilteredForms(filters);

    renderTriageChips(filters);
    renderScheduleTable(sortForms(filtered), filters);
    updateSortIndicators();
    updateScheduleCount(filtered.length, allPendingForms.length);

    document.getElementById("filterClear").classList.toggle("is-hidden", !hasActiveFilters(filters));
}

// zera todos os filtros e volta ao estado padrão da listagem
function clearFilters() {
    document.getElementById("filterBeneficiary").value = "";
    document.getElementById("filterConsultant").value = "";
    document.getElementById("filterInclusionType").value = "";
    document.getElementById("filterDateFrom").value = "";
    document.getElementById("filterDateTo").value = "";
    triageFilter = "";
    applyFilters();
}

// função para preencher tabela de formulários aguardando agendamento de entrevista
export async function populateScheduleInterviewTable() {
    const tbodyScheduleInterview = document.getElementById("tbodyScheduleInterview");

    try {
        const response = await fetchWithAuth(`/entrevista-adesao/application-forms/status?status_id=2`);

        if (!response.ok) {
            const errorJSON = await response.json().catch(() => null);
            throw new Error(errorJSON?.message || "Erro ao carregar os formulários");
        }

        allPendingForms = await response.json();

        pendingFormsById.clear();
        allPendingForms.forEach(form => pendingFormsById.set(form.id, form));

        populateFilterOptions(allPendingForms);
        applyFilters();
    } catch (error) {
        // sem isso a tabela ficava presa em "Carregando..." e o erro só aparecia no console
        tbodyScheduleInterview.innerHTML = `<tr class="forms-empty-row"><td colspan="7">Não foi possível carregar os formulários.</td></tr>`;
        notyf.error(error.message || "Houve um erro ao carregar os formulários");
    }
}

// abre o modal de agendamento a partir do id da linha/botão, reaproveitando o cache da listagem
function openScheduleById(applicationFormId) {
    const applicationForm = pendingFormsById.get(Number(applicationFormId));
    if (!applicationForm) return;

    openScheduleInterviewModal(applicationForm);
}

document.addEventListener("DOMContentLoaded", () => {
    populateScheduleInterviewTable();

    // ---------- Filtros ----------
    const filterBeneficiary = document.getElementById("filterBeneficiary");
    const filterConsultant = document.getElementById("filterConsultant");
    const filterInclusionType = document.getElementById("filterInclusionType");
    const filterDateFrom = document.getElementById("filterDateFrom");
    const filterDateTo = document.getElementById("filterDateTo");
    const filterClear = document.getElementById("filterClear");

    // "input" no campo de texto reage a cada tecla; "change" nos selects/datas
    filterBeneficiary.addEventListener("input", applyFilters);
    filterConsultant.addEventListener("change", applyFilters);
    filterInclusionType.addEventListener("change", applyFilters);
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
    const thead = document.querySelector(".schedule-table thead");

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
    const tbodyScheduleInterview = document.getElementById("tbodyScheduleInterview");

    tbodyScheduleInterview.addEventListener("click", (event) => {
        const scheduleButton = event.target.closest(".icon-btn--primary[data-form-id]");
        if (scheduleButton) {
            openScheduleById(scheduleButton.dataset.formId);
            return;
        }

        if (event.target.closest("#emptyClearFilters")) {
            clearFilters();
            return;
        }

        // clique em qualquer outro ponto da linha abre o agendamento; a área dos botões
        // fica de fora para um clique que erra o alvo não abrir o modal duas vezes
        if (event.target.closest(".table-actions")) return;

        const row = event.target.closest("tr[data-id]");
        if (row) openScheduleById(row.dataset.id);
    });

    // as linhas são focáveis, então Enter também abre o agendamento
    tbodyScheduleInterview.addEventListener("keydown", (event) => {
        if (event.key !== "Enter") return;

        const row = event.target.closest("tr[data-id]");
        if (row && event.target === row) openScheduleById(row.dataset.id);
    });
})
