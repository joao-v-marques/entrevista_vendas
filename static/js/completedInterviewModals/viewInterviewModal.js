import { fetchWithAuth } from "../utils/apiHelper.js";
import {
    escapeHtml,
    formatValue,
    renderInfoGrid,
    renderSection,
    renderDecisionPill,
    renderEmptySection,
} from "../utils/detailsView.js";
import { QUALIFY_INTERVIEW_GROUPS } from "../analyzeInterviewModals/qualifyInterviewQuestions.js";
import {
    ESCOLHA_MEDICO_ORIENTADOR_LABELS,
    PARECER_UNIMED_LABELS,
    QUALIFY_QUESTIONS,
    formatImc,
} from "../utils/qualifyInterview.js";
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

function formatMeasure(value, unit) {
    if (value === null || value === undefined || value === "") return "—";
    return `${String(value).replace(".", ",")} ${unit}`;
}

// uma linha por pergunta; as respondidas "Sim" ganham destaque por serem o que importa numa consulta
function renderQualifyItem(item, qualifyInterview) {
    if (item.type === "measure") {
        return `
            <div class="view-qualify-item">
                <span class="view-qualify-item-label">${escapeHtml(item.label)}</span>
                <span class="view-qualify-item-answer">${escapeHtml(formatMeasure(qualifyInterview[item.key], item.unit))}</span>
            </div>
        `;
    }

    const answered = qualifyInterview[item.key] === true;

    return `
        <div class="view-qualify-item${answered ? " view-qualify-item--yes" : ""}">
            <span class="view-qualify-item-label">${escapeHtml(item.label)}</span>
            <span class="view-qualify-item-answer">${answered ? "Sim" : "Não"}</span>
        </div>
    `;
}

function renderQualifyGroup(group, qualifyInterview) {
    const declaredCount = group.items.filter(item => item.type !== "measure" && qualifyInterview[item.key] === true).length;

    const statusLabel = declaredCount > 0
        ? `<span class="view-qualify-group-status view-qualify-group-status--yes">${declaredCount} Sim</span>`
        : `<span class="view-qualify-group-status">Nenhuma</span>`;

    const rows = group.items.map(item => renderQualifyItem(item, qualifyInterview)).join("");

    // <details> nativo: o accordion abre e fecha sem nenhum JS de apoio
    return `
        <details class="view-qualify-group"${declaredCount > 0 ? " open" : ""}>
            <summary class="view-qualify-group-summary">
                <span class="view-qualify-group-number">${group.number}</span>
                <span class="view-qualify-group-title">${escapeHtml(group.title)}</span>
                ${statusLabel}
            </summary>
            <div class="view-qualify-group-body">${rows}</div>
        </details>
    `;
}

function renderQualifyInterview(qualifyInterview) {
    if (!qualifyInterview) {
        return renderSection(
            "Entrevista Qualificada",
            renderEmptySection("Nenhuma entrevista qualificada registrada para esta entrevista.")
        );
    }

    const summaryFields = [
        { label: "Parecer da Unimed", key: "parecer_unimed_label", full: true },
        { label: "Médico Orientador", key: "escolha_medico_orientador_label", full: true },
        { label: "Peso", key: "peso_label" },
        { label: "Altura", key: "altura_label" },
        { label: "IMC", key: "imc_label" },
        { label: "Registrado por", key: "inserted_by_name" },
        { label: "Registrado em", key: "created_at", format: "datetime" },
    ];

    // os rótulos legíveis são resolvidos antes para o grid genérico só ter que exibir texto
    const summarySource = {
        ...qualifyInterview,
        parecer_unimed_label: PARECER_UNIMED_LABELS[qualifyInterview.parecer_unimed] || qualifyInterview.parecer_unimed,
        escolha_medico_orientador_label: ESCOLHA_MEDICO_ORIENTADOR_LABELS[qualifyInterview.escolha_medico_orientador] || qualifyInterview.escolha_medico_orientador,
        peso_label: formatMeasure(qualifyInterview.peso_kg, "kg"),
        altura_label: formatMeasure(qualifyInterview.altura_cm, "cm"),
        imc_label: formatImc(qualifyInterview.peso_kg, qualifyInterview.altura_cm),
    };

    const declaredTotal = QUALIFY_QUESTIONS.filter(item => qualifyInterview[item.key] === true).length;

    const counter = `
        <p class="view-qualify-counter">
            <strong>${declaredTotal}</strong> de ${QUALIFY_QUESTIONS.length} perguntas respondidas com "Sim".
            Os grupos com alguma declaração já vêm abertos.
        </p>
    `;

    const groups = QUALIFY_INTERVIEW_GROUPS.map(group => renderQualifyGroup(group, qualifyInterview)).join("");

    const inner = `
        ${renderInfoGrid(summarySource, summaryFields)}
        ${counter}
        <div class="view-qualify-groups">${groups}</div>
    `;

    return renderSection("Entrevista Qualificada", inner);
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

// as três observações da entrevista, cada uma identificada pela etapa em que foi escrita
function renderConsultantAndObservations(form, interview, qualifyInterview) {
    const observations = [
        {
            label: "Observação do agendamento",
            hint: "escrita pelo consultor ao agendar a entrevista",
            value: interview?.schedule_observation,
        },
        {
            label: "Observação do parecer Unimed",
            hint: "vai para o documento, na página do parecer reservado à Unimed",
            value: interview?.interview_observation,
        },
        {
            label: "Observação da entrevista qualificada",
            hint: "vai para o contrato: o beneficiário lê e confirma antes de assinar",
            value: qualifyInterview?.observation,
        },
    ];

    const blocks = observations.map(observation => `
        <div class="view-observation">
            <p class="view-observation-label">${escapeHtml(observation.label)}</p>
            <p class="view-observation-hint">${escapeHtml(observation.hint)}</p>
            <p class="view-observation-text">${escapeHtml(formatValue(observation.value))}</p>
        </div>
    `).join("");

    const inner = `
        ${renderInfoGrid(form, CONSULTANT_FIELDS)}
        <div class="view-observations">${blocks}</div>
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
