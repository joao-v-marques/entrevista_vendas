import { fetchWithAuth, getLoggedUser } from "../utils/apiHelper.js";
import {
    escapeHtml,
    formatValue,
    formatBytes,
    formatAge,
    renderSection,
    renderDecisionPill,
    renderEmptySection,
    renderCommercialTags,
} from "../utils/detailsView.js";
import { bindOverlayDismiss } from "../utils/modalOverlay.js";
import { syncBodyScrollLock } from "../utils/modalControl.js";
import { createModalTabs } from "../utils/modalTabs.js";
import { getStatusPillClass } from "../utils/statusPill.js";
import { getDeclaredConditions } from "../utils/qualifyInterview.js";
import { renderQualifyInterviewBody, renderInterviewObservations } from "../utils/qualifyInterviewView.js";
import {
    textOrDash,
    renderRows,
    renderCard,
    renderNote,
    renderCardEmpty,
    renderDetailHero,
    renderHeroIcon,
    renderResponsibles,
    renderResponsiblesCount,
    renderBeneficiaryTab,
    renderPlanTab,
} from "../utils/formCardsView.js";

const overlay = document.getElementById("viewFormModalOverlay");
const idLabel = document.getElementById("viewFormModalId");
const subtitleLabel = document.getElementById("viewFormModalSubtitle");
const modalBody = document.getElementById("viewFormModalBody");
const tabList = document.getElementById("viewFormTabs");
const closeButton = document.getElementById("viewFormModalClose");
const cancelButton = document.getElementById("viewFormModalCancel");

// um container por aba; todas são preenchidas de uma vez quando o /details chega
const panels = {
    summary: document.getElementById("viewFormSummaryContent"),
    beneficiary: document.getElementById("viewFormBeneficiaryContent"),
    plan: document.getElementById("viewFormPlanContent"),
    financial: document.getElementById("viewFormFinancialContent"),
    interview: document.getElementById("viewFormInterviewContent"),
    management: document.getElementById("viewFormManagementContent"),
    history: document.getElementById("viewFormHistoryContent"),
    documents: document.getElementById("viewFormDocumentsContent"),
};

const { setActiveTab, setTabCount } = createModalTabs(tabList, modalBody);

// cada abertura do modal ganha um número; a resposta do /details só é aplicada se ainda for da
// abertura atual, senão uma ficha lenta aberta antes sobrescreveria a que está na tela
let openRequestId = 0;

// abrir um anexo e gerar o PDF da entrevista espelham o @role_required de
// GET /application-form-documents/<id>/file e GET /application-form-interviews/<id>/document.
// O financeiro também acessa /fichas, mas só baixa o .zip (download liberado para ele)
const userPromise = getLoggedUser();

// etapa que reprovou a ficha e gerou a reanálise
const REANALYSIS_STAGE_LABELS = {
    financial: "Financeiro",
    management: "Gerência",
};

const ICON_DOCUMENT = `
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d="M4 1.5h5L13 5.5V14a.5.5 0 0 1-.5.5h-9A.5.5 0 0 1 3 14V2a.5.5 0 0 1 .5-.5z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/>
        <path d="M9 1.5V5.5h4" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/>
    </svg>`;

const ICON_DOWNLOAD = `
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
        <path d="M8 2v8m0 0L5 7m3 3l3-3M3 13h10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`;

// marcadores da linha do tempo (12px, dentro do círculo de 28px)
const EVENT_ICONS = {
    created: `<path d="M8 3v10M3 8h10" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>`,
    approved: `<path d="M3 8.5l3 3 7-7" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>`,
    rejected: `<path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>`,
    calendar: `<rect x="2" y="2.8" width="12" height="11" rx="1.3" stroke="currentColor" stroke-width="1.6"/><path d="M2 6.2h12" stroke="currentColor" stroke-width="1.6"/>`,
    refresh: `<path d="M13.2 6.5A5.3 5.3 0 0 0 3.4 5M2.8 9.5a5.3 5.3 0 0 0 9.8 1.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><path d="M3.2 2.3v2.9h2.9M12.8 13.7v-2.9H9.9" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>`,
    current: `<circle cx="8" cy="8" r="3" fill="currentColor"/>`,
};

/* ============================================================
   Helpers
   ============================================================ */

function getReanalyses(details, stage) {
    return (details.reanalysis_requests || []).filter(request => request.stage === stage);
}

function getMedicalReports(details) {
    return (details.documents || []).filter(document => document.document_type === "laudo_medico");
}

function decisionLabel(approved) {
    if (approved === true) return "Aprovado";
    if (approved === false) return "Reprovado";
    return "Pendente";
}

// só /file (abrir) depende da role; sem permissão o anexo vira um item estático
function renderDocumentItem(document, canOpenFiles) {
    const size = formatBytes(document.size_bytes);
    const uploadedAt = document.uploaded_at ? formatValue(document.uploaded_at, "datetime") : "";
    const meta = [size, uploadedAt].filter(Boolean).join(" · ");
    const isMedicalReport = document.document_type === "laudo_medico";

    const inner = `
        ${ICON_DOCUMENT}
        <span class="document-item-name">${escapeHtml(document.original_filename || "documento")}</span>
        ${isMedicalReport ? `<span class="pill pill--gray">Laudo médico</span>` : ""}
        ${meta ? `<span class="document-item-size">${escapeHtml(meta)}</span>` : ""}
    `;

    return canOpenFiles
        ? `<a class="document-item" href="/entrevista-adesao/application-form-documents/${document.id}/file" target="_blank" rel="noopener">${inner}</a>`
        : `<div class="document-item">${inner}</div>`;
}

function renderDocumentList(documents, emptyMessage, canOpenFiles) {
    if (documents.length === 0) return renderEmptySection(emptyMessage);
    return `<div class="documents-list">${documents.map(document => renderDocumentItem(document, canOpenFiles)).join("")}</div>`;
}

/* ============================================================
   Aba: Resumo (dados para o cadastro em outro sistema)
   ============================================================ */

// cada campo do Resumo: optional some quando vazio (campos que só existem em alguns tipos de ficha);
// full ocupa a linha inteira (textos longos)
const SUMMARY_FORM_FIELDS = [
    { label: "ID do formulário", key: "id" },
    { label: "Status", key: "form_status_name" },
    { label: "Consultor", key: "consultant_name" },
    { label: "Ficha criada em", key: "created_at", format: "datetime" },
    { label: "Tipo de inclusão", key: "inclusion_type" },
    { label: "Data da inclusão", key: "inclusion_date", format: "date" },
];

const SUMMARY_BENEFICIARY_FIELDS = [
    { label: "Nome do beneficiário", key: "beneficiary_name" },
    { label: "CPF", key: "beneficiary_cpf", format: "cpf" },
    { label: "Data de nascimento", key: "beneficiary_birth_date", format: "date" },
    { label: "Idade", key: "beneficiary_age" },
    { label: "Estado civil", key: "beneficiary_marital_state" },
    { label: "Tipo de beneficiário", key: "beneficiary_type", format: "beneficiaryType" },
    { label: "Nome do titular", key: "secondary_beneficiary_primary_name", optional: true },
    { label: "Parentesco", key: "secondary_beneficiary_kinship", optional: true },
    { label: "Telefone / Celular", key: "beneficiary_phone", format: "phone" },
    { label: "E-mail do beneficiário", key: "beneficiary_email" },
    { label: "E-mail de cobrança", key: "billing_email" },
];

const SUMMARY_PLAN_FIELDS = [
    { label: "Contratação", key: "contract_type" },
    { label: "Plano", key: "plan_type" },
    { label: "Mod./Prop.", key: "model_proposal" },
    { label: "Vencimento", key: "expiration_month" },
    { label: "CNPJ", key: "cnpj", format: "cnpj", optional: true },
    { label: "Plano anterior", key: "previous_plan", optional: true },
    { label: "Cancelamento do plano anterior", key: "previous_plan_cancellation_date", format: "date", optional: true },
    { label: "Adesão ao PA Digital", key: "is_pa_digital", format: "boolean" },
    { label: "Aeromédico", key: "is_aeromedic", format: "boolean" },
    { label: "Opção de carência", key: "grace_option", full: true },
];

const SUMMARY_DISCOUNT_FIELDS = [
    { label: "Possui desconto", key: "is_discount", format: "boolean" },
    { label: "Porcentagem de desconto", key: "discount_percentage", format: "percentage", optional: true },
    { label: "Observações do desconto", key: "discount_observation", full: true, optional: true },
];

const SUMMARY_PORTABILITY_FIELDS = [
    { label: "Inclusão via portabilidade", key: "is_portability", format: "boolean" },
    { label: "Portabilidade aceita", key: "portability_accepted", format: "boolean", optional: true },
    { label: "Data do aceite", key: "portability_accepted_date", format: "date", optional: true },
    { label: "Observações da portabilidade", key: "portability_observation", full: true, optional: true },
];

const SUMMARY_RESPONSIBLE_FIELDS = [
    { label: "Nome", key: "name" },
    { label: "CPF", key: "cpf", format: "cpf" },
    { label: "Estado civil", key: "marital_state" },
    { label: "Profissão", key: "profession" },
];

const ICON_COPY = `
    <svg class="vf-copy-icon" width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <rect x="5.5" y="5.5" width="8" height="8.5" rx="1.4" stroke="currentColor" stroke-width="1.4"/>
        <path d="M10.5 5.5V3.4a1.4 1.4 0 0 0-1.4-1.4H3.4A1.4 1.4 0 0 0 2 3.4v5.7a1.4 1.4 0 0 0 1.4 1.4h2.1" stroke="currentColor" stroke-width="1.4"/>
    </svg>
    <svg class="vf-copied-icon" width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <path d="M3 8.5l3 3 7-7" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`;

// valores já formatados como aparecem na tela; campos opcionais vazios ficam de fora
function buildSummaryRows(source, fields) {
    return fields
        .map(field => ({ ...field, value: String(formatValue(source?.[field.key], field.format)) }))
        .filter(field => !(field.optional && field.value === "—"));
}

// "Rótulo: valor" por linha, o formato colado pelo "Copiar seção" / "Copiar tudo"
function rowsToText(title, rows) {
    return [title, ...rows.map(row => `${row.label}: ${row.value}`)].join("\n");
}

function buildSummarySections(details) {
    const { form } = details;
    const responsibles = details.responsibles || [];
    const source = { ...form, beneficiary_age: formatAge(form.beneficiary_birth_date) };

    const sections = [
        { title: "Dados da ficha", rows: buildSummaryRows(form, SUMMARY_FORM_FIELDS) },
        { title: "Beneficiário", rows: buildSummaryRows(source, SUMMARY_BENEFICIARY_FIELDS) },
        { title: "Plano e contratação", rows: buildSummaryRows(form, SUMMARY_PLAN_FIELDS) },
        { title: "Desconto", rows: buildSummaryRows(form, SUMMARY_DISCOUNT_FIELDS), half: true },
        { title: "Portabilidade", rows: buildSummaryRows(form, SUMMARY_PORTABILITY_FIELDS), half: true },
    ];

    // a ficha pode ter mais de um responsável pela inclusão; com um só, não há numeração
    if (responsibles.length === 0) {
        sections.push({ title: "Responsável pela inclusão", rows: [], empty: "Nenhum responsável pela inclusão cadastrado." });
    }
    responsibles.forEach((responsible, index) => {
        sections.push({
            title: responsibles.length === 1 ? "Responsável pela inclusão" : `Responsável pela inclusão ${index + 1}`,
            rows: buildSummaryRows(responsible, SUMMARY_RESPONSIBLE_FIELDS),
        });
    });

    sections.push({
        title: "Observações e considerações especiais",
        rows: buildSummaryRows(form, [{ label: "Observações", key: "especial_observations", full: true }]),
    });

    return sections;
}

function renderCopyButton(text, label) {
    return `
        <button type="button" class="vf-copy-btn" data-copy="${escapeHtml(text)}"
                title="Copiar ${escapeHtml(label)}" aria-label="Copiar ${escapeHtml(label)}">
            ${ICON_COPY}
        </button>`;
}

function renderSummaryField(row) {
    const isEmpty = row.value === "—";

    return `
        <div class="vf-field${row.full ? " vf-field--full" : ""}">
            <span class="vf-field-label">${escapeHtml(row.label)}</span>
            <div class="vf-field-value-wrap">
                <span class="vf-field-value${isEmpty ? " is-empty" : ""}${row.full ? " vf-field-value--pre" : ""}">${escapeHtml(row.value)}</span>
                ${isEmpty ? "" : renderCopyButton(row.value, row.label)}
            </div>
        </div>
    `;
}

function renderSummaryBlock(section) {
    const body = section.rows.length > 0
        ? `<div class="vf-fields">${section.rows.map(renderSummaryField).join("")}</div>`
        : renderEmptySection(section.empty || "Nenhuma informação registrada.");

    const copySection = section.rows.length > 0
        ? `<button type="button" class="btn btn--ghost btn--sm vf-copy-section" data-copy="${escapeHtml(rowsToText(section.title, section.rows))}">
               ${ICON_COPY} <span>Copiar seção</span>
           </button>`
        : "";

    return `
        <section class="vf-copy-block${section.half ? " vf-copy-block--half" : ""}">
            <header class="vf-copy-block-head">
                <h3 class="vf-copy-block-title">${escapeHtml(section.title)}</h3>
                ${copySection}
            </header>
            ${body}
        </section>
    `;
}

function renderSummaryHeader(form, allText) {
    const metaItems = [
        ["CPF", formatValue(form.beneficiary_cpf, "cpf")],
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
                ${form.form_status_name ? `<span class="pill ${getStatusPillClass(form.form_status_name)}">${escapeHtml(form.form_status_name)}</span>` : ""}
                ${renderCommercialTags(form)}
                <button type="button" class="btn btn--outline btn--sm vf-copy-section" data-copy="${escapeHtml(allText)}">
                    ${ICON_COPY} <span>Copiar tudo</span>
                </button>
            </div>
        </div>
    `;
}

function renderSummaryTab(details) {
    const sections = buildSummarySections(details);
    const allText = sections
        .filter(section => section.rows.length > 0)
        .map(section => rowsToText(section.title, section.rows))
        .join("\n\n");

    return [
        renderSummaryHeader(details.form, allText),
        `<p class="vf-copy-hint">Clique no ícone ao lado de um campo para copiar só o valor, ou em "Copiar seção" para levar o bloco inteiro.</p>`,
        `<div class="vf-copy-blocks">${sections.map(renderSummaryBlock).join("")}</div>`,
    ].join("");
}

/* ============================================================
   Cópia para a área de transferência
   ============================================================ */

// navigator.clipboard só existe em contexto seguro (https/localhost); fora dele cai no execCommand
async function copyToClipboard(text) {
    if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
        return;
    }

    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    const copied = document.execCommand("copy");
    textarea.remove();

    if (!copied) throw new Error("Não foi possível copiar");
}

async function handleCopy(button) {
    try {
        await copyToClipboard(button.dataset.copy);

        // confirmação no próprio botão, sem toast a cada campo copiado
        button.classList.add("is-copied");
        clearTimeout(button._copiedTimer);
        button._copiedTimer = setTimeout(() => button.classList.remove("is-copied"), 1200);
    } catch (error) {
        console.error(error);
        notyf.error("Não foi possível copiar. Selecione o texto e copie manualmente.");
    }
}

/* ============================================================
   Abas das etapas (Financeiro / Gerência)
   ============================================================ */

// todas as rodadas de reanálise de uma etapa, cada uma com os laudos anexados nela
function renderReanalysesCard(reanalysisRequests, medicalReports, canOpenFiles, showReports) {
    if (reanalysisRequests.length === 0) {
        return renderCard({
            title: "Solicitações de reanálise",
            icon: "refresh",
            body: renderCardEmpty("Nenhuma reanálise solicitada nesta etapa."),
            full: true,
        });
    }

    // a lista vem da mais recente para a mais antiga, então a numeração é invertida
    const blocks = reanalysisRequests.map((reanalysisRequest, index) => {
        const reports = medicalReports.filter(document => document.reanalysis_request_id === reanalysisRequest.id);

        return `
            <div class="fin-subblock">
                <p class="fin-subblock-title">Reanálise ${reanalysisRequests.length - index}${index === 0 ? " (mais recente)" : ""}</p>
                ${renderRows(reanalysisRequest, [
                    { label: "Solicitado por", key: "requester_name" },
                    { label: "Solicitado em", key: "requested_at", format: "datetime" },
                ])}
                ${renderNote("Observação da solicitação", reanalysisRequest.reanalysis_observation)}
                ${showReports ? renderDocumentList(reports, "Nenhum laudo médico anexado nesta solicitação.", canOpenFiles) : ""}
            </div>
        `;
    }).join("");

    return renderCard({
        title: "Solicitações de reanálise",
        icon: "refresh",
        badge: `<span class="pill pill--amber">${reanalysisRequests.length}</span>`,
        body: blocks,
        full: true,
    });
}

function renderStageHero({ icon, eyebrow, record, approved, reviewerLabel, reviewerKey, reviewedAtKey }) {
    if (!record) {
        return renderDetailHero({
            visual: renderHeroIcon(icon),
            eyebrow,
            title: "Etapa ainda não realizada",
            tags: renderDecisionPill(null),
        });
    }

    const meta = [
        `${escapeHtml(reviewerLabel)} <strong>${textOrDash(record[reviewerKey])}</strong>`,
        `em <strong>${textOrDash(record[reviewedAtKey], "datetime")}</strong>`,
    ].join(`<span class="fin-hero-sep" aria-hidden="true">·</span>`);

    return renderDetailHero({
        visual: renderHeroIcon(icon),
        eyebrow,
        title: escapeHtml(decisionLabel(approved)),
        meta,
        tags: renderDecisionPill(approved),
    });
}

function renderDecisionCard({ record, approved, fields, observationLabel, observation }) {
    if (!record) {
        return renderCard({ title: "Análise", icon: "clipboard", body: renderCardEmpty("Nenhuma análise registrada."), full: true });
    }

    const observationBody = (observation || "").trim()
        ? `<p class="fin-note-text">${escapeHtml(observation.trim())}</p>`
        : renderCardEmpty("Nenhuma observação registrada.");

    return [
        renderCard({ title: "Análise", icon: "clipboard", badge: renderDecisionPill(approved), body: renderRows(record, fields) }),
        renderCard({ title: observationLabel, icon: "note", body: observationBody }),
    ].join("");
}

function renderFinancialTab(details, canOpenFiles) {
    const { approval } = details;
    const approved = approval?.financial_approved ?? null;

    const cards = [
        renderDecisionCard({
            record: approval,
            approved,
            fields: [
                { label: "Revisor", key: "financial_reviewer_name" },
                { label: "Revisado em", key: "financial_reviewed_at", format: "datetime" },
            ],
            observationLabel: "Observação do financeiro",
            observation: approval?.financial_observation,
        }),
        // os laudos médicos são anexados nas reanálises da gerência; as do financeiro não têm anexo
        renderReanalysesCard(getReanalyses(details, "financial"), [], canOpenFiles, false),
    ].join("");

    return `
        ${renderStageHero({
            icon: "dollar",
            eyebrow: "Aprovação do Financeiro",
            record: approval,
            approved,
            reviewerLabel: "Revisor",
            reviewerKey: "financial_reviewer_name",
            reviewedAtKey: "financial_reviewed_at",
        })}
        <div class="fin-cards">${cards}</div>
    `;
}

function renderManagementTab(details, canOpenFiles) {
    const { management } = details;
    const approved = management?.management_approved ?? null;

    const cards = [
        renderDecisionCard({
            record: management,
            approved,
            fields: [
                { label: "Gerente", key: "manager_name" },
                { label: "Revisado em", key: "management_reviewed_at", format: "datetime" },
            ],
            observationLabel: "Observação da gerência",
            observation: management?.management_observation,
        }),
        renderReanalysesCard(getReanalyses(details, "management"), getMedicalReports(details), canOpenFiles, true),
    ].join("");

    return `
        ${renderStageHero({
            icon: "shield",
            eyebrow: "Aprovação da Gerência",
            record: management,
            approved,
            reviewerLabel: "Gerente",
            reviewerKey: "manager_name",
            reviewedAtKey: "management_reviewed_at",
        })}
        <div class="fin-cards">${cards}</div>
    `;
}

/* ============================================================
   Aba: Entrevista
   ============================================================ */

function renderInterviewTab(details, canDownloadInterview) {
    const { form, interview, qualify_interview: qualify } = details;

    if (!interview) {
        return renderDetailHero({
            visual: renderHeroIcon("chat"),
            eyebrow: "Entrevista",
            title: "Entrevista ainda não agendada",
            tags: renderDecisionPill(null),
        });
    }

    const approved = interview.interview_approved ?? null;
    const isScheduledOnly = approved === null;

    const meta = [
        `Entrevistador <strong>${textOrDash(interview.interviewer_name)}</strong>`,
        `em <strong>${textOrDash(interview.interview_date, "datetime")}</strong>`,
    ].join(`<span class="fin-hero-sep" aria-hidden="true">·</span>`);

    // o documento só pode ser gerado quando a entrevista qualificada existe (o backend recusa sem ela)
    const pdfButton = qualify && canDownloadInterview
        ? `<button type="button" class="btn btn--outline btn--sm" data-download="interview-pdf" data-form-id="${form.id}">
               ${ICON_DOWNLOAD} Baixar documento da entrevista (PDF)
           </button>`
        : "";

    const hero = renderDetailHero({
        visual: renderHeroIcon("chat"),
        eyebrow: "Entrevista",
        title: escapeHtml(isScheduledOnly ? "Agendada — aguardando análise" : decisionLabel(approved)),
        meta,
        tags: isScheduledOnly ? `<span class="pill pill--blue">Agendada</span>` : renderDecisionPill(approved),
    });

    const scheduleCard = renderCard({
        title: "Agendamento",
        icon: "calendar",
        body: `
            ${renderRows(interview, [
                { label: "Data da entrevista", key: "interview_date", format: "datetime" },
                { label: "Agendada em", key: "created_at", format: "datetime" },
                { label: "Entrevistador", key: "interviewer_name" },
            ])}
            ${renderNote("Observação do agendamento", interview.schedule_observation)}
        `,
    });

    const analysisCard = renderCard({
        title: "Análise",
        icon: "clipboard",
        badge: renderDecisionPill(approved),
        body: isScheduledOnly
            ? renderCardEmpty("A entrevista ainda não foi analisada.")
            : renderRows({ ...interview, decision_label: decisionLabel(approved) }, [
                { label: "Decisão", key: "decision_label" },
                { label: "Analisada em", key: "interview_reviewed_at", format: "datetime" },
            ]),
    });

    const toolbar = pdfButton
        ? `<div class="mgmt-toolbar"><span></span><div class="mgmt-toolbar-actions">${pdfButton}</div></div>`
        : "";

    return [
        hero,
        `<div class="fin-cards">${scheduleCard}${analysisCard}</div>`,
        renderSection("Entrevista Qualificada — Declaração de Saúde", `${toolbar}${renderQualifyInterviewBody(qualify)}`),
        renderSection("Observações", renderInterviewObservations(interview, qualify)),
    ].join("");
}

/* ============================================================
   Aba: Linha do tempo
   ============================================================ */

// monta, a partir do /details, tudo o que aconteceu com a ficha e com data conhecida
function buildEvents(details) {
    const { form, approval, interview, management } = details;
    const events = [];

    events.push({
        at: form.created_at,
        kind: "info",
        icon: "created",
        title: "Ficha criada",
        meta: `Consultor: ${formatValue(form.consultant_name)}`,
    });

    if (approval?.financial_reviewed_at) {
        events.push({
            at: approval.financial_reviewed_at,
            kind: approval.financial_approved ? "approved" : "rejected",
            icon: approval.financial_approved ? "approved" : "rejected",
            title: `Financeiro ${approval.financial_approved ? "aprovou" : "reprovou"}`,
            meta: `Revisor: ${formatValue(approval.financial_reviewer_name)}`,
            text: approval.financial_observation,
        });
    }

    (details.reanalysis_requests || []).forEach(request => {
        events.push({
            at: request.requested_at,
            kind: "warning",
            icon: "refresh",
            title: `Reanálise solicitada (${REANALYSIS_STAGE_LABELS[request.stage] || "—"})`,
            meta: `Solicitado por: ${formatValue(request.requester_name)}`,
            text: request.reanalysis_observation,
        });
    });

    if (interview?.created_at) {
        events.push({
            at: interview.created_at,
            kind: "info",
            icon: "calendar",
            title: "Entrevista agendada",
            meta: `Para ${formatValue(interview.interview_date, "datetime")} · Entrevistador: ${formatValue(interview.interviewer_name)}`,
            text: interview.schedule_observation,
        });
    }

    if (interview?.interview_reviewed_at) {
        events.push({
            at: interview.interview_reviewed_at,
            kind: interview.interview_approved ? "approved" : "rejected",
            icon: interview.interview_approved ? "approved" : "rejected",
            title: `Entrevista ${interview.interview_approved ? "aprovada" : "reprovada"}`,
            meta: `Entrevistador: ${formatValue(interview.interviewer_name)}`,
            text: interview.interview_observation,
        });
    }

    if (management?.management_reviewed_at) {
        events.push({
            at: management.management_reviewed_at,
            kind: management.management_approved ? "approved" : "rejected",
            icon: management.management_approved ? "approved" : "rejected",
            title: `Gerência ${management.management_approved ? "aprovou" : "reprovou"}`,
            meta: `Gerente: ${formatValue(management.manager_name)}`,
            text: management.management_observation,
        });
    }

    // eventos sem data válida vão para o fim, mantendo a ordem em que foram montados
    const timeOf = event => {
        const time = new Date(event.at).getTime();
        return isNaN(time) ? Infinity : time;
    };

    return events.sort((a, b) => timeOf(a) - timeOf(b));
}

function renderEvent(event) {
    return `
        <li class="vf-event vf-event--${event.kind}">
            <span class="vf-event-dot" aria-hidden="true">
                <svg width="12" height="12" viewBox="0 0 16 16" fill="none">${EVENT_ICONS[event.icon]}</svg>
            </span>
            <div class="vf-event-body">
                <div class="vf-event-head">
                    <span class="vf-event-title">${escapeHtml(event.title)}</span>
                    ${event.at ? `<span class="vf-event-date">${escapeHtml(formatValue(event.at, "datetime"))}</span>` : ""}
                </div>
                ${event.meta ? `<p class="vf-event-meta">${escapeHtml(event.meta)}</p>` : ""}
                ${(event.text || "").trim() ? `<p class="vf-event-text">${escapeHtml(event.text.trim())}</p>` : ""}
            </div>
        </li>
    `;
}

function renderHistoryTab(details) {
    const events = buildEvents(details).map(renderEvent);

    // o status atual fecha a linha do tempo, sem data (é o estado de agora)
    events.push(`
        <li class="vf-event vf-event--current">
            <span class="vf-event-dot" aria-hidden="true">
                <svg width="12" height="12" viewBox="0 0 16 16" fill="none">${EVENT_ICONS.current}</svg>
            </span>
            <div class="vf-event-body">
                <div class="vf-event-head">
                    <span class="vf-event-title">Status atual</span>
                    <span class="pill ${getStatusPillClass(details.form.form_status_name)}">${textOrDash(details.form.form_status_name)}</span>
                </div>
            </div>
        </li>
    `);

    const inner = `
        <p class="vf-events-note">Do mais antigo para o mais recente. Cada etapa guarda apenas a sua análise mais recente;
        as reanálises ficam registradas uma a uma.</p>
        <ol class="vf-events">${events.join("")}</ol>
    `;

    return renderSection("Linha do tempo da ficha", inner);
}

/* ============================================================
   Aba: Documentos
   ============================================================ */

function renderDocumentsTab(details, canOpenFiles) {
    const documents = details.documents || [];
    const formDocuments = documents.filter(document => document.document_type !== "laudo_medico");
    const medicalReports = getMedicalReports(details);

    const hint = canOpenFiles
        ? `${documents.length} arquivo(s) anexado(s). Clique em um arquivo para abri-lo em outra aba.`
        : `${documents.length} arquivo(s) anexado(s).`;

    const toolbar = documents.length > 0
        ? `
            <div class="mgmt-toolbar">
                <span class="approval-status-meta">${escapeHtml(hint)}</span>
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
            ${renderDocumentList(formDocuments, "Nenhum documento da adesão anexado.", canOpenFiles)}
        </div>
        <div class="mgmt-document-group">
            <p class="mgmt-document-group-title">Laudos médicos (reanálises)</p>
            ${renderDocumentList(medicalReports, "Nenhum laudo médico anexado.", canOpenFiles)}
        </div>
    `;

    return renderSection("Documentos Anexados", inner);
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
    const copyButton = event.target.closest("[data-copy]");
    if (copyButton) {
        handleCopy(copyButton);
        return;
    }

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

function renderAllTabs(details, user) {
    const { form, responsibles, qualify_interview: qualify } = details;

    // espelha o @role_required de /application-form-documents/<id>/file e
    // /application-form-interviews/<id>/document
    const canOpenFiles = ["administrator", "director", "sales_employee"].includes(user?.role_name);

    subtitleLabel.textContent = form.beneficiary_name || "";

    panels.summary.innerHTML = renderSummaryTab(details);
    panels.beneficiary.innerHTML = renderBeneficiaryTab(form, {
        responsiblesBadge: renderResponsiblesCount(responsibles || []),
        responsiblesBody: renderResponsibles(responsibles || []),
    });
    panels.plan.innerHTML = renderPlanTab(form);
    panels.financial.innerHTML = renderFinancialTab(details, canOpenFiles);
    panels.interview.innerHTML = renderInterviewTab(details, canOpenFiles);
    panels.management.innerHTML = renderManagementTab(details, canOpenFiles);
    panels.history.innerHTML = renderHistoryTab(details);
    panels.documents.innerHTML = renderDocumentsTab(details, canOpenFiles);

    setTabCount("financial", getReanalyses(details, "financial").length);
    setTabCount("interview", getDeclaredConditions(qualify).length, true);
    setTabCount("management", getReanalyses(details, "management").length);
    setTabCount("documents", (details.documents || []).length);
}

function renderLoading() {
    Object.values(panels).forEach(panel => {
        panel.innerHTML = `<p class="modal-loading">Carregando informações...</p>`;
    });
}

function renderLoadError(message) {
    Object.values(panels).forEach(panel => {
        panel.innerHTML = `<p class="modal-error">${escapeHtml(message)}</p>`;
    });
}

function resetTabCounts() {
    ["financial", "interview", "management", "documents"].forEach(tabName => setTabCount(tabName, 0));
}

function closeModal() {
    overlay.hidden = true;
    syncBodyScrollLock();
    // invalida uma resposta ainda pendente da ficha que acabou de ser fechada
    openRequestId += 1;
}

export async function openViewFormModal(applicationFormId) {
    openRequestId += 1;
    const requestId = openRequestId;

    idLabel.textContent = applicationFormId;
    subtitleLabel.textContent = "";

    resetTabCounts();
    setActiveTab("summary");
    renderLoading();

    overlay.hidden = false;
    syncBodyScrollLock();

    try {
        const response = await fetchWithAuth(`/entrevista-adesao/application-forms/${applicationFormId}/details`);

        if (!response.ok) {
            const errorJSON = await response.json().catch(() => null);
            throw new Error(errorJSON?.message || "Erro ao carregar as informações do formulário");
        }

        const [details, user] = await Promise.all([response.json(), userPromise]);
        if (requestId !== openRequestId) return;

        renderAllTabs(details, user);
    } catch (error) {
        if (requestId !== openRequestId) return;

        renderLoadError(error.message || "Erro ao carregar as informações do formulário");
        notyf.error(error.message || "Houve um erro ao carregar as informações do formulário");
    }
}

closeButton.addEventListener("click", closeModal);
cancelButton.addEventListener("click", closeModal);
bindOverlayDismiss(overlay, closeModal);
document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !overlay.hidden) closeModal();
});
