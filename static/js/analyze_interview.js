import { fetchWithAuth } from "./utils/apiHelper.js";
import { formatDateToBR } from "./utils/dateUtils.js";
import { openRescheduleInterviewModal } from "./scheduleModals/rescheduleInterviewModal.js";

// guarda os dados completos de cada ficha aguardando análise, pra abrir o modal sem precisar de uma nova requisição
const pendingFormsById = new Map();

// função para preencher tabela de formulários aguardando aprovação da entrevista
async function populateAnalyzeInterviewTable() {
    try {
        const response = await fetchWithAuth(`/entrevista-adesao/application-forms/status?status_id=3`);

        if (!response.ok) {
            const errorJSON = await response.json().catch(() => null);
            throw new Error(errorJSON?.message || "Erro ao carregar os formulários");
        }

        const pendingForms = await response.json();

        pendingFormsById.clear();

        const tbodyAnalyzeInterview = document.getElementById("tbodyAnalyzeInterview");
        tbodyAnalyzeInterview.innerHTML = ``;

        const formPendingFragment = document.createDocumentFragment();

        pendingForms.forEach(form => {
            pendingFormsById.set(form.id, form);

            const trPendingForm = document.createElement("tr");

            trPendingForm.innerHTML = `
                <td>${form.id}</td>
                <td>${form.beneficiary_name}</td>
                <td>${form.inclusion_type}</td>
                <td>${form.consultant_name}</td>
                <td>${formatDateToBR(form.inclusion_date)}</td>
                <td>
                    <div class="table-actions">
                        <button class="icon-btn" title="Reagendar Entrevista" aria-label="Reagendar Entrevista" data-reschedule-form-id="${form.id}">
                            <svg viewBox="0 0 16 16" fill="none"><rect x="2" y="2.5" width="12" height="11" rx="1.3" stroke="currentColor" stroke-width="1.4"/><path d="M2 6h12" stroke="currentColor" stroke-width="1.4"/><path d="M5 1.5v2M11 1.5v2" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/><path d="M8 8.3a2 2 0 1 0 1.9 1.4" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/><path d="M9.7 8.2v1.5H8.2" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/></svg>
                        </button>
                        <button class="icon-btn icon-btn--primary" title="Analisar Entrevista" aria-label="Analisar Entrevista">
                            <svg viewBox="0 0 16 16" fill="none"><circle cx="6.5" cy="6.5" r="4.5" stroke="currentColor" stroke-width="1.4"/><path d="M10 10l4 4" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>
                        </button>
                    </div>
                </td>
            `;

            formPendingFragment.appendChild(trPendingForm);
        });

        tbodyAnalyzeInterview.appendChild(formPendingFragment);
    } catch (error) {
        console.log(error)
    }
}

document.addEventListener("DOMContentLoaded", () => {
    populateAnalyzeInterviewTable();

    document.getElementById("tbodyAnalyzeInterview").addEventListener("click", (event) => {
        const rescheduleButton = event.target.closest(".icon-btn[data-reschedule-form-id]");
        if (!rescheduleButton) return;

        const applicationForm = pendingFormsById.get(Number(rescheduleButton.dataset.rescheduleFormId));
        if (!applicationForm) return;

        openRescheduleInterviewModal(applicationForm);
    });
})
