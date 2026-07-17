import { fetchWithAuth } from "./utils/apiHelper.js";
import { formatDateToBR } from "./utils/dateUtils.js";
import { openAnalyzeFormModal } from "./approveModals/analyzeFormModal.js";

// guarda os dados completos de cada ficha pendente, pra abrir o modal de análise sem precisar de uma nova requisição
const pendingFormsById = new Map();

// função para preencher tabela de formulários aguardando aprovação financeira
async function populateFormsApproveTable() {
    try {
        const response = await fetchWithAuth(`/entrevista-adesao/application-forms/status?status_id=1`);

        if (!response.ok) {
            const errorJSON = await response.json().catch(() => null);
            throw new Error(errorJSON?.message || "Erro ao carregar os formulários"); 
        }

        const pendingForms = await response.json();

        pendingFormsById.clear();

        const tbodyPending = document.getElementById("tbodyPendingApproval");
        tbodyPending.innerHTML = ``;

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
                        <button class="icon-btn" title="Visualizar" aria-label="Visualizar">
                            <svg viewBox="0 0 16 16" fill="none"><path d="M1 8s2.7-5 7-5 7 5 7 5-2.7 5-7 5-7-5-7-5z" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/><circle cx="8" cy="8" r="2.2" stroke="currentColor" stroke-width="1.4"/></svg>
                        </button>
                        <button class="icon-btn icon-btn--primary" title="Realizar Análise" aria-label="Realizar Análise" data-form-id="${form.id}">
                            <svg viewBox="0 0 16 16" fill="none"><path d="M3 8.5l3 3 7-7" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>
                        </button>
                    </div>
                </td>
            `;

            formPendingFragment.appendChild(trPendingForm);
        });

        tbodyPending.appendChild(formPendingFragment);
    } catch (error) {
        console.log(error)
    }
}

document.addEventListener("DOMContentLoaded", () => {
    populateFormsApproveTable();

    document.getElementById("tbodyPendingApproval").addEventListener("click", (event) => {
        const analyzeButton = event.target.closest(".icon-btn--primary[data-form-id]");
        if (!analyzeButton) return;

        const applicationForm = pendingFormsById.get(Number(analyzeButton.dataset.formId));
        if (!applicationForm) return;

        openAnalyzeFormModal(applicationForm);
    });
})