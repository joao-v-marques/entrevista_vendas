import { fetchWithAuth } from "../utils/apiHelper.js";

const overlay = document.getElementById("viewFormModalOverlay");
const idLabel = document.getElementById("viewFormModalId");
const body = document.getElementById("viewFormModalBody");
const closeButton = document.getElementById("viewFormModalClose");

/* ============================================================
   Helpers de formatação
   ============================================================ */

function escapeHtml(value) {
    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function formatCPF(value) {
    const digits = String(value).replace(/\D/g, "");
    if (digits.length !== 11) return value;
    return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
}

function formatCNPJ(value) {
    const digits = String(value).replace(/\D/g, "");
    if (digits.length !== 14) return value;
    return digits.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
}

// usa getters UTC porque as datas chegam em GMT (padrão do Flask), evitando shift de fuso
function formatDate(value) {
    const date = new Date(value);
    if (isNaN(date.getTime())) return value;

    const day = String(date.getUTCDate()).padStart(2, "0");
    const month = String(date.getUTCMonth() + 1).padStart(2, "0");
    const year = date.getUTCFullYear();

    return `${day}/${month}/${year}`;
}

function formatDateTime(value) {
    const date = new Date(value);
    if (isNaN(date.getTime())) return value;

    const hours = String(date.getUTCHours()).padStart(2, "0");
    const minutes = String(date.getUTCMinutes()).padStart(2, "0");

    return `${formatDate(value)} ${hours}:${minutes}`;
}

function formatBytes(value) {
    if (value === null || value === undefined || value === "") return "";
    const bytes = Number(value);
    if (isNaN(bytes)) return "";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// traduz o tipo de beneficiário armazenado no banco para o rótulo exibido
function formatBeneficiaryType(value) {
    const normalized = String(value).trim().toLowerCase();
    if (normalized === "primary") return "Titular";
    if (normalized === "secondary") return "Dependente";
    return value;
}

function formatValue(value, format) {
    if (value === null || value === undefined || value === "") return "—";

    if (format === "beneficiaryType") return formatBeneficiaryType(value);
    if (format === "date") return formatDate(value);
    if (format === "datetime") return formatDateTime(value);
    if (format === "boolean") return value ? "Sim" : "Não";
    if (format === "percentage") return `${(Number(value) * 100).toFixed(0)}%`;
    if (format === "cpf") return formatCPF(value);
    if (format === "cnpj") return formatCNPJ(value);

    return value;
}

/* ============================================================
   Definição dos campos por seção
   ============================================================ */

const FORM_FIELDS = [
    { label: "ID do Formulário", key: "id" },
    { label: "Status", key: "form_status_name" },
    { label: "Consultor", key: "consultant_name" },
    { label: "Data de Criação", key: "created_at", format: "datetime" },
    { label: "Tipo de Beneficiário", key: "beneficiary_type", format: "beneficiaryType" },
    { label: "Tipo de Inclusão", key: "inclusion_type" },
    { label: "Data de Inclusão", key: "inclusion_date", format: "date" },
    { label: "CNPJ", key: "cnpj", format: "cnpj" },
    { label: "Plano Anterior", key: "previous_plan" },
    { label: "Tipo de Contrato", key: "contract_type" },
    { label: "Tipo de Plano", key: "plan_type" },
    { label: "Modelo da Proposta", key: "model_proposal" },
    { label: "Mês de Vencimento", key: "expiration_month" },
    { label: "PA Digital", key: "is_pa_digital", format: "boolean" },
    { label: "Aeromédico", key: "is_aeromedic", format: "boolean" },
];

const DISCOUNT_FIELDS = [
    { label: "Possui Desconto", key: "is_discount", format: "boolean" },
    { label: "Percentual do Desconto", key: "discount_percentage", format: "percentage" },
    { label: "Observação do Desconto", key: "discount_observation", full: true, pre: true },
];

const BENEFICIARY_FIELDS = [
    { label: "Nome do Beneficiário", key: "beneficiary_name" },
    { label: "CPF", key: "beneficiary_cpf", format: "cpf" },
    { label: "Data de Nascimento", key: "beneficiary_birth_date", format: "date" },
    { label: "Telefone", key: "beneficiary_phone" },
    { label: "E-mail", key: "beneficiary_email" },
    { label: "E-mail de Cobrança", key: "billing_email" },
    { label: "Estado Civil", key: "beneficiary_marital_state" },
    { label: "Beneficiário Principal (titular)", key: "secondary_beneficiary_primary_name" },
    { label: "Parentesco", key: "secondary_beneficiary_kinship" },
];

const PORTABILITY_FIELDS = [
    { label: "Possui Portabilidade", key: "is_portability", format: "boolean" },
    { label: "Portabilidade Aceita", key: "portability_accepted", format: "boolean" },
    { label: "Data de Aceite", key: "portability_accepted_date", format: "date" },
    { label: "Observação da Portabilidade", key: "portability_observation", full: true, pre: true },
];

const OTHER_FIELDS = [
    { label: "Opção de Carência", key: "grace_option" },
    { label: "Observações Especiais", key: "especial_observations", full: true, pre: true },
];

const RESPONSIBLE_FIELDS = [
    { label: "Nome", key: "name" },
    { label: "CPF", key: "cpf", format: "cpf" },
    { label: "Estado Civil", key: "marital_state" },
    { label: "Profissão", key: "profession" },
];

/* ============================================================
   Renderização
   ============================================================ */

function renderInfoItem(source, field) {
    const rawValue = source ? source[field.key] : null;
    const value = formatValue(rawValue, field.format);

    const itemClass = field.full ? "info-item info-item--full" : "info-item";
    const valueClass = field.pre ? "info-value info-value--pre" : "info-value";

    return `
        <div class="${itemClass}">
            <span class="info-label">${escapeHtml(field.label)}</span>
            <span class="${valueClass}">${escapeHtml(value)}</span>
        </div>
    `;
}

function renderInfoGrid(source, fields) {
    return `<div class="info-grid">${fields.map(field => renderInfoItem(source, field)).join("")}</div>`;
}

function renderSection(title, innerHtml) {
    return `
        <section class="modal-section">
            <h3 class="form-section-title">${escapeHtml(title)}</h3>
            ${innerHtml}
        </section>
    `;
}

// pílula de decisão para as etapas de aprovação
function renderDecisionPill(approved) {
    if (approved === true) return `<span class="pill pill--green">Aprovado</span>`;
    if (approved === false) return `<span class="pill pill--red">Reprovado</span>`;
    return `<span class="pill pill--gray">Pendente</span>`;
}

function renderEmptySection(message) {
    return `<p class="empty-section">${escapeHtml(message)}</p>`;
}

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

function renderDocuments(documents) {
    if (!documents || documents.length === 0) {
        return renderSection("Documentos Anexados", renderEmptySection("Nenhum documento anexado."));
    }

    const items = documents.map(document => {
        const size = formatBytes(document.size_bytes);
        const sizeHtml = size ? `<span class="document-item-size">${escapeHtml(size)}</span>` : "";

        return `
            <div class="document-item">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M4 1.5h5L13 5.5V14a.5.5 0 0 1-.5.5h-9A.5.5 0 0 1 3 14V2a.5.5 0 0 1 .5-.5z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/>
                    <path d="M9 1.5V5.5h4" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/>
                </svg>
                <span>${escapeHtml(document.original_filename || "documento")}</span>
                ${sizeHtml}
            </div>
        `;
    }).join("");

    return renderSection("Documentos Anexados", `<div class="documents-list">${items}</div>`);
}

function buildBody(details) {
    const { form, responsibles, approval, interview, management, documents } = details;

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
overlay.addEventListener("click", (event) => {
    if (event.target === overlay) closeModal();
});
document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !overlay.hidden) closeModal();
});
