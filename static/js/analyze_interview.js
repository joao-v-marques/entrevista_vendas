import { fetchWithAuth, getLoggedUser } from "./utils/apiHelper.js";
import { formatDateTimeToBR } from "./utils/dateUtils.js";
import { escapeHtml, formatCPF, formatPhone, formatBeneficiaryType } from "./utils/detailsView.js";
import { openRescheduleInterviewModal } from "./scheduleModals/rescheduleInterviewModal.js";
import { openAnalyzeInterviewModal } from "./analyzeInterviewModals/analyzeInterviewModal.js";

// guarda os dados completos de cada ficha aguardando análise, pra abrir o modal sem precisar de uma nova requisição
const pendingFormsById = new Map();

// guarda a lista completa carregada do backend; os filtros atuam sobre ela sem novo request
let allInterviews = [];

// quem analisa a entrevista — espelha o @role_required de
// PUT /application-form-interviews. Vendas apenas acompanha a fila desta tela.
const ROLES_ANALYZE = ["administrator", "director", "interview_employee"];

// resolvido antes da primeira renderização, já que os filtros re-renderizam as linhas
let canAnalyze = false;

// esta é a única listagem em que a data que importa está no futuro: a entrevista não pode
// vencer. Por isso a ordem padrão é crescente pela data da entrevista — o que já venceu no
// topo, depois o que é hoje, depois o que vem em seguida.
let currentSort = { key: "interview", dir: "asc" };

// colunas cujo primeiro clique já faz mais sentido em ordem decrescente
const DESC_FIRST_SORT_KEYS = new Set([]);

// janela considerada "próxima" no chip de triagem
const UPCOMING_WINDOW_DAYS = 7;

// atalho de urgência selecionado. Todas as fichas desta tela têm o mesmo status
// (3. Aguardando Aprovação da Entrevista), então os chips recortam por prazo.
let triageFilter = "";

const TRIAGE_CHIPS = [
    { value: "", label: "Todos" },
    { value: "overdue", label: "Vencidas" },
    { value: "today", label: "Hoje" },
    { value: "next7", label: `Próximos ${UPCOMING_WINDOW_DAYS} dias` },
];

// normaliza a data da entrevista (que vem como "Mon, 01 Jan 2001 00:00:00 GMT")
// para "YYYY-MM-DD" em UTC, mesmo formato do <input type="date">
function getInterviewDateISO(form) {
    if (!form.interview_date) return "";

    const date = new Date(form.interview_date);
    if (isNaN(date)) return "";

    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, "0");
    const day = String(date.getUTCDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
}

// dias até a entrevista: negativo = vencida, 0 = hoje, positivo = futura.
// Os dois lados caem na meia-noite UTC para a conta dar dias inteiros — mesma convenção
// de fuso que dateUtils.js e as outras listagens já usam.
function getDaysUntilInterview(form) {
    const dateISO = getInterviewDateISO(form);
    if (!dateISO) return null;

    const now = new Date();
    const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
    const interview = Date.parse(`${dateISO}T00:00:00Z`);

    return Math.round((interview - today) / 86400000);
}

// hora da entrevista ("14:30"), em UTC pelo mesmo motivo das datas
function getInterviewTime(form) {
    const date = new Date(form.interview_date);
    if (isNaN(date)) return "";

    return `${String(date.getUTCHours()).padStart(2, "0")}:${String(date.getUTCMinutes()).padStart(2, "0")}`;
}

// classificação única de urgência: ordem, etiqueta, cor da linha, chips e alerta saem daqui.
// Uma regra só evita que as cinco coisas discordem entre si na próxima mudança.
function getUrgency(form) {
    const days = getDaysUntilInterview(form);

    if (days === null) return { key: "none", label: "Sem data", variant: "" };

    if (days < 0) {
        const elapsed = -days;
        return {
            key: "overdue",
            label: elapsed === 1 ? "Vencida há 1 dia" : `Vencida há ${elapsed} dias`,
            variant: "forms-tag--overdue",
        };
    }

    if (days === 0) {
        const time = getInterviewTime(form);
        return { key: "today", label: time ? `Hoje às ${time}` : "Hoje", variant: "forms-tag--today" };
    }

    if (days === 1) return { key: "soon", label: "Amanhã", variant: "forms-tag--soon" };
    if (days <= UPCOMING_WINDOW_DAYS) return { key: "soon", label: `Em ${days} dias`, variant: "forms-tag--soon" };

    return { key: "later", label: `Em ${days} dias`, variant: "" };
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
}

// lê de uma vez os valores dos filtros, já normalizados para a comparação
function getActiveFilters() {
    return {
        search: document.getElementById("filterBeneficiary").value.trim().toLowerCase(),
        consultant: document.getElementById("filterConsultant").value,
        dateFrom: document.getElementById("filterDateFrom").value, // "YYYY-MM-DD" ou ""
        dateTo: document.getElementById("filterDateTo").value,
        triage: triageFilter,
    };
}

function hasActiveFilters(filters) {
    return Boolean(filters.search || filters.consultant || filters.dateFrom || filters.dateTo || filters.triage);
}

function matchesTriage(form, triage) {
    const days = getDaysUntilInterview(form);
    if (days === null) return false;

    if (triage === "overdue") return days < 0;
    if (triage === "today") return days === 0;
    if (triage === "next7") return days >= 0 && days <= UPCOMING_WINDOW_DAYS;
    return true;
}

// aplica os filtros sobre allInterviews. `ignoreTriage` é usado para contar os chips:
// cada chip mostra quantas entrevistas daquele recorte sobram com os *demais* filtros.
function getFilteredInterviews(filters, { ignoreTriage = false } = {}) {
    return allInterviews.filter(form => {
        // a busca cobre nome, CPF (cru e mascarado) e o número da ficha — este último
        // era um campo próprio antes, e continua alcançável por aqui
        const cpf = form.beneficiary_cpf || "";
        const haystack = `${form.beneficiary_name || ""} ${cpf} ${formatCPF(cpf)} ${form.id}`.toLowerCase();
        const matchesSearch = !filters.search || haystack.includes(filters.search);
        const matchesConsultant = !filters.consultant || form.consultant_name === filters.consultant;

        // período da entrevista: comparação lexicográfica funciona no formato "YYYY-MM-DD",
        // e os dois extremos entram no resultado
        const interviewDate = getInterviewDateISO(form);
        const matchesDateFrom = !filters.dateFrom || (interviewDate && interviewDate >= filters.dateFrom);
        const matchesDateTo = !filters.dateTo || (interviewDate && interviewDate <= filters.dateTo);

        const matchesTriageFilter = ignoreTriage || !filters.triage || matchesTriage(form, filters.triage);

        return matchesSearch && matchesConsultant && matchesDateFrom && matchesDateTo && matchesTriageFilter;
    });
}

// valor usado na comparação de cada coluna ordenável
function getSortValue(form, key) {
    if (key === "interview") {
        const time = new Date(form.interview_date).getTime();
        // ficha sem data da entrevista vai para o fim da fila crescente, e não para o topo
        // como um 0 faria — ela não tem prazo para vencer
        return isNaN(time) ? Infinity : time;
    }
    if (key === "type") return form.inclusion_type || "";
    if (key === "consultant") return form.consultant_name || "";
    return form.beneficiary_name || "";
}

// ordena uma cópia da lista para não mexer na ordem original de allInterviews
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
        if (comparison === 0 || isNaN(comparison)) return Number(b.id) - Number(a.id);

        return comparison * factor;
    });
}

// reflete a ordenação atual nos cabeçalhos (seta + aria-sort para leitores de tela)
function updateSortIndicators() {
    document.querySelectorAll(".interview-table th.is-sortable").forEach(th => {
        const isActive = th.dataset.sort === currentSort.key;

        th.classList.toggle("is-sorted-asc", isActive && currentSort.dir === "asc");
        th.classList.toggle("is-sorted-desc", isActive && currentSort.dir === "desc");
        th.setAttribute("aria-sort", isActive ? (currentSort.dir === "asc" ? "ascending" : "descending") : "none");
    });
}

// "12 entrevistas" quando não há filtro; "5 de 12 entrevistas" quando há
function updateInterviewCount(shown, total) {
    const counter = document.getElementById("interviewCount");
    const label = total === 1 ? "entrevista" : "entrevistas";

    counter.textContent = shown === total ? `${total} ${label}` : `${shown} de ${total} ${label}`;
}

// aviso do topo: quantas entrevistas venceram e quantas são hoje.
// Conta sobre a lista COMPLETA de propósito — o alerta existe justamente para o que um
// filtro ativo pode estar escondendo do colaborador.
function renderUrgencyAlert() {
    const alert = document.getElementById("urgencyAlert");

    const overdue = allInterviews.filter(form => matchesTriage(form, "overdue")).length;
    const today = allInterviews.filter(form => matchesTriage(form, "today")).length;

    if (overdue === 0 && today === 0) {
        alert.classList.add("is-hidden");
        alert.innerHTML = ``;
        return;
    }

    const parts = [];
    if (overdue > 0) parts.push(overdue === 1 ? "1 entrevista vencida" : `${overdue} entrevistas vencidas`);
    if (today > 0) parts.push(today === 1 ? "1 entrevista hoje" : `${today} entrevistas hoje`);

    alert.classList.remove("is-hidden");
    alert.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M8 1.8l6.2 11.4H1.8L8 1.8z" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/><path d="M8 6.3v3.1" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><circle cx="8" cy="11.3" r=".85" fill="currentColor"/></svg>
        <span>${escapeHtml(parts.join(" · "))} — analise ou reagende antes que passem.</span>
    `;
}

// desenha os atalhos de urgência: "Todos" + um chip por recorte, cada um com a própria contagem
function renderTriageChips(filters) {
    const container = document.getElementById("triageChips");

    // as contagens ignoram o atalho selecionado, senão todos os outros chips zerariam
    const scoped = getFilteredInterviews(filters, { ignoreTriage: true });

    container.innerHTML = TRIAGE_CHIPS.map(chip => {
        const isActive = filters.triage === chip.value;
        const count = chip.value
            ? scoped.filter(form => matchesTriage(form, chip.value)).length
            : scoped.length;

        // vencidas e hoje carregam a cor do alerta mesmo desativadas; o resto fica neutro
        const tone = chip.value === "overdue" ? " forms-status-chip--overdue"
            : chip.value === "today" ? " forms-status-chip--today"
                : "";

        return `
        <button type="button" class="pill forms-status-chip forms-status-chip--plain${tone}${isActive ? " is-active" : ""}"
                data-triage="${escapeHtml(chip.value)}" aria-pressed="${isActive}">
            ${escapeHtml(chip.label)}<span class="forms-status-chip-count">${count}</span>
        </button>`;
    }).join("");
}

// converte o discount_percentage (numeric(5,4): 0.1050 no banco) para "10,5%",
// o mesmo cálculo que formatValue(..., "percentage") faz nos modais
function formatDiscount(value) {
    const percentage = Number(value);
    if (isNaN(percentage)) return "";
    return `${(percentage * 100).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`;
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

    // o texto completo é lido no modal de análise; aqui é só o aviso de que existe
    if (form.schedule_observation) {
        tags.push(`<span class="forms-tag forms-tag--note" title="${escapeHtml(form.schedule_observation)}">Obs. no agendamento</span>`);
    }

    if (tags.length === 0) return `<span class="forms-tag-empty">—</span>`;

    return `<div class="forms-tags">${tags.join("")}</div>`;
}

// renderiza a tabela a partir de uma lista já filtrada e ordenada
function renderAnalyzeInterviewTable(forms, filters) {
    const tbodyAnalyzeInterview = document.getElementById("tbodyAnalyzeInterview");
    tbodyAnalyzeInterview.innerHTML = ``;

    if (forms.length === 0) {
        // sem resultado por causa dos filtros é diferente de não haver entrevista nenhuma
        tbodyAnalyzeInterview.innerHTML = hasActiveFilters(filters)
            ? `<tr class="forms-empty-row"><td colspan="7">
                   <div class="forms-empty-state">
                       <span>Nenhuma entrevista encontrada para os filtros selecionados.</span>
                       <button type="button" class="btn btn--outline btn--sm" id="emptyClearFilters">Limpar filtros</button>
                   </div>
               </td></tr>`
            : `<tr class="forms-empty-row"><td colspan="7">Nenhuma entrevista aguardando análise.</td></tr>`;
        return;
    }

    const formPendingFragment = document.createDocumentFragment();

    forms.forEach(form => {
        const trPendingForm = document.createElement("tr");

        // a linha inteira abre a análise (ver delegação no DOMContentLoaded)
        trPendingForm.dataset.id = form.id;
        trPendingForm.tabIndex = 0;

        const urgency = getUrgency(form);
        if (urgency.key === "overdue") trPendingForm.classList.add("is-overdue");
        if (urgency.key === "today") trPendingForm.classList.add("is-today");

        const cpf = form.beneficiary_cpf ? formatCPF(form.beneficiary_cpf) : "";
        const phone = form.beneficiary_phone ? formatPhone(form.beneficiary_phone) : "";

        // sem permissão para analisar, a role só acompanha a fila
        const rowActions = canAnalyze ? `
                    <button class="icon-btn" title="Reagendar Entrevista" aria-label="Reagendar Entrevista" data-reschedule-form-id="${form.id}">
                        <svg viewBox="0 0 16 16" fill="none"><rect x="2" y="2.5" width="12" height="11" rx="1.3" stroke="currentColor" stroke-width="1.4"/><path d="M2 6h12" stroke="currentColor" stroke-width="1.4"/><path d="M5 1.5v2M11 1.5v2" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/><path d="M8 8.3a2 2 0 1 0 1.9 1.4" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/><path d="M9.7 8.2v1.5H8.2" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/></svg>
                    </button>
                    <button class="icon-btn icon-btn--primary" title="Analisar Entrevista" aria-label="Analisar Entrevista" data-analyze-form-id="${form.id}">
                        <svg viewBox="0 0 16 16" fill="none"><circle cx="6.5" cy="6.5" r="4.5" stroke="currentColor" stroke-width="1.4"/><path d="M10 10l4 4" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>
                    </button>` : "";
        const interviewDate = form.interview_date ? formatDateTimeToBR(form.interview_date) : "—";

        trPendingForm.innerHTML = `
            <td>
                <div class="beneficiary-cell">
                    <span class="beneficiary-cell-name">${escapeHtml(form.beneficiary_name)}</span>
                    <span class="beneficiary-cell-meta">${cpf ? `${escapeHtml(cpf)} · ` : ""}#${escapeHtml(form.id)}</span>
                </div>
            </td>
            <td class="forms-cell-interview">
                <div class="forms-cell-stack">
                    <span class="forms-cell-stack-name">${escapeHtml(interviewDate)}</span>
                    <span class="forms-tag ${urgency.variant}">${escapeHtml(urgency.label)}</span>
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
            <td class="forms-cell-flags">${renderFormTags(form)}</td>
            <td class="actions-column">
                <div class="table-actions">${rowActions}</div>
            </td>
        `;

        formPendingFragment.appendChild(trPendingForm);
    });

    tbodyAnalyzeInterview.appendChild(formPendingFragment);
}

// aplica os filtros, reordena e re-renderiza tudo que depende deles
function applyFilters() {
    const filters = getActiveFilters();
    const filtered = getFilteredInterviews(filters);

    renderUrgencyAlert();
    renderTriageChips(filters);
    renderAnalyzeInterviewTable(sortForms(filtered), filters);
    updateSortIndicators();
    updateInterviewCount(filtered.length, allInterviews.length);

    document.getElementById("filterClear").classList.toggle("is-hidden", !hasActiveFilters(filters));
}

// zera todos os filtros e volta ao estado padrão da listagem
function clearFilters() {
    document.getElementById("filterBeneficiary").value = "";
    document.getElementById("filterConsultant").value = "";
    document.getElementById("filterDateFrom").value = "";
    document.getElementById("filterDateTo").value = "";
    triageFilter = "";
    applyFilters();
}

// função para preencher tabela de formulários aguardando aprovação da entrevista
export async function populateAnalyzeInterviewTable() {
    const tbodyAnalyzeInterview = document.getElementById("tbodyAnalyzeInterview");

    try {
        const response = await fetchWithAuth(`/entrevista-adesao/application-forms/status?status_id=3`);

        if (!response.ok) {
            const errorJSON = await response.json().catch(() => null);
            throw new Error(errorJSON?.message || "Erro ao carregar os formulários");
        }

        allInterviews = await response.json();

        // mantém o cache usado para abrir os modais sem novo request
        pendingFormsById.clear();
        allInterviews.forEach(form => pendingFormsById.set(form.id, form));

        populateFilterOptions(allInterviews);
        applyFilters();
    } catch (error) {
        // sem isso a tabela ficava presa em "Carregando..." e o erro só aparecia no console
        tbodyAnalyzeInterview.innerHTML = `<tr class="forms-empty-row"><td colspan="7">Não foi possível carregar as entrevistas.</td></tr>`;
        notyf.error(error.message || "Houve um erro ao carregar as entrevistas");
    }
}

// abre o modal de análise a partir do id da linha/botão, reaproveitando o cache da listagem
function openAnalyzeById(applicationFormId) {
    // barra também o clique na linha, que abre o mesmo modal do botão escondido
    if (!canAnalyze) return;

    const applicationForm = pendingFormsById.get(Number(applicationFormId));
    if (!applicationForm) return;

    openAnalyzeInterviewModal(applicationForm);
}

document.addEventListener("DOMContentLoaded", async () => {
    const user = await getLoggedUser();
    canAnalyze = ROLES_ANALYZE.includes(user?.role_name);

    populateAnalyzeInterviewTable();

    // ---------- Filtros ----------
    const filterBeneficiary = document.getElementById("filterBeneficiary");
    const filterConsultant = document.getElementById("filterConsultant");
    const filterDateFrom = document.getElementById("filterDateFrom");
    const filterDateTo = document.getElementById("filterDateTo");
    const filterClear = document.getElementById("filterClear");

    // "input" no campo de texto reage a cada tecla; "change" nos selects/datas
    filterBeneficiary.addEventListener("input", applyFilters);
    filterConsultant.addEventListener("change", applyFilters);
    filterDateFrom.addEventListener("change", applyFilters);
    filterDateTo.addEventListener("change", applyFilters);

    filterClear.addEventListener("click", clearFilters);

    // ---------- Atalhos de urgência ----------
    document.getElementById("triageChips").addEventListener("click", (event) => {
        const chip = event.target.closest(".forms-status-chip");
        if (!chip) return;

        triageFilter = chip.dataset.triage;
        applyFilters();
    });

    // ---------- Ordenação (delegação no thead) ----------
    const thead = document.querySelector(".interview-table thead");

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
    const tbodyAnalyzeInterview = document.getElementById("tbodyAnalyzeInterview");

    tbodyAnalyzeInterview.addEventListener("click", (event) => {
        const rescheduleButton = event.target.closest(".icon-btn[data-reschedule-form-id]");
        if (rescheduleButton) {
            const applicationForm = pendingFormsById.get(Number(rescheduleButton.dataset.rescheduleFormId));
            if (applicationForm) openRescheduleInterviewModal(applicationForm);
            return;
        }

        const analyzeButton = event.target.closest(".icon-btn--primary[data-analyze-form-id]");
        if (analyzeButton) {
            openAnalyzeById(analyzeButton.dataset.analyzeFormId);
            return;
        }

        if (event.target.closest("#emptyClearFilters")) {
            clearFilters();
            return;
        }

        // clique em qualquer outro ponto da linha abre a análise, que é a ação primária
        // desta tela; a área dos botões fica de fora para um clique que erra o alvo não
        // abrir o modal errado
        if (event.target.closest(".table-actions")) return;

        const row = event.target.closest("tr[data-id]");
        if (row) openAnalyzeById(row.dataset.id);
    });

    // as linhas são focáveis, então Enter também abre a análise
    tbodyAnalyzeInterview.addEventListener("keydown", (event) => {
        if (event.key !== "Enter") return;

        const row = event.target.closest("tr[data-id]");
        if (row && event.target === row) openAnalyzeById(row.dataset.id);
    });
})
