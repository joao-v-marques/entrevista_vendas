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
    "Reprovado Pelo Financeiro": "pill--red",
    "Negociação Encerrada Financeiro": "pill--gray",
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
                    <div class="table-actions">
                        <button class="icon-btn" title="Visualizar" aria-label="Visualizar">
                            <svg viewBox="0 0 16 16" fill="none"><path d="M1 8s2.7-5 7-5 7 5 7 5-2.7 5-7 5-7-5-7-5z" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/><circle cx="8" cy="8" r="2.2" stroke="currentColor" stroke-width="1.4"/></svg>
                        </button>
                        <button class="icon-btn" title="Baixar documentos" aria-label="Baixar documentos">
                            <svg viewBox="0 0 16 16" fill="none"><path d="M8 1.5v8.5M8 10l-2.8-2.8M8 10l2.8-2.8" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/><path d="M2.5 12v1.3a1 1 0 001 1h9a1 1 0 001-1V12" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>
                        </button>
                    </div>
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