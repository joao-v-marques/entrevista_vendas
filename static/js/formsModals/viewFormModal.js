import { fetchWithAuth } from "../utils/apiHelper.js";
import {
    escapeHtml,
    formatBytes,
    renderInfoGrid,
    renderSection,
    renderDecisionPill,
    renderEmptySection,
} from "../utils/detailsView.js";
import { bindOverlayDismiss } from "../utils/modalOverlay.js";
import { FORM_FIELDS, DISCOUNT_FIELDS, BENEFICIARY_FIELDS, PORTABILITY_FIELDS, OTHER_FIELDS } from "../utils/applicationFormFields.js";

const overlay = document.getElementById("viewFormModalOverlay");
const idLabel = document.getElementById("viewFormModalId");
const body = document.getElementById("viewFormModalBody");
const closeButton = document.getElementById("viewFormModalClose");

/* ============================================================
   Definição dos campos por seção
   ============================================================ */

const RESPONSIBLE_FIELDS = [
    { label: "Nome", key: "name" },
    { label: "CPF", key: "cpf", format: "cpf" },
    { label: "Estado Civil", key: "marital_state" },
    { label: "Profissão", key: "profession" },
];

/* ============================================================
   Renderização
   ============================================================ */

function renderResponsibles(responsibles) {
    if (!responsibles || responsibles.length === 0) {
        return renderSection("Responsáveis pela Inclusão", renderEmptySection("Nenhum responsável pela inclusão cadastrado."));
    }

    const blocks = responsibles.map((responsible, index) => `
        <div class="responsible-block">
            <p class="responsible-block-title">Responsável ${index + 1}</p>
            ${renderInfoGrid(responsible, RESPONSIBLE_FIELDS)}
        </div>
    `).join("");

    return renderSection("Responsáveis pela Inclusão", blocks);
}

function renderFinancial(approval) {
    if (!approval) {
        return renderSection("Aprovação Financeira", renderEmptySection("Etapa ainda não realizada."));
    }

    const fields = [
        { label: "Revisor", key: "financial_reviewer_name" },
        { label: "Revisado em", key: "financial_reviewed_at", format: "datetime" },
        { label: "Observação", key: "financial_observation", full: true, pre: true },
    ];

    const inner = `
        <div class="approval-decision">${renderDecisionPill(approval.financial_approved)}</div>
        ${renderInfoGrid(approval, fields)}
    `;

    return renderSection("Aprovação Financeira", inner);
}

function renderInterview(interview) {
    if (!interview) {
        return renderSection("Entrevista", renderEmptySection("Etapa ainda não realizada."));
    }

    const fields = [
        { label: "Data da Entrevista", key: "interview_date", format: "datetime" },
        { label: "Observação do Agendamento", key: "schedule_observation", full: true, pre: true },
        { label: "Entrevistador", key: "interviewer_name" },
        { label: "Analisada em", key: "interview_reviewed_at", format: "datetime" },
        { label: "Observação da Análise", key: "interview_observation", full: true, pre: true },
    ];

    const inner = `
        <div class="approval-decision">${renderDecisionPill(interview.interview_approved)}</div>
        ${renderInfoGrid(interview, fields)}
    `;

    return renderSection("Entrevista", inner);
}

function renderManagement(management) {
    if (!management) {
        return renderSection("Aprovação da Gerência", renderEmptySection("Etapa ainda não realizada."));
    }

    const fields = [
        { label: "Gerente", key: "manager_name" },
        { label: "Revisado em", key: "management_reviewed_at", format: "datetime" },
        { label: "Observação", key: "management_observation", full: true, pre: true },
    ];

    const inner = `
        <div class="approval-decision">${renderDecisionPill(management.management_approved)}</div>
        ${renderInfoGrid(management, fields)}
    `;

    return renderSection("Aprovação da Gerência", inner);
}

// etapa que reprovou a ficha e gerou a reanálise
const REANALYSIS_STAGE_LABELS = {
    financial: "Financeiro",
    management: "Gerência",
};

// cada rodada de reanálise solicitada após uma reprovação do financeiro ou da gerência
function renderReanalysisRequests(reanalysisRequests) {
    if (!reanalysisRequests || reanalysisRequests.length === 0) {
        return renderSection("Solicitações de Reanálise", renderEmptySection("Nenhuma reanálise solicitada."));
    }

    const fields = [
        { label: "Solicitado por", key: "requester_name" },
        { label: "Solicitado em", key: "requested_at", format: "datetime" },
        { label: "Observação", key: "reanalysis_observation", full: true, pre: true },
    ];

    // a lista vem da mais recente para a mais antiga, por isso a numeração é invertida
    const blocks = reanalysisRequests.map((reanalysisRequest, index) => `
        <div class="responsible-block">
            <p class="responsible-block-title">Reanálise ${reanalysisRequests.length - index} · ${escapeHtml(REANALYSIS_STAGE_LABELS[reanalysisRequest.stage] || "—")}</p>
            ${renderInfoGrid(reanalysisRequest, fields)}
        </div>
    `).join("");

    return renderSection("Solicitações de Reanálise", blocks);
}

function renderDocuments(documents) {
    if (!documents || documents.length === 0) {
        return renderSection("Documentos Anexados", renderEmptySection("Nenhum documento anexado."));
    }

    const items = documents.map(document => {
        const size = formatBytes(document.size_bytes);
        const sizeHtml = size ? `<span class="document-item-size">${escapeHtml(size)}</span>` : "";

        // destaca os laudos enviados nas reanálises, separando-os dos documentos da adesão
        const isMedicalReport = document.document_type === "laudo_medico";
        const tagHtml = isMedicalReport ? `<span class="pill pill--gray">Laudo médico</span>` : "";

        return `
            <div class="document-item">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M4 1.5h5L13 5.5V14a.5.5 0 0 1-.5.5h-9A.5.5 0 0 1 3 14V2a.5.5 0 0 1 .5-.5z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/>
                    <path d="M9 1.5V5.5h4" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/>
                </svg>
                <span>${escapeHtml(document.original_filename || "documento")}</span>
                ${tagHtml}
                ${sizeHtml}
            </div>
        `;
    }).join("");

    return renderSection("Documentos Anexados", `<div class="documents-list">${items}</div>`);
}

function buildBody(details) {
    const { form, responsibles, approval, interview, management, reanalysis_requests, documents } = details;

    return [
        renderSection("Dados do Formulário", renderInfoGrid(form, FORM_FIELDS)),
        renderSection("Desconto", renderInfoGrid(form, DISCOUNT_FIELDS)),
        renderSection("Dados do Beneficiário", renderInfoGrid(form, BENEFICIARY_FIELDS)),
        renderSection("Portabilidade", renderInfoGrid(form, PORTABILITY_FIELDS)),
        renderSection("Outras Informações", renderInfoGrid(form, OTHER_FIELDS)),
        renderResponsibles(responsibles),
        renderFinancial(approval),
        renderInterview(interview),
        renderManagement(management),
        renderReanalysisRequests(reanalysis_requests),
        renderDocuments(documents),
    ].join("");
}

/* ============================================================
   Controle do modal
   ============================================================ */

function closeModal() {
    overlay.hidden = true;
    body.innerHTML = "";
}

export async function openViewFormModal(applicationFormId) {
    idLabel.textContent = applicationFormId;
    body.innerHTML = `<p class="modal-loading">Carregando informações...</p>`;
    overlay.hidden = false;

    try {
        const response = await fetchWithAuth(`/entrevista-adesao/application-forms/${applicationFormId}/details`);

        if (!response.ok) {
            const errorJSON = await response.json().catch(() => null);
            throw new Error(errorJSON?.message || "Erro ao carregar as informações do formulário");
        }

        const details = await response.json();
        body.innerHTML = buildBody(details);
    } catch (error) {
        body.innerHTML = `<p class="modal-error">${escapeHtml(error.message || "Erro ao carregar as informações do formulário")}</p>`;
        notyf.error(error.message || "Houve um erro ao carregar as informações do formulário");
    }
}

closeButton.addEventListener("click", closeModal);
bindOverlayDismiss(overlay, closeModal);
document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !overlay.hidden) closeModal();
});
