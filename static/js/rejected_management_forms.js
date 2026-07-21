import { fetchWithAuth } from "./utils/apiHelper.js";
import { formatDateToBR } from "./utils/dateUtils.js";

// função para preencher tabela de formulários reprovados pela gerência
async function populateRejectedManagementFormsTable() {
    try {
        const response = await fetchWithAuth(`/entrevista-adesao/application-forms/status?status_id=11`);

        if (!response.ok) {
            const errorJSON = await response.json().catch(() => null);
            throw new Error(errorJSON?.message || "Erro ao carregar os formulários");
        }

        const rejectedForms = await response.json();

        const tbodyRejected = document.getElementById("tbodyRejectedManagementForms");
        tbodyRejected.innerHTML = ``;

        const rejectedFragment = document.createDocumentFragment();

        rejectedForms.forEach(form => {
            const trRejected = document.createElement("tr");

            trRejected.innerHTML = `
                <td>${form.id}</td>
                <td>${form.beneficiary_name}</td>
                <td>${form.inclusion_type}</td>
                <td>${form.consultant_name}</td>
                <td>${formatDateToBR(form.inclusion_date)}</td>
                <td>
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
    } catch (error) {
        console.log(error)
    }
}

async function requestReanalysis(formId) {
    const response = await fetchWithAuth(`/entrevista-adesao/application_form_management/${formId}/request-reanalysis`, {
        method: "POST",
    });

    if (!response.ok) {
        const errorJSON = await response.json().catch(() => null);
        throw new Error(errorJSON?.message || `Erro ${response.status} ao solicitar reanálise`);
    }
}

async function closeNegotiation(formId) {
    const response = await fetchWithAuth(`/entrevista-adesao/application_form_management/${formId}/close-negotiation`, {
        method: "POST",
    });

    if (!response.ok) {
        const errorJSON = await response.json().catch(() => null);
        throw new Error(errorJSON?.message || `Erro ${response.status} ao encerrar a negociação`);
    }
}

document.addEventListener("DOMContentLoaded", () => {
    populateRejectedManagementFormsTable();

    document.getElementById("tbodyRejectedManagementForms").addEventListener("click", async (event) => {
        const actionButton = event.target.closest("[data-action][data-form-id]");
        if (!actionButton) return;

        const formId = Number(actionButton.dataset.formId);
        const action = actionButton.dataset.action;

        try {
            if (action === "reanalysis") {
                await requestReanalysis(formId);
                notyf.success("Reanálise solicitada com sucesso");
            } else if (action === "close") {
                const confirmed = confirm(`Tem certeza que deseja encerrar a negociação da ficha #${formId}? Essa ação não poderá ser desfeita.`);
                if (!confirmed) return;

                await closeNegotiation(formId);
                notyf.success("Negociação encerrada com sucesso");
            }

            populateRejectedManagementFormsTable();
        } catch (error) {
            notyf.error(error.message || "Houve um erro ao processar a ação");
        }
    });
})
