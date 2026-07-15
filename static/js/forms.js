import { fetchWithAuth } from "./utils/apiHelper.js";
import { formatDateToBR } from "./utils/dateUtils.js";

async function populateFormsTable() {
    try {
        const response = await fetchWithAuth("/entrevista-adesao/application-forms")

        if (!response.ok) {
            const errorJSON = await response.json().catch(() => null);
            throw new Error(errorJSON?.message || "Erro ao carregar os formulários"); 
        }

        const forms = await response.json();

        const tbodyForms = document.getElementById("tbodyForms");
        tbodyForms.innerHTML = ``;
        
        const formsFragment = document.createDocumentFragment();

        forms.forEach(form => {
            const trForms = document.createElement("tr");

            trForms.innerHTML = `
                <td>${form.id}</td>
                <td>${form.beneficiary_name}</td>
                <td>${form.inclusion_type}</td>
                <td>${form.consultant_name}</td>
                <td>${formatDateToBR(form.inclusion_date)}</td>
                <td>${form.form_status_name}</td>
                <td>
                    <button>Visualizar</button>
                    <button>Excluir</button>
                </td>
            `;

            formsFragment.appendChild(trForms);
        });

        tbodyForms.appendChild(formsFragment);

    } catch (error) {
        console.log(error)
    }
}

document.addEventListener("DOMContentLoaded", () => {
    populateFormsTable();
})