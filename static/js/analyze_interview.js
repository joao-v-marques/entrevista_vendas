import { fetchWithAuth } from "./utils/apiHelper.js";
import { formatDateToBR } from "./utils/dateUtils.js";
import { openRescheduleInterviewModal } from "./scheduleModals/rescheduleInterviewModal.js";
import { openAnalyzeInterviewModal } from "./analyzeInterviewModals/analyzeInterviewModal.js";

// guarda os dados completos de cada ficha aguardando análise, pra abrir o modal sem precisar de uma nova requisição
const pendingFormsById = new Map();

// guarda a lista completa carregada do backend; os filtros atuam sobre ela sem novo request
let allInterviews = [];

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

// preenche o select de consultor com os valores presentes nos dados carregados
function populateFilterOptions(forms) {
    const consultantSelect = document.getElementById("filterConsultant");

    const consultants = [...new Set(forms.map(form => form.consultant_name).filter(Boolean))].sort((a, b) => a.localeCompare(b, "pt-BR"));

    // mantém o valor selecionado ao recarregar a lista
    const previousConsultant = consultantSelect.value;

    consultantSelect.innerHTML = `<option value="">Todos</option>` +
        consultants.map(consultant => `<option value="${consultant}">${consultant}</option>`).join("");

    if (consultants.includes(previousConsultant)) consultantSelect.value = previousConsultant;
}

// aplica os filtros ativos sobre allInterviews e retorna apenas as fichas correspondentes
function getFilteredInterviews() {
    const id = document.getElementById("filterId").value.trim();
    const beneficiary = document.getElementById("filterBeneficiary").value.trim().toLowerCase();
    const consultant = document.getElementById("filterConsultant").value;
    const date = document.getElementById("filterDate").value; // "YYYY-MM-DD" ou ""

    return allInterviews.filter(form => {
        // ID: busca por trecho no número da ficha
        const matchesId = !id || String(form.id).includes(id);
        // beneficiário: busca por trecho, ignorando maiúsculas/minúsculas
        const matchesBeneficiary = !beneficiary || (form.beneficiary_name || "").toLowerCase().includes(beneficiary);
        const matchesConsultant = !consultant || form.consultant_name === consultant;
        const matchesDate = !date || getInterviewDateISO(form) === date;

        return matchesId && matchesBeneficiary && matchesConsultant && matchesDate;
    });
}

// renderiza a tabela a partir de uma lista já filtrada
function renderAnalyzeInterviewTable(forms) {
    const tbodyAnalyzeInterview = document.getElementById("tbodyAnalyzeInterview");
    tbodyAnalyzeInterview.innerHTML = ``;

    if (forms.length === 0) {
        tbodyAnalyzeInterview.innerHTML = `<tr class="forms-empty-row"><td colspan="6">Nenhuma ficha encontrada para os filtros selecionados.</td></tr>`;
        return;
    }

    const formPendingFragment = document.createDocumentFragment();

    forms.forEach(form => {
        const trPendingForm = document.createElement("tr");

        trPendingForm.innerHTML = `
            <td>${form.id}</td>
            <td>${form.beneficiary_name}</td>
            <td>${form.inclusion_type}</td>
            <td>${form.consultant_name}</td>
            <td>${formatDateToBR(form.interview_date)}</td>
            <td>
                <div class="table-actions">
                    <button class="icon-btn" title="Reagendar Entrevista" aria-label="Reagendar Entrevista" data-reschedule-form-id="${form.id}">
                        <svg viewBox="0 0 16 16" fill="none"><rect x="2" y="2.5" width="12" height="11" rx="1.3" stroke="currentColor" stroke-width="1.4"/><path d="M2 6h12" stroke="currentColor" stroke-width="1.4"/><path d="M5 1.5v2M11 1.5v2" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/><path d="M8 8.3a2 2 0 1 0 1.9 1.4" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/><path d="M9.7 8.2v1.5H8.2" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/></svg>
                    </button>
                    <button class="icon-btn icon-btn--primary" title="Analisar Entrevista" aria-label="Analisar Entrevista" data-analyze-form-id="${form.id}">
                        <svg viewBox="0 0 16 16" fill="none"><circle cx="6.5" cy="6.5" r="4.5" stroke="currentColor" stroke-width="1.4"/><path d="M10 10l4 4" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>
                    </button>
                </div>
            </td>
        `;

        formPendingFragment.appendChild(trPendingForm);
    });

    tbodyAnalyzeInterview.appendChild(formPendingFragment);
}

// aplica os filtros e re-renderiza a tabela
function applyFilters() {
    renderAnalyzeInterviewTable(getFilteredInterviews());
}

// função para preencher tabela de formulários aguardando aprovação da entrevista
export async function populateAnalyzeInterviewTable() {
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
        console.log(error)
    }
}

document.addEventListener("DOMContentLoaded", () => {
    populateAnalyzeInterviewTable();

    // liga os filtros: reaplica a cada digitação/alteração e limpa todos de uma vez
    const filterId = document.getElementById("filterId");
    const filterBeneficiary = document.getElementById("filterBeneficiary");
    const filterConsultant = document.getElementById("filterConsultant");
    const filterDate = document.getElementById("filterDate");
    const filterClear = document.getElementById("filterClear");

    filterId.addEventListener("input", applyFilters);
    filterBeneficiary.addEventListener("input", applyFilters);
    filterConsultant.addEventListener("change", applyFilters);
    filterDate.addEventListener("change", applyFilters);

    filterClear.addEventListener("click", () => {
        filterId.value = "";
        filterBeneficiary.value = "";
        filterConsultant.value = "";
        filterDate.value = "";
        applyFilters();
    });

    document.getElementById("tbodyAnalyzeInterview").addEventListener("click", (event) => {
        const rescheduleButton = event.target.closest(".icon-btn[data-reschedule-form-id]");
        if (rescheduleButton) {
            const applicationForm = pendingFormsById.get(Number(rescheduleButton.dataset.rescheduleFormId));
            if (applicationForm) openRescheduleInterviewModal(applicationForm);
            return;
        }

        const analyzeButton = event.target.closest(".icon-btn--primary[data-analyze-form-id]");
        if (analyzeButton) {
            const applicationForm = pendingFormsById.get(Number(analyzeButton.dataset.analyzeFormId));
            if (applicationForm) openAnalyzeInterviewModal(applicationForm);
            return;
        }
    });
})
