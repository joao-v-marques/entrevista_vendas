import { fetchWithAuth } from "./utils/apiHelper.js";
import { formatDateToBR } from "./utils/dateUtils.js";

// função para preencher tabela de formulários aguardando aprovação financeira
async function populateFormsApproveTable() {
    try {
        const response = await fetchWithAuth(`/entrevista-adesao/application-forms/status?status_id=1`);

        if (!response.ok) {
            const errorJSON = await response.json().catch(() => null);
            throw new Error(errorJSON?.message || "Erro ao carregar os formulários"); 
        }

        const pendingForms = await response.json();

        const tbodyPending = document.getElementById("tbodyPendingApproval");
        tbodyPending.innerHTML = ``;

        const formPendingFragment = document.createDocumentFragment();

        pendingForms.forEach(form => {
            const trPendingForm = document.createElement("tr");

            trPendingForm.innerHTML = `
                <td>${form.id}</td>
                <td>${form.beneficiary_name}</td>
                <td>${form.inclusion_type}</td>
                <td>${form.consultant_name}</td>
                <td>${formatDateToBR(form.inclusion_date)}</td>
                <td>
                    <button>Visualizar</button>
                    <button>Realizar Análise</button>
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
})