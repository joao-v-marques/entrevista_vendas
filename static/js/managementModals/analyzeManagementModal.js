import { fetchWithAuth, getLoggedUser } from "../utils/apiHelper.js";
import { populateManagementApproveTable } from "../management_approval.js";
import { getFormSubmitButton, setSubmitLoading } from "../utils/submitLoading.js";
import { bindOverlayDismiss } from "../utils/modalOverlay.js";
import {
    escapeHtml,
    formatValue,
    formatBytes,
    renderInfoGrid,
    renderSection,
    renderDecisionPill,
    renderEmptySection,
    formatAge,
    renderObservationCallout,
    renderCommercialTags,
    renderKpi,
} from "../utils/detailsView.js";
import { createModalTabs } from "../utils/modalTabs.js";
import {
    FORM_FIELDS,
    DISCOUNT_FIELDS,
    BENEFICIARY_FIELDS,
    PORTABILITY_FIELDS,
    OTHER_FIELDS,
} from "../utils/applicationFormFields.js";
import {
    ESCOLHA_MEDICO_ORIENTADOR_LABELS,
    PARECER_UNIMED_LABELS,
    PARECER_UNIMED_PILL_CLASSES,
    PARECER_UNIMED_REFUSED,
    formatImc,
    getDeclaredConditions,
} from "../utils/qualifyInterview.js";
import { renderQualifyInterviewBody, renderInterviewObservations } from "../utils/qualifyInterviewView.js";

const overlay = document.getElementById("analyzeManagementModalOverlay");
const formIdLabel = document.getElementById("analyzeManagementModalFormId");
const subtitleLabel = document.getElementById("analyzeManagementModalSubtitle");
const modalBody = document.getElementById("analyzeManagementModalBody");
const tabList = document.getElementById("managementTabs");
const approvalStatusBanner = document.getElementById("managementApprovalStatusBanner");
const managementApprovalForm = document.getElementById("managementApprovalForm");
const closeButton = document.getElementById("analyzeManagementModalClose");
const cancelButton = document.getElementById("analyzeManagementModalCancel");
const submitButton = document.getElementById("analyzeManagementModalSubmit");
const applicationFormIdInput = document.getElementById("management_application_form_id");
const managerIdInput = document.getElementById("manager_id_input");

// um container por aba; todas são preenchidas de uma vez quando o /details chega
const panels = {
    summary: document.getElementById("managementSummaryContent"),
    beneficiary: document.getElementById("managementBeneficiaryContent"),
    contract: document.getElementById("managementContractContent"),
    interview: document.getElementById("managementInterviewContent"),
    history: document.getElementById("managementHistoryContent"),
    documents: document.getElementById("managementDocumentsContent"),
};

const { setActiveTab, getActiveTab, setTabCount } = createModalTabs(tabList, modalBody);

// cada abertura do modal ganha um número; a resposta do /details só é aplicada se ainda for da
// abertura atual, senão uma ficha lenta aberta antes sobrescreveria a que está na tela
let openRequestId = 0;

const RESPONSIBLE_FIELDS = [
    { label: "Nome", key: "name" },
    { label: "CPF", key: "cpf", format: "cpf" },
    { label: "Estado Civil", key: "marital_state" },
    { label: "Profissão", key: "profession" },
];

const ICON_DOCUMENT = `
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d="M4 1.5h5L13 5.5V14a.5.5 0 0 1-.5.5h-9A.5.5 0 0 1 3 14V2a.5.5 0 0 1 .5-.5z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/>
        <path d="M9 1.5V5.5h4" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/>
    </svg>`;

const ICON_DOWNLOAD = `
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
        <path d="M8 2v8m0 0L5 7m3 3l3-3M3 13h10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`;

const ICON_WARNING = `
    <svg width="18" height="18" viewBox="0 0 16 16" fill="none">
        <path d="M8 1.8l6.5 11.4H1.5L8 1.8z" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/>
        <path d="M8 6.3v3.2M8 11.4v.1" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
    </svg>`;

/* ============================================================
   Helpers
   ============================================================ */

function textOrDash(value) {
    return escapeHtml(formatValue(value));
}

function renderDocumentLink(document) {
    const size = formatBytes(document.size_bytes);
    const uploadedAt = document.uploaded_at ? formatValue(document.uploaded_at, "datetime") : "";
    const meta = [size, uploadedAt].filter(Boolean).join(" · ");
    const isMedicalReport = document.document_type === "laudo_medico";

    return `
        <a class="document-item" href="/entrevista-adesao/application-form-documents/${document.id}/file"
           target="_blank" rel="noopener">
            ${ICON_DOCUMENT}
            <span class="document-item-name">${escapeHtml(document.original_filename || "documento")}</span>
            ${isMedicalReport ? `<span class="pill pill--gray">Laudo médico</span>` : ""}
            ${meta ? `<span class="document-item-size">${escapeHtml(meta)}</span>` : ""}
        </a>
    `;
}

function renderDocumentList(documents, emptyMessage) {
    if (documents.length === 0) return renderEmptySection(emptyMessage);
    return `<div class="documents-list">${documents.map(renderDocumentLink).join("")}</div>`;
}

function getMedicalReports(details) {
    return (details.documents || []).filter(document => document.document_type === "laudo_medico");
}

// a tabela de reanálises também guarda as pedidas após reprovação do financeiro; aqui só
// interessam as que voltaram para a gerência
function getManagementReanalyses(details) {
    return (details.reanalysis_requests || []).filter(request => request.stage === "management");
}

/* ============================================================
   Aba: Resumo
   ============================================================ */

function renderSummaryHeader(form) {
    const metaItems = [
        ["CPF", formatValue(form.beneficiary_cpf, "cpf")],
        ["Idade", formatAge(form.beneficiary_birth_date)],
        ["Tipo", formatValue(form.beneficiary_type, "beneficiaryType")],
        ["Consultor", formatValue(form.consultant_name)],
        ["Inclusão", `${formatValue(form.inclusion_type)} em ${formatValue(form.inclusion_date, "date")}`],
    ];

    const meta = metaItems
        .map(([label, value]) => `<span>${escapeHtml(label)}: <strong>${escapeHtml(value)}</strong></span>`)
        .join("");

    return `
        <div class="mgmt-summary-header">
            <div>
                <p class="mgmt-summary-name">${textOrDash(form.beneficiary_name)}</p>
                <div class="mgmt-summary-meta">${meta}</div>
            </div>
            <div class="mgmt-summary-tags">
                ${form.form_status_name ? `<span class="pill pill--amber">${escapeHtml(form.form_status_name)}</span>` : ""}
                ${renderCommercialTags(form)}
            </div>
        </div>
    `;
}

// a ficha voltou para a gerência depois de uma reprovação: é a primeira coisa que o gerente precisa saber
function renderReanalysisAlert(details) {
    const reanalysisRequests = getManagementReanalyses(details);
    if (reanalysisRequests.length === 0) return "";

    const latest = reanalysisRequests[0];
    const reportsCount = getMedicalReports(details).length;

    return `
        <div class="mgmt-alert" role="note">
            ${ICON_WARNING}
            <div>
                <p><strong>Ficha em reanálise</strong> — ${reanalysisRequests.length} solicitação(ões), a mais recente por
                ${textOrDash(latest.requester_name)} em ${escapeHtml(formatValue(latest.requested_at, "datetime"))},
                com ${reportsCount} laudo(s) médico(s) anexado(s).</p>
                <p><button type="button" class="mgmt-link" data-go-tab="history">Ver a reprovação anterior e as reanálises</button></p>
            </div>
        </div>
    `;
}

function renderSummaryKpis(details) {
    const { form, qualify_interview: qualify } = details;
    const declared = getDeclaredConditions(qualify);

    const parecer = qualify?.parecer_unimed;
    const parecerValue = parecer
        ? `<span class="pill ${PARECER_UNIMED_PILL_CLASSES[parecer] || "pill--gray"}">${escapeHtml(PARECER_UNIMED_LABELS[parecer] || parecer)}</span>`
        : `<span class="pill pill--gray">Sem parecer registrado</span>`;

    const conditionsChips = declared.length > 0
        ? `<div class="mgmt-conditions">${declared.map(item => `<span class="mgmt-condition">${escapeHtml(item.label)}</span>`).join("")}</div>`
        : "";

    const discount = form.is_discount ? formatValue(form.discount_percentage, "percentage") : "Não";
    const portability = form.is_portability
        ? (form.portability_accepted ? "Sim — aceita" : "Sim — não aceita")
        : "Não";

    return `
        <div class="mgmt-kpis">
            ${renderKpi({
                label: "Parecer da Unimed",
                value: parecerValue,
                wide: true,
                alert: PARECER_UNIMED_REFUSED.has(parecer),
            })}
            ${renderKpi({
                label: "IMC",
                value: escapeHtml(qualify ? formatImc(qualify.peso_kg, qualify.altura_cm) : "—"),
            })}
            ${renderKpi({
                label: "Médico orientador",
                value: escapeHtml(qualify
                    ? (ESCOLHA_MEDICO_ORIENTADOR_LABELS[qualify.escolha_medico_orientador] || formatValue(qualify.escolha_medico_orientador))
                    : "—"),
            })}
            ${renderKpi({
                label: "Plano",
                value: textOrDash(form.plan_type),
                foot: `${textOrDash(form.contract_type)} · ${textOrDash(form.model_proposal)}`,
                wide: true,
            })}
            ${renderKpi({
                label: "Desconto / Portabilidade",
                value: escapeHtml(discount),
                foot: `Portabilidade: ${escapeHtml(portability)}`,
                wide: true,
            })}
            ${renderKpi({
                label: "Preexistências declaradas",
                value: qualify ? String(declared.length) : "—",
                foot: !qualify
                    ? "Questionário de saúde não registrado"
                    : declared.length === 0 ? "Nenhuma condição marcada como \"Sim\"" : "",
                full: true,
                alert: declared.length > 0,
                extra: conditionsChips,
            })}
        </div>
    `;
}

function stepModifier(approved) {
    if (approved === true) return "mgmt-step--approved";
    if (approved === false) return "mgmt-step--rejected";
    return "mgmt-step--pending";
}

function renderStep(title, approved, lines) {
    const rows = lines
        .map(([label, value]) => `<p class="mgmt-step-line"><span>${escapeHtml(label)}:</span> ${escapeHtml(value)}</p>`)
        .join("");

    return `
        <div class="mgmt-step ${stepModifier(approved)}">
            <div class="mgmt-step-head">
                <span class="mgmt-step-title">${escapeHtml(title)}</span>
                ${renderDecisionPill(approved)}
            </div>
            ${rows}
        </div>
    `;
}

// as etapas pelas quais a ficha já passou, em ordem
function renderSummaryTimeline(details) {
    const { approval, interview, management } = details;

    const financialStep = renderStep("Financeiro", approval?.financial_approved ?? null, [
        ["Revisor", formatValue(approval?.financial_reviewer_name)],
        ["Em", formatValue(approval?.financial_reviewed_at, "datetime")],
    ]);

    const interviewStep = renderStep("Entrevista", interview?.interview_approved ?? null, [
        ["Entrevistador", formatValue(interview?.interviewer_name)],
        ["Realizada em", formatValue(interview?.interview_date, "datetime")],
        ["Analisada em", formatValue(interview?.interview_reviewed_at, "datetime")],
    ]);

    // só existe análise da gerência gravada quando a ficha já foi reprovada e voltou por reanálise
    const managementStep = management
        ? renderStep("Gerência (análise anterior)", management.management_approved, [
            ["Gerente", formatValue(management.manager_name)],
            ["Em", formatValue(management.management_reviewed_at, "datetime")],
        ])
        : renderStep("Gerência", null, [["Situação", "Aguardando a sua decisão"]]);

    return `<div class="mgmt-timeline">${financialStep}${interviewStep}${managementStep}</div>`;
}

function renderSummaryTab(details) {
    const { form, interview, qualify_interview: qualify } = details;

    const observations = `
        <div class="mgmt-callouts">
            ${renderObservationCallout("Parecer Unimed — observações do entrevistador", interview?.interview_observation, true)}
            ${renderObservationCallout("Declaração de CPT (vai para o contrato)", qualify?.observation)}
        </div>
    `;

    return [
        renderSummaryHeader(form),
        renderReanalysisAlert(details),
        renderSection("Indicadores", renderSummaryKpis(details)),
        renderSection("Etapas da ficha", renderSummaryTimeline(details)),
        renderSection("Observações principais", observations),
    ].join("");
}

/* ============================================================
   Aba: Beneficiário
   ============================================================ */

function renderBeneficiaryTab(form, responsibles) {
    // campos que não estão no BENEFICIARY_FIELDS compartilhado, mas ajudam a gerência a situar o beneficiário
    const source = { ...form, beneficiary_age: formatAge(form.beneficiary_birth_date) };
    const fields = [
        ...BENEFICIARY_FIELDS,
        { label: "Idade", key: "beneficiary_age" },
        { label: "Tipo de Beneficiário", key: "beneficiary_type", format: "beneficiaryType" },
    ];

    return [
        renderSection("Dados do Beneficiário", renderInfoGrid(source, fields)),
        renderResponsibles(responsibles),
    ].join("");
}

// a ficha pode ter mais de um responsável pela inclusão; com um só, não há numeração
function renderResponsibles(responsibles) {
    const list = responsibles || [];

    if (list.length === 0) {
        return renderSection("Responsável pela Inclusão", renderEmptySection("Nenhum responsável pela inclusão cadastrado."));
    }
    if (list.length === 1) {
        return renderSection("Responsável pela Inclusão", renderInfoGrid(list[0], RESPONSIBLE_FIELDS));
    }

    const blocks = list.map((responsible, index) => `
        <div class="responsible-block">
            <p class="responsible-block-title">Responsável ${index + 1}</p>
            ${renderInfoGrid(responsible, RESPONSIBLE_FIELDS)}
        </div>
    `).join("");

    return renderSection("Responsáveis pela Inclusão", blocks);
}

/* ============================================================
   Aba: Plano e Contrato
   ============================================================ */

function renderContractTab(form) {
    return [
        renderSection("Dados do Formulário", renderInfoGrid(form, FORM_FIELDS)),
        renderSection("Desconto", renderInfoGrid(form, DISCOUNT_FIELDS)),
        renderSection("Portabilidade", renderInfoGrid(form, PORTABILITY_FIELDS)),
        renderSection("Outras Informações", renderInfoGrid(form, OTHER_FIELDS)),
    ].join("");
}

/* ============================================================
   Aba: Entrevista
   ============================================================ */

function renderInterviewTab(details) {
    const { form, interview, qualify_interview: qualify } = details;

    if (!interview) {
        return renderSection("Dados da Entrevista", renderEmptySection("Esta ficha ainda não possui entrevista registrada."));
    }

    const interviewFields = [
        { label: "Entrevistador", key: "interviewer_name" },
        { label: "Data da Entrevista", key: "interview_date", format: "datetime" },
        { label: "Analisada em", key: "interview_reviewed_at", format: "datetime" },
    ];

    // o documento só pode ser gerado quando a entrevista qualificada existe (o backend recusa sem ela)
    const pdfButton = qualify
        ? `<button type="button" class="btn btn--outline btn--sm" data-download="interview-pdf" data-form-id="${form.id}">
               ${ICON_DOWNLOAD} Baixar documento da entrevista (PDF)
           </button>`
        : "";

    const interviewHtml = `
        <div class="mgmt-toolbar">
            <div class="approval-decision">${renderDecisionPill(interview.interview_approved)}</div>
            <div class="mgmt-toolbar-actions">${pdfButton}</div>
        </div>
        ${renderInfoGrid(interview, interviewFields)}
    `;

    return [
        renderSection("Dados da Entrevista", interviewHtml),
        renderSection("Entrevista Qualificada — Declaração de Saúde", renderQualifyInterviewBody(qualify)),
        renderSection("Observações", renderInterviewObservations(interview, qualify)),
    ].join("");
}

/* ============================================================
   Aba: Histórico e Reanálises
   ============================================================ */

function renderHistoryTab(details) {
    const { approval, management } = details;
    const reanalysisRequests = getManagementReanalyses(details);
    const medicalReports = getMedicalReports(details);

    const financialHtml = approval
        ? `
            <div class="approval-decision">${renderDecisionPill(approval.financial_approved)}</div>
            ${renderInfoGrid(approval, [
                { label: "Revisor", key: "financial_reviewer_name" },
                { label: "Revisado em", key: "financial_reviewed_at", format: "datetime" },
                { label: "Observação", key: "financial_observation", full: true, pre: true },
            ])}
        `
        : renderEmptySection("Etapa ainda não realizada.");

    const managementHtml = management
        ? `
            <div class="approval-decision">${renderDecisionPill(management.management_approved)}</div>
            ${renderInfoGrid(management, [
                { label: "Gerente", key: "manager_name" },
                { label: "Revisado em", key: "management_reviewed_at", format: "datetime" },
                { label: "Observação da reprovação", key: "management_observation", full: true, pre: true },
            ])}
        `
        : renderEmptySection("Esta é a primeira análise da gerência para esta ficha.");

    // a lista vem da mais recente para a mais antiga, então a numeração é invertida
    const reanalysisHtml = reanalysisRequests.length > 0
        ? reanalysisRequests.map((reanalysisRequest, index) => {
            const reports = medicalReports.filter(document => document.reanalysis_request_id === reanalysisRequest.id);

            return `
                <div class="responsible-block">
                    <p class="responsible-block-title">Reanálise ${reanalysisRequests.length - index}</p>
                    ${renderInfoGrid(reanalysisRequest, [
                        { label: "Solicitado por", key: "requester_name" },
                        { label: "Solicitado em", key: "requested_at", format: "datetime" },
                        { label: "Observação da solicitação", key: "reanalysis_observation", full: true, pre: true },
                    ])}
                    ${renderDocumentList(reports, "Nenhum laudo médico anexado nesta solicitação.")}
                </div>
            `;
        }).join("")
        : renderEmptySection("Nenhuma reanálise solicitada.");

    return [
        renderSection("Aprovação Financeira", financialHtml),
        renderSection("Análise Anterior da Gerência", managementHtml),
        renderSection("Solicitações de Reanálise", reanalysisHtml),
    ].join("");
}

/* ============================================================
   Aba: Documentos
   ============================================================ */

function renderDocumentsTab(details) {
    const documents = details.documents || [];
    const formDocuments = documents.filter(document => document.document_type !== "laudo_medico");
    const medicalReports = getMedicalReports(details);

    const toolbar = documents.length > 0
        ? `
            <div class="mgmt-toolbar">
                <span class="approval-status-meta">${documents.length} arquivo(s) anexado(s). Clique em um arquivo para abri-lo em outra aba.</span>
                <div class="mgmt-toolbar-actions">
                    <button type="button" class="btn btn--outline btn--sm" data-download="all-documents" data-form-id="${details.form.id}">
                        ${ICON_DOWNLOAD} Baixar todos (.zip)
                    </button>
                </div>
            </div>
        `
        : "";

    const inner = `
        ${toolbar}
        <div class="mgmt-document-group">
            <p class="mgmt-document-group-title">Documentos da adesão</p>
            ${renderDocumentList(formDocuments, "Nenhum documento da adesão anexado.")}
        </div>
        <div class="mgmt-document-group">
            <p class="mgmt-document-group-title">Laudos médicos (reanálises)</p>
            ${renderDocumentList(medicalReports, "Nenhum laudo médico anexado.")}
        </div>
    `;

    return renderSection("Documentos Anexados", inner);
}

/* ============================================================
   Abas: controle
   ============================================================ */

// o controle das abas (clique, teclado, contadores) vem de utils/modalTabs.js
function resetTabCounts() {
    ["interview", "history", "documents"].forEach(tabName => setTabCount(tabName, 0));
}

/* ============================================================
   Downloads
   ============================================================ */

async function downloadFile(button, url, fallbackName, errorMessage) {
    if (button.disabled) return;
    button.disabled = true;

    try {
        const response = await fetchWithAuth(url);

        if (!response.ok) {
            const errorJSON = await response.json().catch(() => null);
            throw new Error(errorJSON?.message || errorMessage);
        }

        // o nome do arquivo vem no Content-Disposition montado pelo backend
        const disposition = response.headers.get("Content-Disposition") || "";
        const suggestedName = disposition.match(/filename\*?=(?:UTF-8'')?"?([^";]+)"?/i)?.[1];

        const blob = await response.blob();
        const blobUrl = URL.createObjectURL(blob);

        const link = document.createElement("a");
        link.href = blobUrl;
        link.download = decodeURIComponent(suggestedName || fallbackName);
        document.body.appendChild(link);
        link.click();
        link.remove();

        // libera a memória do blob depois que o navegador iniciou o download
        URL.revokeObjectURL(blobUrl);
    } catch (error) {
        console.error(error);
        notyf.error(error.message || errorMessage);
    } finally {
        button.disabled = false;
    }
}

modalBody.addEventListener("click", (event) => {
    const goTabButton = event.target.closest("[data-go-tab]");
    if (goTabButton) {
        setActiveTab(goTabButton.dataset.goTab);
        return;
    }

    const downloadButton = event.target.closest("[data-download]");
    if (!downloadButton) return;

    const applicationFormId = Number(downloadButton.dataset.formId);

    if (downloadButton.dataset.download === "interview-pdf") {
        downloadFile(
            downloadButton,
            `/entrevista-adesao/application-form-interviews/${applicationFormId}/document`,
            `entrevista_${applicationFormId}.pdf`,
            "Não foi possível gerar o documento da entrevista."
        );
    }

    if (downloadButton.dataset.download === "all-documents") {
        downloadFile(
            downloadButton,
            `/entrevista-adesao/application-form-documents/${applicationFormId}/download`,
            `documentos_${applicationFormId}.zip`,
            "Não foi possível baixar os documentos."
        );
    }
});

/* ============================================================
   Carregamento e abertura
   ============================================================ */

function renderAllTabs(details) {
    const { form, responsibles, qualify_interview: qualify } = details;

    panels.summary.innerHTML = renderSummaryTab(details);
    panels.beneficiary.innerHTML = renderBeneficiaryTab(form, responsibles);
    panels.contract.innerHTML = renderContractTab(form);
    panels.interview.innerHTML = renderInterviewTab(details);
    panels.history.innerHTML = renderHistoryTab(details);
    panels.documents.innerHTML = renderDocumentsTab(details);

    setTabCount("interview", getDeclaredConditions(qualify).length, true);
    setTabCount("history", getManagementReanalyses(details).length);
    setTabCount("documents", (details.documents || []).length);
}

function renderLoading() {
    Object.values(panels).forEach(panel => {
        panel.innerHTML = `<p class="modal-loading">Carregando informações...</p>`;
    });
}

// sem o /details, a análise não pode ficar bloqueada: o que veio da tabela ainda preenche as
// abas de beneficiário e contrato, e o formulário de decisão continua disponível
function renderLoadError(applicationForm) {
    const message = `<p class="modal-error">Não foi possível carregar o histórico completo da ficha.</p>`;

    panels.summary.innerHTML = `${renderSummaryHeader(applicationForm)}${message}`;
    panels.beneficiary.innerHTML = renderBeneficiaryTab(applicationForm, []);
    panels.contract.innerHTML = renderContractTab(applicationForm);
    panels.interview.innerHTML = message;
    panels.history.innerHTML = message;
    panels.documents.innerHTML = message;
}

async function loadFormDetails(applicationForm, requestId) {
    try {
        const response = await fetchWithAuth(`/entrevista-adesao/application-forms/${applicationForm.id}/details`);

        if (!response.ok) throw new Error("Erro ao carregar o histórico da ficha");

        const details = await response.json();
        if (requestId !== openRequestId) return;

        renderAllTabs(details);
    } catch (error) {
        console.error(error);
        if (requestId !== openRequestId) return;

        renderLoadError(applicationForm);
    }
}

function closeModal() {
    overlay.hidden = true;
    // invalida uma resposta ainda pendente da ficha que acabou de ser fechada
    openRequestId += 1;
}

// hoje não existe análise anterior para carregar no formulário, então ele sempre abre limpo
function resetApprovalSection() {
    approvalStatusBanner.innerHTML = `<span class="pill pill--gray">Ainda não analisado</span>`;
    managementApprovalForm.reset();
}

export function openAnalyzeManagementModal(applicationForm) {
    openRequestId += 1;
    const requestId = openRequestId;

    formIdLabel.textContent = applicationForm.id;
    subtitleLabel.textContent = applicationForm.beneficiary_name || "";

    resetApprovalSection();
    resetTabCounts();
    setActiveTab("summary");
    renderLoading();
    loadFormDetails(applicationForm, requestId);

    // preenche os campos ocultos que vão junto no envio pro backend
    applicationFormIdInput.value = applicationForm.id;
    managerIdInput.value = "";
    getLoggedUser().then(user => {
        if (requestId === openRequestId) managerIdInput.value = user?.id ?? "";
    });

    overlay.hidden = false;
}

// o formulário de decisão mora na aba Resumo. Se o envio partir de outra aba, os campos obrigatórios
// estariam em um painel oculto e a validação nativa falharia sem mostrar nada; o click roda antes da
// validação, então basta voltar para o Resumo aqui
submitButton.addEventListener("click", () => {
    if (getActiveTab() !== "summary") setActiveTab("summary");
});

function submitForm() {
    const formSubmitButton = getFormSubmitButton(managementApprovalForm);
    managementApprovalForm.addEventListener("submit", async (e) => {
        e.preventDefault();

        // pega os dados do formulário
        const formData = new FormData(managementApprovalForm);

        // validação para remover espaços no inicio e final da string
        for (let [key, value] of formData.entries()) {
            if (typeof value === "string") {
                formData.set(key, value.trim());
            }
        }

        // monta o payload
        const data = Object.fromEntries(formData.entries());
        data.application_form_id = Number(data.application_form_id);
        data.manager_id = Number(data.manager_id);
        // sem nenhum radio marcado a chave nem existe no FormData: envia null para o backend
        // recusar a análise, em vez de gravar uma reprovação silenciosa
        const decision = formData.get("management_approved");
        data.management_approved = decision === null ? null : decision === "true";
        data.management_reviewed_at = new Date().toISOString();

        setSubmitLoading(formSubmitButton, true);
        try {
            const response = await fetchWithAuth("/entrevista-adesao/application_form_management", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(data),
            });

            if (!response.ok) {
                const errorJSON = await response.json().catch(() => null);
                throw new Error(errorJSON?.message || `Erro ${response.status} ao enviar análise`);
            }

            closeModal();
            notyf.success("Análise enviada com sucesso");
            await populateManagementApproveTable();
        } catch (error) {
            notyf.error(error.message || "Houve um erro ao enviar a análise");
        } finally {
            setSubmitLoading(formSubmitButton, false);
        }
    });
}

closeButton.addEventListener("click", closeModal);
cancelButton.addEventListener("click", closeModal);
bindOverlayDismiss(overlay, closeModal);
document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !overlay.hidden) closeModal();
});

document.addEventListener("DOMContentLoaded", () => {
    submitForm();
})
