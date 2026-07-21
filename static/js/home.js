import { fetchWithAuth } from "./utils/apiHelper.js";

// status que representam formulários ainda em andamento (aguardando alguma ação)
const PENDING_STATUS = [
    "Aguardando aprovação financeira",
    "Aguardando Agendamento de Entrevista",
    "Aguardando Aprovação da Entrevista",
    "Aguardando Aprovação da Gerência",
    "Aguardando Cadastro no Backoffice",
];

const FINALIZED_STATUS = "Finalizado";

// verifica se a data de cadastro pertence ao mês/ano atual
function isCurrentMonth(dateString) {
    if (!dateString) return false;

    const date = new Date(dateString);
    const now = new Date();

    return date.getUTCMonth() === now.getUTCMonth()
        && date.getUTCFullYear() === now.getUTCFullYear();
}

async function populateHomeStats() {
    try {
        const response = await fetchWithAuth("/entrevista-adesao/application-forms");

        if (!response.ok) {
            const errorJSON = await response.json().catch(() => null);
            throw new Error(errorJSON?.message || "Erro ao carregar os formulários");
        }

        const forms = await response.json();

        const totalMonth = forms.filter(form => isCurrentMonth(form.created_at)).length;
        const totalPendentes = forms.filter(form => PENDING_STATUS.includes(form.form_status_name)).length;
        const totalFinalizadas = forms.filter(form => form.form_status_name === FINALIZED_STATUS).length;

        document.getElementById("statTotal").textContent = totalMonth;
        document.getElementById("statPendentes").textContent = totalPendentes;
        document.getElementById("statFinalizadas").textContent = totalFinalizadas;
    } catch (error) {
        console.log(error);
    }
}

document.addEventListener("DOMContentLoaded", () => {
    populateHomeStats();
});
