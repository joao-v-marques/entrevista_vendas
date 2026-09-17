import { fetchWithAuth } from "../utils/apiHelper.js";
import {
    escapeHtml,
    renderInfoGrid,
    renderSection,
    renderDecisionPill,
    renderEmptySection,
} from "../utils/detailsView.js";
import { renderQualifyInterviewBody, renderInterviewObservations } from "../utils/qualifyInterviewView.js";
import { bindOverlayDismiss } from "../utils/modalOverlay.js";

const overlay = document.getElementById("viewInterviewModalOverlay");
const idLabel = document.getElementById("viewInterviewModalId");
const body = document.getElementById("viewInterviewModalBody");
const closeButton = document.getElementById("viewInterviewModalClose");

/* ============================================================
   Definição dos campos por seção
   ============================================================ */

const BENEFICIARY_FIELDS = [
    { label: "Nome do Beneficiário", key: "beneficiary_name" },
    { label: "CPF", key: "beneficiary_cpf", format: "cpf" },
    { label: "Data de Nascimento", key: "beneficiary_birth_date", format: "date" },
    { label: "Estado Civil", key: "beneficiary_marital_state" },
    { label: "Telefone", key: "beneficiary_phone" },
    { label: "E-mail", key: "beneficiary_email" },
    { label: "E-mail de Cobrança", key: "billing_email" },
    { label: "Tipo de Beneficiário", key: "beneficiary_type", format: "beneficiaryType" },
    { label: "Beneficiário Principal (titular)", key: "secondary_beneficiary_primary_name" },
    { label: "Parentesco", key: "secondary_beneficiary_kinship" },
];

const CONTRACT_FIELDS = [
    { label: "Tipo de Inclusão", key: "inclusion_type" },
    { label: "Data de Inclusão", key: "inclusion_date", format: "date" },
    { label: "CNPJ", key: "cnpj", format: "cnpj" },
    { label: "Tipo de Contrato", key: "contract_type" },
    { label: "Tipo de Plano", key: "plan_type" },
    { label: "Modelo da Proposta", key: "model_proposal" },
    { label: "Mês de Vencimento", key: "expiration_month" },
    { label: "Plano Anterior", key: "previous_plan" },
    { label: "Opção de Carência", key: "grace_option" },
    { label: "PA Digital", key: "is_pa_digital", format: "boolean" },
    { label: "Aeromédico", key: "is_aeromedic", format: "boolean" },
    { label: "Possui Desconto", key: "is_discount", format: "boolean" },
    { label: "Percentual do Desconto", key: "discount_percentage", format: "percentage" },
    { label: "Possui Portabilidade", key: "is_portability", format: "boolean" },
    { label: "Portabilidade Aceita", key: "portability_accepted", format: "boolean" },
];

const RESPONSIBLE_FIELDS = [
    { label: "Nome", key: "name" },
    { label: "CPF", key: "cpf", format: "cpf" },
    { label: "Estado Civil", key: "marital_state" },
    { label: "Profissão", key: "profession" },
];

const INTERVIEW_FIELDS = [
    { label: "Data da Entrevista", key: "interview_date", format: "datetime" },
    { label: "Entrevistador", key: "interviewer_name" },
    { label: "Analisada em", key: "interview_reviewed_at", format: "datetime" },
];

const CONSULTANT_FIELDS = [
    { label: "Consultor que cadastrou", key: "consultant_name" },
    { label: "Ficha criada em", key: "created_at", format: "datetime" },
    { label: "Status atual da ficha", key: "form_status_name" },
];

/* ============================================================
   Entrevista qualificada
   ============================================================ */

function renderQualifyInterview(qualifyInterview) {
    return renderSection("Entrevista Qualificada", renderQualifyInterviewBody(qualifyInterview));
}

/* ============================================================
   Demais seções
   ============================================================ */

// a ficha tem no máximo um responsável pela inclusão, então não há numeração nem lista
function renderResponsible(responsibles) {
    const responsible = responsibles?.[0];

    if (!responsible) {
        return renderSection("Responsável pela Inclusão", renderEmptySection("Nenhum responsável pela inclusão cadastrado."));
    }

    return renderSection("Responsável pela Inclusão", renderInfoGrid(responsible, RESPONSIBLE_FIELDS));
}

function renderInterview(interview) {
    if (!interview) {
        return renderSection("Dados da Entrevista", renderEmptySection("Entrevista não encontrada."));
    }

    const inner = `
        <div class="approval-decision">${renderDecisionPill(interview.interview_approved)}</div>
        ${renderInfoGrid(interview, INTERVIEW_FIELDS)}
    `;

    return renderSection("Dados da Entrevista", inner);
}

// dados do consultor seguidos das observações da entrevista, cada uma identificada pela etapa
function renderConsultantAndObservations(form, interview, qualifyInterview) {
    const inner = `
        ${renderInfoGrid(form, CONSULTANT_FIELDS)}
        ${renderInterviewObservations(interview, qualifyInterview)}
    `;

    return renderSection("Consultor e Observações", inner);
}

function buildBody(details) {
    const { form, responsibles, interview, qualify_interview } = details;

    return [
        renderSection("Dados do Beneficiário", renderInfoGrid(form, BENEFICIARY_FIELDS)),
        renderSection("Plano e Contrato", renderInfoGrid(form, CONTRACT_FIELDS)),
        renderResponsible(responsibles),
        renderInterview(interview),
        renderQualifyInterview(qualify_interview),
        renderConsultantAndObservations(form, interview, qualify_interview),
    ].join("");
}

/* ============================================================
   Controle do modal
   ============================================================ */

function closeModal() {
    overlay.hidden = true;
    body.innerHTML = "";
}

// recebe o id da FICHA, que é o que o endpoint de detalhes entende
export async function openViewInterviewModal(applicationFormId) {
    idLabel.textContent = applicationFormId;
    body.innerHTML = `<p class="modal-loading">Carregando informações...</p>`;
    overlay.hidden = false;

    try {
        const response = await fetchWithAuth(`/entrevista-adesao/application-forms/${applicationFormId}/details`);

        if (!response.ok) {
            const errorJSON = await response.json().catch(() => null);
            throw new Error(errorJSON?.message || "Erro ao carregar as informações da entrevista");
        }

        const details = await response.json();
        body.innerHTML = buildBody(details);
    } catch (error) {
        body.innerHTML = `<p class="modal-error">${escapeHtml(error.message || "Erro ao carregar as informações da entrevista")}</p>`;
        notyf.error(error.message || "Houve um erro ao carregar as informações da entrevista");
    }
}

closeButton.addEventListener("click", closeModal);
bindOverlayDismiss(overlay, closeModal);
document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !overlay.hidden) closeModal();
});
