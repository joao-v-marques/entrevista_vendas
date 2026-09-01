import { fetchWithAuth } from "./utils/apiHelper.js";
import { formatDateToBR, formatDateTimeToBR } from "./utils/dateUtils.js";
import { escapeHtml, formatCPF } from "./utils/detailsView.js";
import { getStatusPillClass } from "./utils/statusPill.js";
import { openViewInterviewModal } from "./completedInterviewModals/viewInterviewModal.js";

// guarda a lista completa carregada do backend; os filtros atuam sobre ela sem novo request
let allInterviews = [];

// esta tela é um histórico, não uma fila: o que se procura aqui é o que aconteceu por
// último, então a ordem padrão é decrescente pela data da entrevista.
let currentSort = { key: "interview", dir: "desc" };

// colunas cujo primeiro clique já faz mais sentido em ordem decrescente
const DESC_FIRST_SORT_KEYS = new Set(["interview"]);

const RESULT_CHIPS = [
    { value: "", label: "Todas", pill: "" },
    { value: "approved", label: "Aprovadas", pill: "pill--green" },
    { value: "rejected", label: "Reprovadas", pill: "pill--red" },
];

// normaliza a data da entrevista (que vem como "Mon, 01 Jan 2001 00:00:00 GMT")
// para "YYYY-MM-DD" em UTC, mesmo formato do <input type="date">
function getInterviewDateISO(interview) {
    if (!interview.interview_date) return "";

    const date = new Date(interview.interview_date);
    if (isNaN(date)) return "";

    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, "0");
    const day = String(date.getUTCDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
}

// preenche um select com os valores distintos presentes nos dados carregados,
// mantendo a opção escolhida quando ela continua existindo após um recarregamento
function populateSelectFromData(selectId, interviews, getValue) {
    const select = document.getElementById(selectId);

    const values = [...new Set(interviews.map(getValue).filter(Boolean))].sort((a, b) => a.localeCompare(b, "pt-BR"));

    const previousValue = select.value;

    select.innerHTML = `<option value="">Todos</option>` +
        values.map(value => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`).join("");

    if (values.includes(previousValue)) select.value = previousValue;
}

function populateFilterOptions(interviews) {
    populateSelectFromData("filterConsultant", interviews, interview => interview.consultant_name);
    populateSelectFromData("filterInterviewer", interviews, interview => interview.interviewer_name);
    populateSelectFromData("filterStatus", interviews, interview => interview.form_status_name);
}

// lê de uma vez os valores dos filtros, já normalizados para a comparação
function getActiveFilters() {
    return {
        search: document.getElementById("filterBeneficiary").value.trim().toLowerCase(),
        consultant: document.getElementById("filterConsultant").value,
        interviewer: document.getElementById("filterInterviewer").value,
        result: document.getElementById("filterResult").value, // "approved", "rejected" ou ""
        status: document.getElementById("filterStatus").value,
        dateFrom: document.getElementById("filterDateFrom").value, // "YYYY-MM-DD" ou ""
        dateTo: document.getElementById("filterDateTo").value,
    };
}

function hasActiveFilters(filters) {
    return Boolean(
        filters.search || filters.consultant || filters.interviewer ||
        filters.result || filters.status || filters.dateFrom || filters.dateTo
    );
}

function matchesResult(interview, result) {
    if (result === "approved") return Boolean(interview.interview_approved);
    if (result === "rejected") return !interview.interview_approved;
    return true;
}

// aplica os filtros sobre allInterviews. `ignoreResult` é usado para contar os chips:
// cada chip mostra quantas entrevistas daquele resultado sobram com os *demais* filtros.
function getFilteredInterviews(filters, { ignoreResult = false } = {}) {
    return allInterviews.filter(interview => {
        // o mesmo campo procura por nome, por CPF (cru e mascarado) e pelo número da ficha,
        // que antes tinha um filtro só para ele
        const cpf = interview.beneficiary_cpf || "";
        const haystack = `${interview.beneficiary_name || ""} ${cpf} ${formatCPF(cpf)} ${interview.application_form_id}`.toLowerCase();
        const matchesSearch = !filters.search || haystack.includes(filters.search);

        const matchesConsultant = !filters.consultant || interview.consultant_name === filters.consultant;
        const matchesInterviewer = !filters.interviewer || interview.interviewer_name === filters.interviewer;
        const matchesStatus = !filters.status || interview.form_status_name === filters.status;
        const matchesResultFilter = ignoreResult || !filters.result || matchesResult(interview, filters.result);

        // período da entrevista: comparação lexicográfica funciona no formato "YYYY-MM-DD",
        // e os dois extremos entram no resultado
        const interviewDate = getInterviewDateISO(interview);
        const matchesDateFrom = !filters.dateFrom || (interviewDate && interviewDate >= filters.dateFrom);
        const matchesDateTo = !filters.dateTo || (interviewDate && interviewDate <= filters.dateTo);

        return matchesSearch && matchesConsultant && matchesInterviewer && matchesStatus
            && matchesResultFilter && matchesDateFrom && matchesDateTo;
    });
}

// valor usado na comparação de cada coluna ordenável
function getSortValue(interview, key) {
    if (key === "interview") {
        const time = new Date(interview.interview_date).getTime();
        return isNaN(time) ? 0 : time;
    }
    if (key === "result") return interview.interview_approved ? 1 : 0;
    if (key === "consultant") return interview.consultant_name || "";
    if (key === "interviewer") return interview.interviewer_name || "";
    if (key === "status") return interview.form_status_name || "";
    return interview.beneficiary_name || "";
}

// ordena uma cópia da lista para não mexer na ordem original de allInterviews
function sortForms(interviews) {
    const { key, dir } = currentSort;
    const factor = dir === "desc" ? -1 : 1;

    return [...interviews].sort((a, b) => {
        const valueA = getSortValue(a, key);
        const valueB = getSortValue(b, key);

        const comparison = typeof valueA === "number"
            ? valueA - valueB
            : String(valueA).localeCompare(String(valueB), "pt-BR", { sensitivity: "base" });

        // empate cai para a ficha mais recente, para a ordem não ficar instável entre renders
        if (comparison === 0) return Number(b.application_form_id) - Number(a.application_form_id);

        return comparison * factor;
    });
}

// reflete a ordenação atual nos cabeçalhos (seta + aria-sort para leitores de tela)
function updateSortIndicators() {
    document.querySelectorAll(".completed-table th.is-sortable").forEach(th => {
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

// desenha os atalhos de resultado. Como na /fichas, os chips são só um atalho:
// quem guarda o resultado escolhido continua sendo o select do painel de filtros.
function renderResultChips(filters) {
    const container = document.getElementById("resultChips");

    // as contagens ignoram o resultado selecionado, senão os outros chips zerariam
    const scoped = getFilteredInterviews(filters, { ignoreResult: true });

    container.innerHTML = RESULT_CHIPS.map(chip => {
        const isActive = filters.result === chip.value;
        const count = chip.value
            ? scoped.filter(interview => matchesResult(interview, chip.value)).length
            : scoped.length;

        // o chip "Todas" não representa um resultado, então não recebe o ponto colorido
        const classes = ["pill", chip.pill, "forms-status-chip", chip.value ? "" : "forms-status-chip--all", isActive ? "is-active" : ""]
            .filter(Boolean)
            .join(" ");

        return `
        <button type="button" class="${classes}" data-result="${escapeHtml(chip.value)}" aria-pressed="${isActive}">
            ${escapeHtml(chip.label)}<span class="forms-status-chip-count">${count}</span>
        </button>`;
    }).join("");
}

// renderiza a tabela a partir de uma lista já filtrada e ordenada
function renderCompletedInterviewsTable(interviews, filters) {
    const tbodyCompletedInterviews = document.getElementById("tbodyCompletedInterviews");
    tbodyCompletedInterviews.innerHTML = ``;

    if (interviews.length === 0) {
        // sem resultado por causa dos filtros é diferente de não haver entrevista nenhuma
        tbodyCompletedInterviews.innerHTML = hasActiveFilters(filters)
            ? `<tr class="forms-empty-row"><td colspan="7">
                   <div class="forms-empty-state">
                       <span>Nenhuma entrevista encontrada para os filtros selecionados.</span>
                       <button type="button" class="btn btn--outline btn--sm" id="emptyClearFilters">Limpar filtros</button>
                   </div>
               </td></tr>`
            : `<tr class="forms-empty-row"><td colspan="7">Nenhuma entrevista realizada até o momento.</td></tr>`;
        return;
    }

    const interviewsFragment = document.createDocumentFragment();

    interviews.forEach(interview => {
        const trInterview = document.createElement("tr");

        // a linha inteira abre a visualização (ver delegação no DOMContentLoaded)
        trInterview.dataset.id = interview.application_form_id;
        trInterview.tabIndex = 0;

        // o resultado usa o mesmo sistema de pills dos status de ficha (global.css)
        const resultPill = interview.interview_approved
            ? `<span class="pill pill--green">Aprovada</span>`
            : `<span class="pill pill--red">Reprovada</span>`;

        const cpf = interview.beneficiary_cpf ? formatCPF(interview.beneficiary_cpf) : "";
        const reviewedAt = interview.interview_reviewed_at ? formatDateToBR(interview.interview_reviewed_at) : "";

        // Entrevista já registrada não pode ser editada, por isso não há ação de edição aqui.
        trInterview.innerHTML = `
            <td>
                <div class="beneficiary-cell">
                    <span class="beneficiary-cell-name">${escapeHtml(interview.beneficiary_name)}</span>
                    <span class="beneficiary-cell-meta">${cpf ? `${escapeHtml(cpf)} · ` : ""}#${escapeHtml(interview.application_form_id)}</span>
                </div>
            </td>
            <td class="forms-cell-interview">
                <div class="forms-cell-stack">
                    <span class="forms-cell-stack-name">${escapeHtml(formatDateTimeToBR(interview.interview_date))}</span>
                    <span class="forms-cell-stack-meta">${reviewedAt ? `analisada em ${escapeHtml(reviewedAt)}` : ""}</span>
                </div>
            </td>
            <td class="forms-cell-consultant">${escapeHtml(interview.consultant_name)}</td>
            <td class="forms-cell-interviewer">${interview.interviewer_name ? escapeHtml(interview.interviewer_name) : "—"}</td>
            <td class="forms-cell-result">${resultPill}</td>
            <td class="status-column">
                <span class="pill ${getStatusPillClass(interview.form_status_name)}">${escapeHtml(interview.form_status_name)}</span>
            </td>
            <td class="actions-column">
                <div class="table-actions">
                    <button class="icon-btn icon-btn--primary" title="Visualizar Entrevista" aria-label="Visualizar Entrevista" data-view-form-id="${interview.application_form_id}">
                        <svg viewBox="0 0 16 16" fill="none"><path d="M1.5 8s2.4-4.2 6.5-4.2S14.5 8 14.5 8s-2.4 4.2-6.5 4.2S1.5 8 1.5 8z" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/><circle cx="8" cy="8" r="1.9" stroke="currentColor" stroke-width="1.4"/></svg>
                    </button>
                    <button class="icon-btn" title="Baixar PDF da Entrevista" aria-label="Baixar PDF da Entrevista" data-pdf-form-id="${interview.application_form_id}">
                        <svg viewBox="0 0 16 16" fill="none"><path d="M8 2v7.5M5 7l3 3 3-3" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/><path d="M2.8 13h10.4" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>
                    </button>
                </div>
            </td>
        `;

        interviewsFragment.appendChild(trInterview);
    });

    tbodyCompletedInterviews.appendChild(interviewsFragment);
}

// aplica os filtros, reordena e re-renderiza tudo que depende deles
function applyFilters() {
    const filters = getActiveFilters();
    const filtered = getFilteredInterviews(filters);

    renderResultChips(filters);
    renderCompletedInterviewsTable(sortForms(filtered), filters);
    updateSortIndicators();
    updateInterviewCount(filtered.length, allInterviews.length);

    document.getElementById("filterClear").classList.toggle("is-hidden", !hasActiveFilters(filters));
}

// zera todos os filtros e volta ao estado padrão da listagem
function clearFilters() {
    document.getElementById("filterBeneficiary").value = "";
    document.getElementById("filterConsultant").value = "";
    document.getElementById("filterInterviewer").value = "";
    document.getElementById("filterResult").value = "";
    document.getElementById("filterStatus").value = "";
    document.getElementById("filterDateFrom").value = "";
    document.getElementById("filterDateTo").value = "";
    applyFilters();
}

// função para preencher a tabela com todas as entrevistas já analisadas
export async function populateCompletedInterviewsTable() {
    const tbodyCompletedInterviews = document.getElementById("tbodyCompletedInterviews");

    try {
        const response = await fetchWithAuth(`/entrevista-adesao/application-form-interviews/completed`);

        if (!response.ok) {
            const errorJSON = await response.json().catch(() => null);
            throw new Error(errorJSON?.message || "Erro ao carregar as entrevistas realizadas");
        }

        allInterviews = await response.json();

        populateFilterOptions(allInterviews);
        applyFilters();
    } catch (error) {
        // sem isso o corpo da tabela ficava vazio e a tela não explicava nada depois que o toast sumia
        tbodyCompletedInterviews.innerHTML = `<tr class="forms-empty-row"><td colspan="7">Não foi possível carregar as entrevistas realizadas.</td></tr>`;
        notyf.error(error.message || "Não foi possível carregar as entrevistas realizadas.");
    }
}

// Baixa o PDF da entrevista. O documento é gerado sob demanda no servidor, o que leva alguns
// instantes, então o botão trava enquanto isso para não disparar duas gerações.
async function downloadInterviewDocument(button) {
    button.disabled = true;

    try {
        const applicationFormId = Number(button.dataset.pdfFormId);
        const response = await fetchWithAuth(`/entrevista-adesao/application-form-interviews/${applicationFormId}/document`);

        if (!response.ok) {
            const errorJSON = await response.json().catch(() => null);
            throw new Error(errorJSON?.message || "Erro ao gerar o documento da entrevista");
        }

        // o nome do arquivo vem no Content-Disposition montado pelo backend
        const disposition = response.headers.get("Content-Disposition") || "";
        const suggestedName = disposition.match(/filename\*?=(?:UTF-8'')?"?([^";]+)"?/i)?.[1];

        const blob = await response.blob();
        const url = URL.createObjectURL(blob);

        const link = document.createElement("a");
        link.href = url;
        link.download = decodeURIComponent(suggestedName || `entrevista_${applicationFormId}.pdf`);
        document.body.appendChild(link);
        link.click();
        link.remove();

        // libera a memória do blob depois que o navegador iniciou o download
        URL.revokeObjectURL(url);
    } catch (error) {
        console.error(error);
        notyf.error(error.message || "Não foi possível gerar o documento da entrevista.");
    } finally {
        button.disabled = false;
    }
}

document.addEventListener("DOMContentLoaded", () => {
    populateCompletedInterviewsTable();

    // ---------- Filtros ----------
    const filterBeneficiary = document.getElementById("filterBeneficiary");
    const filterConsultant = document.getElementById("filterConsultant");
    const filterInterviewer = document.getElementById("filterInterviewer");
    const filterResult = document.getElementById("filterResult");
    const filterStatus = document.getElementById("filterStatus");
    const filterDateFrom = document.getElementById("filterDateFrom");
    const filterDateTo = document.getElementById("filterDateTo");
    const filterClear = document.getElementById("filterClear");

    // "input" no campo de texto reage a cada tecla; "change" nos selects/datas
    filterBeneficiary.addEventListener("input", applyFilters);
    filterConsultant.addEventListener("change", applyFilters);
    filterInterviewer.addEventListener("change", applyFilters);
    filterResult.addEventListener("change", applyFilters);
    filterStatus.addEventListener("change", applyFilters);
    filterDateFrom.addEventListener("change", applyFilters);
    filterDateTo.addEventListener("change", applyFilters);

    filterClear.addEventListener("click", clearFilters);

    // ---------- Atalhos de resultado ----------
    // os chips são só um atalho: quem guarda o resultado escolhido continua sendo o select
    document.getElementById("resultChips").addEventListener("click", (event) => {
        const chip = event.target.closest(".forms-status-chip");
        if (!chip) return;

        filterResult.value = chip.dataset.result;
        applyFilters();
    });

    // ---------- Ordenação (delegação no thead) ----------
    const thead = document.querySelector(".completed-table thead");

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
    const tbodyCompletedInterviews = document.getElementById("tbodyCompletedInterviews");

    tbodyCompletedInterviews.addEventListener("click", (event) => {
        // os dois botões são .icon-btn, então o que separa um do outro é o data-* específico
        const viewButton = event.target.closest(".icon-btn[data-view-form-id]");
        if (viewButton) {
            openViewInterviewModal(Number(viewButton.dataset.viewFormId));
            return;
        }

        const pdfButton = event.target.closest(".icon-btn[data-pdf-form-id]");
        if (pdfButton) {
            downloadInterviewDocument(pdfButton);
            return;
        }

        if (event.target.closest("#emptyClearFilters")) {
            clearFilters();
            return;
        }

        // clique em qualquer outro ponto da linha abre a visualização; a área dos botões
        // fica de fora para um clique que erra o alvo não abrir o modal
        if (event.target.closest(".table-actions")) return;

        const row = event.target.closest("tr[data-id]");
        if (row) openViewInterviewModal(Number(row.dataset.id));
    });

    // as linhas são focáveis, então Enter também abre a visualização
    tbodyCompletedInterviews.addEventListener("keydown", (event) => {
        if (event.key !== "Enter") return;

        const row = event.target.closest("tr[data-id]");
        if (row && event.target === row) openViewInterviewModal(Number(row.dataset.id));
    });
})
