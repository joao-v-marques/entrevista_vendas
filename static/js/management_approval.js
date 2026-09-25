import { fetchWithAuth, getLoggedUser } from "./utils/apiHelper.js";
import { formatDateToBR } from "./utils/dateUtils.js";
import { escapeHtml, formatCPF } from "./utils/detailsView.js";
import {
    ESCOLHA_MEDICO_ORIENTADOR_LABELS,
    PARECER_UNIMED_PILL_CLASSES,
    PARECER_UNIMED_REFUSED,
    PARECER_UNIMED_SHORT_LABELS,
    formatImc,
    getDeclaredConditions,
} from "./utils/qualifyInterview.js";
import { openAnalyzeManagementModal } from "./managementModals/analyzeManagementModal.js";

// guarda os dados completos de cada ficha pendente, pra abrir o modal de análise sem precisar de uma nova requisição.
// Guarda só o bloco `form` do payload, que é exatamente o objeto que o modal espera receber.
const pendingFormsById = new Map();

// guarda a lista completa carregada do backend; os filtros atuam sobre ela sem novo request.
// Cada item é uma linha { form, qualify_interview }.
let allRows = [];

// quem aprova na gerência — espelha o @role_required de
// POST /application_form_management. Vendas apenas acompanha a fila.
const ROLES_ANALYZE = ["administrator", "director"];

// resolvido antes da primeira renderização, já que os filtros re-renderizam as linhas
let canAnalyze = false;

// é uma fila de trabalho: a ficha que está esperando há mais tempo aparece primeiro
let currentSort = { key: "date", dir: "asc" };

// colunas cujo primeiro clique já faz mais sentido em ordem decrescente.
// Preexistência entra aqui porque o que se quer ver primeiro é quem TEM condição declarada.
const DESC_FIRST_SORT_KEYS = new Set(["date", "preexisting"]);

// a partir de quantos dias parada na fila a ficha passa a ser destacada
const AGING_THRESHOLD_DAYS = 7;

// atalho de triagem selecionado. Todas as fichas desta tela têm o mesmo status
// (4. Aguardando Aprovação da Gerência), então os chips recortam por risco de saúde.
let triageFilter = "";

const TRIAGE_CHIPS = [
    { value: "", label: "Todos" },
    { value: "with", label: "Com preexistência" },
    { value: "without", label: "Sem preexistência" },
    { value: "refused", label: "Recusou CPT/perícia", tone: "forms-status-chip--overdue" },
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

// converte o discount_percentage (numeric(5,4): 0.1050 no banco) para "10,5%"
function formatDiscount(value) {
    const percentage = Number(value);
    if (isNaN(percentage)) return "";
    return `${(percentage * 100).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`;
}

// classificação única de preexistência: a coluna, os chips e a ordenação saem daqui
function getPreexistingSummary(row) {
    const qualify = row.qualify_interview;
    if (!qualify) return { known: false, has: false, declared: [] };

    const declared = getDeclaredConditions(qualify);

    // o parecer é a conclusão oficial do entrevistador e basta para dizer "Sim". O OR com as
    // condições declaradas é proposital: se o questionário tem alguma marcada e o parecer diz
    // "sem preexistências", a linha ainda aparece como Sim — a tela nunca esconde uma condição
    // declarada por causa de uma divergência de preenchimento, e as duas colunas ficam lado a
    // lado para a gerência enxergar a divergência.
    const hasByParecer = String(qualify.parecer_unimed || "").startsWith("com_preexistencias");

    return { known: true, has: hasByParecer || declared.length > 0, declared };
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

// só o consultor vem dos dados; o de parecer é fixo no HTML, porque os 4 valores são
// definidos por CHECK no banco e não dependem do que está carregado
function populateFilterOptions(rows) {
    fillFilterSelect("filterConsultant", rows.map(row => row.form.consultant_name));
}

// lê de uma vez os valores dos filtros, já normalizados para a comparação
function getActiveFilters() {
    return {
        search: document.getElementById("filterBeneficiary").value.trim().toLowerCase(),
        consultant: document.getElementById("filterConsultant").value,
        parecer: document.getElementById("filterParecer").value,
        dateFrom: document.getElementById("filterDateFrom").value, // "YYYY-MM-DD" ou ""
        dateTo: document.getElementById("filterDateTo").value,
        triage: triageFilter,
    };
}

function hasActiveFilters(filters) {
    return Boolean(
        filters.search || filters.consultant || filters.parecer ||
        filters.dateFrom || filters.dateTo || filters.triage
    );
}

function matchesTriage(row, triage) {
    const summary = getPreexistingSummary(row);

    if (triage === "with") return summary.has;
    if (triage === "without") return summary.known && !summary.has;
    if (triage === "refused") return PARECER_UNIMED_REFUSED.has(row.qualify_interview?.parecer_unimed);
    return true;
}

// aplica os filtros sobre allRows. `ignoreTriage` é usado para contar os chips:
// cada chip mostra quantas fichas daquele recorte sobram com os *demais* filtros.
function getFilteredRows(filters, { ignoreTriage = false } = {}) {
    return allRows.filter(row => {
        const form = row.form;

        // a busca cobre nome, CPF (cru e mascarado) e o número da ficha
        const cpf = form.beneficiary_cpf || "";
        const haystack = `${form.beneficiary_name || ""} ${cpf} ${formatCPF(cpf)} ${form.id}`.toLowerCase();
        const matchesSearch = !filters.search || haystack.includes(filters.search);
        const matchesConsultant = !filters.consultant || form.consultant_name === filters.consultant;
        const matchesParecer = !filters.parecer || row.qualify_interview?.parecer_unimed === filters.parecer;

        // período de inclusão: comparação lexicográfica funciona no formato "YYYY-MM-DD",
        // e os dois extremos entram no resultado
        const formDate = getFormDateISO(form);
        const matchesDateFrom = !filters.dateFrom || (formDate && formDate >= filters.dateFrom);
        const matchesDateTo = !filters.dateTo || (formDate && formDate <= filters.dateTo);

        const matchesTriageFilter = ignoreTriage || !filters.triage || matchesTriage(row, filters.triage);

        return matchesSearch && matchesConsultant && matchesParecer
            && matchesDateFrom && matchesDateTo && matchesTriageFilter;
    });
}

// valor usado na comparação de cada coluna ordenável
function getSortValue(row, key) {
    if (key === "date") {
        const time = new Date(row.form.inclusion_date).getTime();
        return isNaN(time) ? 0 : time;
    }
    if (key === "preexisting") return getPreexistingSummary(row).has ? 1 : 0;
    if (key === "parecer") return row.qualify_interview?.parecer_unimed || "";
    if (key === "consultant") return row.form.consultant_name || "";
    return row.form.beneficiary_name || "";
}

// ordena uma cópia da lista para não mexer na ordem original de allRows
function sortRows(rows) {
    const { key, dir } = currentSort;
    const factor = dir === "desc" ? -1 : 1;

    return [...rows].sort((a, b) => {
        const valueA = getSortValue(a, key);
        const valueB = getSortValue(b, key);

        const comparison = typeof valueA === "number"
            ? valueA - valueB
            : String(valueA).localeCompare(String(valueB), "pt-BR", { sensitivity: "base" });

        // empate cai para o id mais recente, para a ordem não ficar instável entre renders
        if (comparison === 0) return Number(b.form.id) - Number(a.form.id);

        return comparison * factor;
    });
}

// reflete a ordenação atual nos cabeçalhos (seta + aria-sort para leitores de tela)
function updateSortIndicators() {
    document.querySelectorAll(".management-table th.is-sortable").forEach(th => {
        const isActive = th.dataset.sort === currentSort.key;

        th.classList.toggle("is-sorted-asc", isActive && currentSort.dir === "asc");
        th.classList.toggle("is-sorted-desc", isActive && currentSort.dir === "desc");
        th.setAttribute("aria-sort", isActive ? (currentSort.dir === "asc" ? "ascending" : "descending") : "none");
    });
}

// "12 fichas pendentes" quando não há filtro; "5 de 12 fichas pendentes" quando há
function updateManagementCount(shown, total) {
    const counter = document.getElementById("managementCount");
    const label = total === 1 ? "ficha pendente" : "fichas pendentes";

    counter.textContent = shown === total ? `${total} ${label}` : `${shown} de ${total} ${label}`;
}

// desenha os atalhos de triagem: "Todos" + um chip por recorte, cada um com a própria contagem
function renderTriageChips(filters) {
    const container = document.getElementById("triageChips");

    // as contagens ignoram o atalho selecionado, senão todos os outros chips zerariam
    const scoped = getFilteredRows(filters, { ignoreTriage: true });

    container.innerHTML = TRIAGE_CHIPS.map(chip => {
        const isActive = filters.triage === chip.value;
        const count = chip.value
            ? scoped.filter(row => matchesTriage(row, chip.value)).length
            : scoped.length;

        const classes = ["pill", "forms-status-chip", "forms-status-chip--plain", chip.tone, isActive ? "is-active" : ""]
            .filter(Boolean)
            .join(" ");

        return `
        <button type="button" class="${classes}" data-triage="${escapeHtml(chip.value)}" aria-pressed="${isActive}">
            ${escapeHtml(chip.label)}<span class="forms-status-chip-count">${count}</span>
        </button>`;
    }).join("");
}

// monta as etiquetas comerciais da coluna "Sinalizações" a partir das flags da ficha
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

// pílula de preexistência + quantas condições foram declaradas, com os nomes no tooltip.
// É o tooltip que permite ver *quais* condições sem alargar a tabela.
function renderPreexistingCell(row) {
    const summary = getPreexistingSummary(row);

    if (!summary.known) {
        return `
            <div class="forms-cell-stack">
                <span class="pill pill--gray">Sem questionário</span>
            </div>`;
    }

    const pill = summary.has
        ? `<span class="pill pill--red">Sim</span>`
        : `<span class="pill pill--green">Não</span>`;

    const total = summary.declared.length;
    const meta = total === 0
        ? "nenhuma declarada"
        : total === 1 ? "1 declarada" : `${total} declaradas`;
    const conditionNames = summary.declared.map(item => item.label).join("\n");

    return `
        <div class="forms-cell-stack">
            ${pill}
            <span class="forms-cell-stack-meta"${conditionNames ? ` title="${escapeHtml(conditionNames)}"` : ""}>${meta}</span>
        </div>`;
}

// parecer da Unimed em pílula, com o rótulo curto e a cor da consequência
function renderParecerCell(row) {
    const parecer = row.qualify_interview?.parecer_unimed;
    if (!parecer) return `<span class="forms-tag-empty">—</span>`;

    const pillClass = PARECER_UNIMED_PILL_CLASSES[parecer] || "pill--gray";
    const label = PARECER_UNIMED_SHORT_LABELS[parecer] || parecer;

    return `<span class="pill ${pillClass}">${escapeHtml(label)}</span>`;
}

// IMC classificado + médico orientador escolhido
function renderHealthCell(row) {
    const qualify = row.qualify_interview;
    if (!qualify) return `<span class="forms-tag-empty">—</span>`;

    // o rótulo completo do médico orientador é uma frase inteira; na tabela cabe só a
    // parte que distingue as três opções, e a frase completa vai para o tooltip
    const doctorLabel = ESCOLHA_MEDICO_ORIENTADOR_LABELS[qualify.escolha_medico_orientador] || "";
    const doctorShort = {
        medico_unimed: "Médico da Unimed",
        medico_proprio: "Médico próprio",
        dispensou_orientador: "Dispensou orientador",
    }[qualify.escolha_medico_orientador] || "—";

    return `
        <div class="forms-cell-stack">
            <span class="forms-cell-stack-name">${escapeHtml(formatImc(qualify.peso_kg, qualify.altura_cm))}</span>
            <span class="forms-cell-stack-meta" title="${escapeHtml(doctorLabel)}">${escapeHtml(doctorShort)}</span>
        </div>`;
}

// renderiza a tabela a partir de uma lista já filtrada e ordenada
function renderManagementTable(rows, filters) {
    const tbodyPending = document.getElementById("tbodyPendingManagementApproval");
    tbodyPending.innerHTML = ``;

    if (rows.length === 0) {
        // sem resultado por causa dos filtros é diferente de não haver ficha nenhuma na fila
        tbodyPending.innerHTML = hasActiveFilters(filters)
            ? `<tr class="forms-empty-row"><td colspan="8">
                   <div class="forms-empty-state">
                       <span>Nenhuma ficha encontrada para os filtros selecionados.</span>
                       <button type="button" class="btn btn--outline btn--sm" id="emptyClearFilters">Limpar filtros</button>
                   </div>
               </td></tr>`
            : `<tr class="forms-empty-row"><td colspan="8">Nenhuma ficha aguardando aprovação da gerência.</td></tr>`;
        return;
    }

    const formPendingFragment = document.createDocumentFragment();

    rows.forEach(row => {
        const form = row.form;
        const trPendingForm = document.createElement("tr");

        // a linha inteira abre o modal de análise (ver delegação no DOMContentLoaded)
        trPendingForm.dataset.id = form.id;
        trPendingForm.tabIndex = 0;

        const cpf = form.beneficiary_cpf ? formatCPF(form.beneficiary_cpf) : "";
        const days = getDaysWaiting(form);

        // sem permissão para analisar, a role só acompanha a fila
        const analyzeButton = canAnalyze ? `
                    <button class="icon-btn icon-btn--primary" title="Realizar Análise" aria-label="Realizar Análise" data-form-id="${form.id}">
                        <svg viewBox="0 0 16 16" fill="none"><path d="M3 8.5l3 3 7-7" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>
                    </button>` : "";
        const isAging = days !== null && days > AGING_THRESHOLD_DAYS;

        trPendingForm.innerHTML = `
            <td>
                <div class="beneficiary-cell">
                    <span class="beneficiary-cell-name">${escapeHtml(form.beneficiary_name)}</span>
                    <span class="beneficiary-cell-meta">${cpf ? `${escapeHtml(cpf)} · ` : ""}#${escapeHtml(form.id)}</span>
                </div>
            </td>
            <td class="forms-cell-preexisting">${renderPreexistingCell(row)}</td>
            <td class="forms-cell-parecer">${renderParecerCell(row)}</td>
            <td class="forms-cell-health">${renderHealthCell(row)}</td>
            <td class="forms-cell-consultant">${escapeHtml(form.consultant_name)}</td>
            <td class="forms-cell-date">
                <div class="forms-cell-stack">
                    <span class="forms-cell-stack-name">${formatDateToBR(form.inclusion_date)}</span>
                    <span class="forms-aging${isAging ? " forms-aging--warn" : ""}">${escapeHtml(formatAging(days))}</span>
                </div>
            </td>
            <td class="forms-cell-flags">${renderFormTags(form)}</td>
            <td class="actions-column">
                <div class="table-actions">${analyzeButton}</div>
            </td>
        `;

        formPendingFragment.appendChild(trPendingForm);
    });

    tbodyPending.appendChild(formPendingFragment);
}

// aplica os filtros, reordena e re-renderiza tudo que depende deles
function applyFilters() {
    const filters = getActiveFilters();
    const filtered = getFilteredRows(filters);

    renderTriageChips(filters);
    renderManagementTable(sortRows(filtered), filters);
    updateSortIndicators();
    updateManagementCount(filtered.length, allRows.length);

    document.getElementById("filterClear").classList.toggle("is-hidden", !hasActiveFilters(filters));
}

// zera todos os filtros e volta ao estado padrão da listagem
function clearFilters() {
    document.getElementById("filterBeneficiary").value = "";
    document.getElementById("filterConsultant").value = "";
    document.getElementById("filterParecer").value = "";
    document.getElementById("filterDateFrom").value = "";
    document.getElementById("filterDateTo").value = "";
    triageFilter = "";
    applyFilters();
}

// função para preencher tabela de formulários aguardando aprovação da gerência
export async function populateManagementApproveTable() {
    const tbodyPending = document.getElementById("tbodyPendingManagementApproval");

    try {
        const response = await fetchWithAuth(`/entrevista-adesao/application-forms/management-pending`);

        if (!response.ok) {
            const errorJSON = await response.json().catch(() => null);
            throw new Error(errorJSON?.message || "Erro ao carregar os formulários");
        }

        allRows = await response.json();

        // o modal continua recebendo só a ficha, exatamente como antes
        pendingFormsById.clear();
        allRows.forEach(row => pendingFormsById.set(row.form.id, row.form));

        populateFilterOptions(allRows);
        applyFilters();
    } catch (error) {
        // sem isso a tabela ficava presa em "Carregando..." e o erro só aparecia no console
        tbodyPending.innerHTML = `<tr class="forms-empty-row"><td colspan="8">Não foi possível carregar os formulários.</td></tr>`;
        notyf.error(error.message || "Houve um erro ao carregar os formulários");
    }
}

// abre o modal de análise a partir do id da linha/botão, reaproveitando o cache da listagem
function openAnalyzeById(applicationFormId) {
    // barra também o clique na linha, que abre o mesmo modal do botão escondido
    if (!canAnalyze) return;

    const applicationForm = pendingFormsById.get(Number(applicationFormId));
    if (!applicationForm) return;

    openAnalyzeManagementModal(applicationForm);
}

document.addEventListener("DOMContentLoaded", async () => {
    const user = await getLoggedUser();
    canAnalyze = ROLES_ANALYZE.includes(user?.role_name);

    populateManagementApproveTable();

    // ---------- Filtros ----------
    const filterBeneficiary = document.getElementById("filterBeneficiary");
    const filterConsultant = document.getElementById("filterConsultant");
    const filterParecer = document.getElementById("filterParecer");
    const filterDateFrom = document.getElementById("filterDateFrom");
    const filterDateTo = document.getElementById("filterDateTo");
    const filterClear = document.getElementById("filterClear");

    // "input" no campo de texto reage a cada tecla; "change" nos selects/datas
    filterBeneficiary.addEventListener("input", applyFilters);
    filterConsultant.addEventListener("change", applyFilters);
    filterParecer.addEventListener("change", applyFilters);
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
    const thead = document.querySelector(".management-table thead");

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
    const tbodyPending = document.getElementById("tbodyPendingManagementApproval");

    tbodyPending.addEventListener("click", (event) => {
        const analyzeButton = event.target.closest(".icon-btn--primary[data-form-id]");
        if (analyzeButton) {
            openAnalyzeById(analyzeButton.dataset.formId);
            return;
        }

        if (event.target.closest("#emptyClearFilters")) {
            clearFilters();
            return;
        }

        // clique em qualquer outro ponto da linha abre a análise; a área dos botões
        // fica de fora para um clique que erra o alvo não abrir o modal duas vezes
        if (event.target.closest(".table-actions")) return;

        const row = event.target.closest("tr[data-id]");
        if (row) openAnalyzeById(row.dataset.id);
    });

    // as linhas são focáveis, então Enter também abre a análise
    tbodyPending.addEventListener("keydown", (event) => {
        if (event.key !== "Enter") return;

        const row = event.target.closest("tr[data-id]");
        if (row && event.target === row) openAnalyzeById(row.dataset.id);
    });
})
