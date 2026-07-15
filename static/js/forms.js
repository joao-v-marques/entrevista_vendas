import { fetchWithAuth } from "./utils/apiHelper.js";
import { formatDateToBR } from "./utils/dateUtils.js";

// mapeia cada form_status.name pra um variant de .pill (ver static/css/global.css)
const STATUS_PILL_CLASSES = {
    "Aguardando aprovação financeira": "pill--gray",
    "Aguardando Agendamento de Entrevista": "pill--blue",
    "Aguardando Aprovação da Entrevista": "pill--purple",
    "Aguardando Aprovação da Gerência": "pill--amber",
    "Aguardando Cadastro no Backoffice": "pill--teal",
    "Finalizado": "pill--green",
};

function getStatusPillClass(statusName) {
    return STATUS_PILL_CLASSES[statusName] || "pill--gray";
}

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
                <td class="status-column">
                    <span class="pill ${getStatusPillClass(form.form_status_name)}">${form.form_status_name}</span>
                </td>
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