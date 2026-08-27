import { fetchWithAuth } from "./utils/apiHelper.js";
import { formatDateToBR } from "./utils/dateUtils.js";
import { openViewInterviewModal } from "./completedInterviewModals/viewInterviewModal.js";

// guarda a lista completa carregada do backend; os filtros atuam sobre ela sem novo request
let allInterviews = [];

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
        values.map(value => `<option value="${value}">${value}</option>`).join("");

    if (values.includes(previousValue)) select.value = previousValue;
}

function populateFilterOptions(interviews) {
    populateSelectFromData("filterConsultant", interviews, interview => interview.consultant_name);
    populateSelectFromData("filterInterviewer", interviews, interview => interview.interviewer_name);
}

// aplica os filtros ativos sobre allInterviews e retorna apenas as entrevistas correspondentes
function getFilteredInterviews() {
    const id = document.getElementById("filterId").value.trim();
    const beneficiary = document.getElementById("filterBeneficiary").value.trim().toLowerCase();
    const consultant = document.getElementById("filterConsultant").value;
    const interviewer = document.getElementById("filterInterviewer").value;
    const result = document.getElementById("filterResult").value; // "approved", "rejected" ou ""
    const date = document.getElementById("filterDate").value; // "YYYY-MM-DD" ou ""

    return allInterviews.filter(interview => {
        // o número exibido é o da ficha, não o da entrevista
        const matchesId = !id || String(interview.application_form_id).includes(id);

        // o mesmo campo procura por nome e por CPF, pra não precisar de dois filtros
        const matchesBeneficiary = !beneficiary
            || (interview.beneficiary_name || "").toLowerCase().includes(beneficiary)
            || (interview.beneficiary_cpf || "").toLowerCase().includes(beneficiary);

        const matchesConsultant = !consultant || interview.consultant_name === consultant;
        const matchesInterviewer = !interviewer || interview.interviewer_name === interviewer;
        const matchesResult = !result || (result === "approved" ? interview.interview_approved : !interview.interview_approved);
        const matchesDate = !date || getInterviewDateISO(interview) === date;

        return matchesId && matchesBeneficiary && matchesConsultant && matchesInterviewer && matchesResult && matchesDate;
    });
}

// renderiza a tabela a partir de uma lista já filtrada
function renderCompletedInterviewsTable(interviews) {
    const tbodyCompletedInterviews = document.getElementById("tbodyCompletedInterviews");
    tbodyCompletedInterviews.innerHTML = ``;

    if (interviews.length === 0) {
        tbodyCompletedInterviews.innerHTML = `<tr class="forms-empty-row"><td colspan="7">Nenhuma entrevista encontrada para os filtros selecionados.</td></tr>`;
        return;
    }

    const interviewsFragment = document.createDocumentFragment();

    interviews.forEach(interview => {
        const trInterview = document.createElement("tr");

        // o resultado usa o mesmo sistema de pills dos status de ficha (global.css)
        const resultPill = interview.interview_approved
            ? `<span class="pill pill--green">Aprovada</span>`
            : `<span class="pill pill--red">Reprovada</span>`;

        // Entrevista já registrada não pode ser editada, por isso não há ação de edição aqui.
        trInterview.innerHTML = `
            <td>${interview.application_form_id}</td>
            <td>${interview.beneficiary_name}</td>
            <td>${interview.consultant_name}</td>
            <td>${interview.interviewer_name || "—"}</td>
            <td>${formatDateToBR(interview.interview_date)}</td>
            <td class="status-column">${resultPill}</td>
            <td>
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

// aplica os filtros e re-renderiza a tabela
function applyFilters() {
    renderCompletedInterviewsTable(getFilteredInterviews());
}

// função para preencher a tabela com todas as entrevistas já analisadas
export async function populateCompletedInterviewsTable() {
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
        console.error(error);
        notyf.error("Não foi possível carregar as entrevistas realizadas.");
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

    // liga os filtros: reaplica a cada digitação/alteração e limpa todos de uma vez
    const filterId = document.getElementById("filterId");
    const filterBeneficiary = document.getElementById("filterBeneficiary");
    const filterConsultant = document.getElementById("filterConsultant");
    const filterInterviewer = document.getElementById("filterInterviewer");
    const filterResult = document.getElementById("filterResult");
    const filterDate = document.getElementById("filterDate");
    const filterClear = document.getElementById("filterClear");

    filterId.addEventListener("input", applyFilters);
    filterBeneficiary.addEventListener("input", applyFilters);
    filterConsultant.addEventListener("change", applyFilters);
    filterInterviewer.addEventListener("change", applyFilters);
    filterResult.addEventListener("change", applyFilters);
    filterDate.addEventListener("change", applyFilters);

    filterClear.addEventListener("click", () => {
        filterId.value = "";
        filterBeneficiary.value = "";
        filterConsultant.value = "";
        filterInterviewer.value = "";
        filterResult.value = "";
        filterDate.value = "";
        applyFilters();
    });

    document.getElementById("tbodyCompletedInterviews").addEventListener("click", (event) => {
        const viewButton = event.target.closest(".icon-btn[data-view-form-id]");
        if (viewButton) {
            openViewInterviewModal(Number(viewButton.dataset.viewFormId));
            return;
        }

        const pdfButton = event.target.closest(".icon-btn[data-pdf-form-id]");
        if (pdfButton) downloadInterviewDocument(pdfButton);
    });
})
