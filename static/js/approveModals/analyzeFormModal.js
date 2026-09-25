import { fetchWithAuth, getLoggedUser } from "../utils/apiHelper.js"
import { populateFormsApproveTable } from "../approve_form.js";
import { getFormSubmitButton, setSubmitLoading } from "../utils/submitLoading.js";
import { bindOverlayDismiss } from "../utils/modalOverlay.js";
import { createModalTabs } from "../utils/modalTabs.js";
import {
    escapeHtml,
    formatValue,
    formatAge,
    renderSection,
    renderKpi,
    renderCommercialTags,
    renderObservationCallout,
} from "../utils/detailsView.js";

const overlay = document.getElementById("analyzeModalOverlay");
const formIdLabel = document.getElementById("analyzeModalFormId");
const subtitleLabel = document.getElementById("analyzeModalSubtitle");
const modalBody = document.getElementById("analyzeModalBody");
const tabList = document.getElementById("financialTabs");
const approvalStatusBanner = document.getElementById("approvalStatusBanner");
const financialApprovalForm = document.getElementById("financialApprovalForm");
const closeButton = document.getElementById("analyzeModalClose");
const cancelButton = document.getElementById("analyzeModalCancel");
const submitButton = document.getElementById("analyzeModalSubmit");
const applicationFormIdInput = document.getElementById("application_form_id");
const reviewerIdInput = document.getElementById("reviewer_id");

const panels = {
    summary: document.getElementById("financialSummaryContent"),
    beneficiary: document.getElementById("financialBeneficiaryContent"),
    plan: document.getElementById("financialPlanContent"),
};

const { setActiveTab, getActiveTab } = createModalTabs(tabList, modalBody);

// cada abertura do modal ganha um número; respostas assíncronas (/details, usuário logado) só são
// aplicadas se ainda forem da abertura atual, senão uma ficha lenta sobrescreveria a que está na tela
let openRequestId = 0;

// campos das listas "rótulo → valor" dos cartões das abas de detalhe.
// href (opcional) transforma o valor em link (telefone / e-mail)
const PERSONAL_FIELDS = [
    { label: "CPF", key: "beneficiary_cpf", format: "cpf" },
    { label: "Data de nascimento", key: "beneficiary_birth_date", format: "date" },
    { label: "Idade", key: "beneficiary_age" },
    { label: "Estado civil", key: "beneficiary_marital_state" },
    { label: "Tipo de beneficiário", key: "beneficiary_type", format: "beneficiaryType" },
];

const CONTACT_FIELDS = [
    { label: "Telefone", key: "beneficiary_phone", format: "phone", href: raw => `tel:${String(raw).replace(/\D/g, "")}` },
    { label: "E-mail", key: "beneficiary_email", href: raw => `mailto:${raw}` },
    { label: "E-mail de cobrança", key: "billing_email", href: raw => `mailto:${raw}` },
];

const DEPENDENT_FIELDS = [
    { label: "Titular", key: "secondary_beneficiary_primary_name" },
    { label: "Parentesco", key: "secondary_beneficiary_kinship" },
];

const CONSULTANT_FIELDS = [
    { label: "Consultor", key: "consultant_name" },
    { label: "Ficha criada em", key: "created_at", format: "datetime" },
];

const RESPONSIBLE_FIELDS = [
    { label: "Nome", key: "name" },
    { label: "CPF", key: "cpf", format: "cpf" },
    { label: "Estado civil", key: "marital_state" },
    { label: "Profissão", key: "profession" },
];

const CONTRACT_FIELDS = [
    { label: "Tipo de contrato", key: "contract_type" },
    { label: "Modelo da proposta", key: "model_proposal" },
    { label: "Mês de vencimento", key: "expiration_month" },
    { label: "Opção de carência", key: "grace_option" },
];

const INCLUSION_FIELDS = [
    { label: "Tipo de inclusão", key: "inclusion_type" },
    { label: "Data de inclusão", key: "inclusion_date", format: "date" },
    { label: "Plano anterior", key: "previous_plan" },
    { label: "Cancelamento do plano anterior", key: "previous_plan_cancellation_date", format: "date" },
];

const ICON_ARROW = `
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <path d="M3 8h10m0 0L9 4m4 4l-4 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`;

// ícones dos cabeçalhos dos cartões (mesmo traço 1.3 das abas)
const CARD_ICONS = {
    person: `<path d="M8 8a2.8 2.8 0 1 0 0-5.6A2.8 2.8 0 0 0 8 8zM2.8 14c.6-2.7 2.7-4.2 5.2-4.2s4.6 1.5 5.2 4.2" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>`,
    contact: `<rect x="1.8" y="3.3" width="12.4" height="9.4" rx="1.4" stroke="currentColor" stroke-width="1.3"/><path d="M2.2 4.2L8 8.6l5.8-4.4" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/>`,
    link: `<path d="M6.6 9.4a2.6 2.6 0 0 0 3.7 0l2.3-2.3a2.6 2.6 0 0 0-3.7-3.7l-.9.9M9.4 6.6a2.6 2.6 0 0 0-3.7 0L3.4 8.9a2.6 2.6 0 0 0 3.7 3.7l.9-.9" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>`,
    clipboard: `<rect x="3" y="2.5" width="10" height="11.5" rx="1.3" stroke="currentColor" stroke-width="1.3"/><path d="M6 2.5h4v2H6zM5.5 8h5M5.5 10.5h3.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>`,
    briefcase: `<rect x="1.8" y="4.5" width="12.4" height="8.8" rx="1.3" stroke="currentColor" stroke-width="1.3"/><path d="M5.8 4.5V3.2a.7.7 0 0 1 .7-.7h3a.7.7 0 0 1 .7.7v1.3M1.8 8.3h12.4" stroke="currentColor" stroke-width="1.3"/>`,
    document: `<path d="M4 1.5h5L13 5.5V14a.5.5 0 0 1-.5.5h-9A.5.5 0 0 1 3 14V2a.5.5 0 0 1 .5-.5z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/><path d="M5.5 8.5h5M5.5 11h3.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>`,
    calendar: `<rect x="2" y="2.8" width="12" height="11" rx="1.3" stroke="currentColor" stroke-width="1.3"/><path d="M2 6.2h12M5 1.6v2.2M11 1.6v2.2" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>`,
    percent: `<path d="M12.5 3.5l-9 9" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/><circle cx="4.8" cy="4.8" r="1.8" stroke="currentColor" stroke-width="1.3"/><circle cx="11.2" cy="11.2" r="1.8" stroke="currentColor" stroke-width="1.3"/>`,
    transfer: `<path d="M2.5 5.5h10m0 0L10 3m2.5 2.5L10 8M13.5 10.5h-10m0 0L6 8m-2.5 2.5L6 13" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>`,
    plus: `<rect x="2" y="2" width="12" height="12" rx="3" stroke="currentColor" stroke-width="1.3"/><path d="M8 5.2v5.6M5.2 8h5.6" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>`,
    note: `<path d="M3 2.5h10v8l-3 3H3z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/><path d="M10 13.5v-3h3M5.5 6h5M5.5 8.5h3" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>`,
};

const ICON_CHECK = `<svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M3 8.5l3 3 7-7" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const ICON_CROSS = `<svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>`;

/* ============================================================
   Helpers
   ============================================================ */

function textOrDash(value, format) {
    return escapeHtml(formatValue(value, format));
}

function isDependent(form) {
    return String(form.beneficiary_type || "").trim().toLowerCase() === "secondary";
}

function formatPortability(form) {
    if (!form.is_portability) return "Não";
    return form.portability_accepted ? "Sim — aceita" : "Sim — não aceita";
}

function formatAdditionals(form) {
    const additionals = [];
    if (form.is_pa_digital) additionals.push("PA Digital");
    if (form.is_aeromedic) additionals.push("Aeromédico");
    return additionals.length > 0 ? additionals.join(" + ") : "Nenhum";
}

// seção do Resumo com um atalho, à direita do título, para a aba que detalha o assunto
function renderSummarySection(title, goTab, goLabel, innerHtml) {
    return `
        <section class="modal-section">
            <div class="fin-section-head">
                <h3 class="form-section-title">${escapeHtml(title)}</h3>
                <button type="button" class="fin-go-tab" data-go-tab="${goTab}">${escapeHtml(goLabel)} ${ICON_ARROW}</button>
            </div>
            ${innerHtml}
        </section>
    `;
}

// lista "rótulo → valor" usada dentro dos cartões das abas de detalhe;
// inline põe os itens lado a lado (cartões de largura total com poucos campos)
function renderRows(source, fields, { inline = false } = {}) {
    const rows = fields.map(field => {
        const rawValue = source ? source[field.key] : null;
        const value = formatValue(rawValue, field.format);
        const isEmpty = value === "—";

        const content = field.href && !isEmpty
            ? `<a href="${escapeHtml(field.href(rawValue))}">${escapeHtml(value)}</a>`
            : escapeHtml(value);

        return `
            <div class="fin-row">
                <dt>${escapeHtml(field.label)}</dt>
                <dd${isEmpty ? ` class="is-empty"` : ""}>${content}</dd>
            </div>
        `;
    }).join("");

    return `<dl class="fin-rows${inline ? " fin-rows--inline" : ""}">${rows}</dl>`;
}

function renderCard({ title, icon, body, badge = "", full = false }) {
    return `
        <section class="fin-card${full ? " fin-card--full" : ""}">
            <header class="fin-card-head">
                <span class="fin-card-icon" aria-hidden="true">
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">${CARD_ICONS[icon]}</svg>
                </span>
                <h3 class="fin-card-title">${escapeHtml(title)}</h3>
                ${badge ? `<span class="fin-card-badge">${badge}</span>` : ""}
            </header>
            <div class="fin-card-body">${body}</div>
        </section>
    `;
}

// texto longo dentro de um cartão (observação do desconto, portabilidade, observações especiais)
function renderNote(label, text) {
    const trimmedText = (text || "").trim();
    if (!trimmedText) return "";

    return `
        <div class="fin-note">
            <span class="fin-note-label">${escapeHtml(label)}</span>
            <p class="fin-note-text">${escapeHtml(trimmedText)}</p>
        </div>
    `;
}

function renderCardEmpty(message) {
    return `<p class="fin-card-empty">${escapeHtml(message)}</p>`;
}

// iniciais do nome para o avatar do cabeçalho da aba Beneficiário
function getInitials(name) {
    const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return "?";
    const first = parts[0][0];
    const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
    return `${first}${last}`.toUpperCase();
}

// cabeçalho de destaque das abas de detalhe (avatar/ícone + título + linha de apoio + etiquetas)
function renderDetailHero({ visual, eyebrow, title, meta, tags = "" }) {
    return `
        <div class="fin-hero">
            ${visual}
            <div class="fin-hero-text">
                <span class="fin-hero-eyebrow">${escapeHtml(eyebrow)}</span>
                <p class="fin-hero-title">${title}</p>
                ${meta ? `<p class="fin-hero-meta">${meta}</p>` : ""}
            </div>
            ${tags ? `<div class="fin-hero-tags">${tags}</div>` : ""}
        </div>
    `;
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

function renderBeneficiaryKpis(form) {
    const dependent = isDependent(form);

    const bond = dependent
        ? renderKpi({
            label: "Vínculo",
            value: "Dependente",
            foot: `Titular: ${textOrDash(form.secondary_beneficiary_primary_name)} · ${textOrDash(form.secondary_beneficiary_kinship)}`,
        })
        : renderKpi({
            label: "Vínculo",
            value: textOrDash(form.beneficiary_type, "beneficiaryType"),
            foot: form.cnpj ? `CNPJ: ${textOrDash(form.cnpj, "cnpj")}` : "",
        });

    return `
        <div class="mgmt-kpis">
            ${renderKpi({
                label: "CPF",
                value: textOrDash(form.beneficiary_cpf, "cpf"),
            })}
            ${renderKpi({
                label: "Idade",
                value: escapeHtml(formatAge(form.beneficiary_birth_date)),
                foot: `Nascimento: ${textOrDash(form.beneficiary_birth_date, "date")}`,
            })}
            ${bond}
            ${renderKpi({
                label: "Telefone",
                value: textOrDash(form.beneficiary_phone, "phone"),
            })}
            ${renderKpi({
                label: "E-mail de cobrança",
                value: textOrDash(form.billing_email),
                foot: `E-mail: ${textOrDash(form.beneficiary_email)}`,
                wide: true,
            })}
        </div>
    `;
}

function renderPlanKpis(form) {
    const discount = form.is_discount ? formatValue(form.discount_percentage, "percentage") : "Não";

    return `
        <div class="mgmt-kpis">
            ${renderKpi({
                label: "Plano",
                value: textOrDash(form.plan_type),
                foot: `${textOrDash(form.contract_type)} · ${textOrDash(form.model_proposal)}`,
            })}
            ${renderKpi({
                label: "Mês de vencimento",
                value: textOrDash(form.expiration_month),
            })}
            ${renderKpi({
                label: "Opção de carência",
                value: textOrDash(form.grace_option),
            })}
            ${renderKpi({
                label: "Desconto",
                value: escapeHtml(discount),
                highlight: Boolean(form.is_discount),
            })}
            ${renderKpi({
                label: "Portabilidade",
                value: escapeHtml(formatPortability(form)),
                foot: form.is_portability && form.portability_accepted_date
                    ? `Aceite em ${textOrDash(form.portability_accepted_date, "date")}`
                    : "",
                highlight: Boolean(form.is_portability),
            })}
            ${renderKpi({
                label: "Adicionais",
                value: escapeHtml(formatAdditionals(form)),
            })}
        </div>
    `;
}

// só entram as observações preenchidas; sem nenhuma, a seção inteira some
function renderSummaryObservations(form) {
    const callouts = [];

    if (form.is_discount && (form.discount_observation || "").trim()) {
        callouts.push(renderObservationCallout("Observação do desconto", form.discount_observation, true));
    }
    if (form.is_portability && (form.portability_observation || "").trim()) {
        callouts.push(renderObservationCallout("Observação da portabilidade", form.portability_observation, true));
    }
    if ((form.especial_observations || "").trim()) {
        callouts.push(renderObservationCallout("Observações especiais", form.especial_observations));
    }

    if (callouts.length === 0) return "";
    return renderSection("Observações da ficha", `<div class="fin-callouts">${callouts.join("")}</div>`);
}

function renderSummaryTab(form) {
    return [
        renderSummaryHeader(form),
        renderSummarySection("Beneficiário", "beneficiary", "Ver dados completos", renderBeneficiaryKpis(form)),
        renderSummarySection("Plano", "plan", "Ver detalhes do plano", renderPlanKpis(form)),
        renderSummaryObservations(form),
    ].join("");
}

/* ============================================================
   Aba: Beneficiário
   ============================================================ */

// a ficha pode ter mais de um responsável pela inclusão; com um só, não há numeração
function renderResponsibles(responsibles) {
    // undefined = /details ainda não respondeu; null = falhou
    if (responsibles === undefined) return renderCardEmpty("Carregando informações...");
    if (responsibles === null) return `<p class="fin-card-empty fin-card-empty--error">Não foi possível carregar os responsáveis pela inclusão.</p>`;

    if (responsibles.length === 0) return renderCardEmpty("Nenhum responsável pela inclusão cadastrado.");
    if (responsibles.length === 1) return renderRows(responsibles[0], RESPONSIBLE_FIELDS);

    return responsibles.map((responsible, index) => `
        <div class="fin-subblock">
            <p class="fin-subblock-title">Responsável ${index + 1}</p>
            ${renderRows(responsible, RESPONSIBLE_FIELDS)}
        </div>
    `).join("");
}

// badge com a quantidade no cabeçalho do cartão, só quando há mais de um responsável
function renderResponsiblesCount(responsibles) {
    return Array.isArray(responsibles) && responsibles.length > 1
        ? `<span class="pill pill--gray">${responsibles.length}</span>`
        : "";
}

function renderBeneficiaryHero(form) {
    const dependent = isDependent(form);

    const meta = [
        `CPF <strong>${textOrDash(form.beneficiary_cpf, "cpf")}</strong>`,
        `<strong>${escapeHtml(formatAge(form.beneficiary_birth_date))}</strong> (nasc. ${textOrDash(form.beneficiary_birth_date, "date")})`,
    ].join(`<span class="fin-hero-sep" aria-hidden="true">·</span>`);

    return renderDetailHero({
        visual: `<span class="fin-avatar" aria-hidden="true">${escapeHtml(getInitials(form.beneficiary_name))}</span>`,
        eyebrow: "Beneficiário",
        title: textOrDash(form.beneficiary_name),
        meta,
        tags: `<span class="pill ${dependent ? "pill--amber" : "pill--green"}">${textOrDash(form.beneficiary_type, "beneficiaryType")}</span>`,
    });
}

function renderBondCard(form) {
    const cnpjField = { label: "CNPJ", key: "cnpj", format: "cnpj" };

    const body = isDependent(form)
        ? renderRows(form, [...DEPENDENT_FIELDS, cnpjField])
        : renderRows(form, [
            { label: "Vínculo", key: "beneficiary_type", format: "beneficiaryType" },
            cnpjField,
        ]);

    return renderCard({ title: "Vínculo", icon: "link", body });
}

function renderBeneficiaryTab(form, responsibles) {
    const source = { ...form, beneficiary_age: formatAge(form.beneficiary_birth_date) };

    const cards = [
        renderCard({ title: "Dados pessoais", icon: "person", body: renderRows(source, PERSONAL_FIELDS) }),
        renderCard({ title: "Contato", icon: "contact", body: renderRows(form, CONTACT_FIELDS) }),
        renderBondCard(form),
        renderCard({
            title: "Responsáveis pela inclusão",
            icon: "clipboard",
            // o /details chega depois: o badge e a lista são trocados em loadResponsibles
            badge: `<span id="financialResponsibleCount">${renderResponsiblesCount(responsibles)}</span>`,
            body: `<div id="financialResponsibleContent">${renderResponsibles(responsibles)}</div>`,
        }),
        renderCard({
            title: "Consultor",
            icon: "briefcase",
            body: renderRows(form, CONSULTANT_FIELDS, { inline: true }),
            full: true,
        }),
    ].join("");

    return `${renderBeneficiaryHero(form)}<div class="fin-cards">${cards}</div>`;
}

/* ============================================================
   Aba: Plano
   ============================================================ */

function renderPlanHero(form) {
    const meta = [
        `Contrato <strong>${textOrDash(form.contract_type)}</strong>`,
        `Modelo <strong>${textOrDash(form.model_proposal)}</strong>`,
        `Vencimento <strong>${textOrDash(form.expiration_month)}</strong>`,
    ].join(`<span class="fin-hero-sep" aria-hidden="true">·</span>`);

    return renderDetailHero({
        visual: `<span class="fin-hero-icon" aria-hidden="true"><svg width="22" height="22" viewBox="0 0 16 16" fill="none">${CARD_ICONS.document}</svg></span>`,
        eyebrow: "Plano contratado",
        title: textOrDash(form.plan_type),
        meta,
        tags: renderCommercialTags(form),
    });
}

function renderDiscountCard(form) {
    if (!form.is_discount) {
        return renderCard({
            title: "Desconto",
            icon: "percent",
            badge: `<span class="pill pill--gray">Não</span>`,
            body: renderCardEmpty("Ficha sem desconto."),
        });
    }

    const body = `
        <div class="fin-stat">
            <span class="fin-stat-value">${textOrDash(form.discount_percentage, "percentage")}</span>
            <span class="fin-stat-label">de desconto sobre o plano</span>
        </div>
        ${renderNote("Observação do desconto", form.discount_observation)}
    `;

    return renderCard({
        title: "Desconto",
        icon: "percent",
        badge: `<span class="pill pill--amber">Com desconto</span>`,
        body,
    });
}

function renderPortabilityCard(form) {
    if (!form.is_portability) {
        return renderCard({
            title: "Portabilidade",
            icon: "transfer",
            badge: `<span class="pill pill--gray">Não</span>`,
            body: renderCardEmpty("Ficha sem portabilidade."),
        });
    }

    const badge = form.portability_accepted
        ? `<span class="pill pill--green">Aceita</span>`
        : `<span class="pill pill--red">Não aceita</span>`;

    const body = `
        ${renderRows(form, [
            { label: "Portabilidade aceita", key: "portability_accepted", format: "boolean" },
            { label: "Data de aceite", key: "portability_accepted_date", format: "date" },
        ])}
        ${renderNote("Observação da portabilidade", form.portability_observation)}
    `;

    return renderCard({ title: "Portabilidade", icon: "transfer", badge, body });
}

function renderFlag(label, isOn) {
    return `
        <span class="fin-flag ${isOn ? "is-on" : "is-off"}">
            ${isOn ? ICON_CHECK : ICON_CROSS}
            ${escapeHtml(label)}
            <span class="fin-flag-state">${isOn ? "Contratado" : "Não contratado"}</span>
        </span>
    `;
}

function renderPlanTab(form) {
    const observations = (form.especial_observations || "").trim()
        ? `<p class="fin-note-text">${escapeHtml(form.especial_observations.trim())}</p>`
        : renderCardEmpty("Nenhuma observação especial registrada.");

    const cards = [
        renderCard({ title: "Contrato", icon: "document", body: renderRows(form, CONTRACT_FIELDS) }),
        renderCard({ title: "Inclusão", icon: "calendar", body: renderRows(form, INCLUSION_FIELDS) }),
        renderDiscountCard(form),
        renderPortabilityCard(form),
        renderCard({
            title: "Adicionais",
            icon: "plus",
            body: `<div class="fin-flags">${renderFlag("PA Digital", form.is_pa_digital)}${renderFlag("Aeromédico", form.is_aeromedic)}</div>`,
            full: true,
        }),
        renderCard({ title: "Observações especiais", icon: "note", body: observations, full: true }),
    ].join("");

    return `${renderPlanHero(form)}<div class="fin-cards">${cards}</div>`;
}

/* ============================================================
   Carregamento e abertura
   ============================================================ */

// o /details só é necessário para os responsáveis pela inclusão; todo o resto já veio da tabela
async function loadResponsibles(applicationFormId, requestId) {
    let responsibles = null;

    try {
        const response = await fetchWithAuth(`/entrevista-adesao/application-forms/${applicationFormId}/details`);
        if (!response.ok) throw new Error("Erro ao carregar o responsável pela inclusão");

        const details = await response.json();
        responsibles = details.responsibles || [];
    } catch (error) {
        console.error(error);
    }

    if (requestId !== openRequestId) return;

    const container = document.getElementById("financialResponsibleContent");
    if (container) container.innerHTML = renderResponsibles(responsibles);

    const countBadge = document.getElementById("financialResponsibleCount");
    if (countBadge) countBadge.innerHTML = renderResponsiblesCount(responsibles);
}

function closeModal() {
    overlay.hidden = true;
    // invalida respostas ainda pendentes da ficha que acabou de ser fechada
    openRequestId += 1;
}

// hoje não existe análise anterior para carregar (endpoint ainda não existe),
// então o formulário sempre abre limpo, pronto pra ser preenchido
function resetApprovalSection() {
    approvalStatusBanner.innerHTML = `<span class="pill pill--gray">Ainda não analisado</span>`;
    financialApprovalForm.reset();
}

export function openAnalyzeFormModal(applicationForm) {
    openRequestId += 1;
    const requestId = openRequestId;

    formIdLabel.textContent = applicationForm.id;
    subtitleLabel.textContent = applicationForm.beneficiary_name || "";

    resetApprovalSection();
    setActiveTab("summary");

    panels.summary.innerHTML = renderSummaryTab(applicationForm);
    panels.beneficiary.innerHTML = renderBeneficiaryTab(applicationForm, undefined);
    panels.plan.innerHTML = renderPlanTab(applicationForm);
    loadResponsibles(applicationForm.id, requestId);

    // preenche os campos ocultos que vão junto no envio pro backend
    applicationFormIdInput.value = applicationForm.id;
    reviewerIdInput.value = "";
    getLoggedUser().then(user => {
        if (requestId === openRequestId) reviewerIdInput.value = user?.id ?? "";
    });

    overlay.hidden = false;
}

// atalhos "Ver dados completos" / "Ver detalhes do plano" do Resumo
modalBody.addEventListener("click", (event) => {
    const goTabButton = event.target.closest("[data-go-tab]");
    if (goTabButton) setActiveTab(goTabButton.dataset.goTab);
});

// o formulário de decisão mora na aba Resumo. Se o envio partir de outra aba, os campos obrigatórios
// estariam em um painel oculto e a validação nativa falharia sem mostrar nada; o click roda antes da
// validação, então basta voltar para o Resumo aqui
submitButton.addEventListener("click", () => {
    if (getActiveTab() !== "summary") setActiveTab("summary");
});

function submitForm() {
    const formSubmitButton = getFormSubmitButton(financialApprovalForm);

    financialApprovalForm.addEventListener("submit", async (e) => {
        e.preventDefault();

        // pega os dados do formulário
        const formData = new FormData(financialApprovalForm);

        // validação para remover espaços no inicio e final da string
        for (let [key, value] of formData.entries()) {
            if (typeof value === "string") {
                formData.set(key, value.trim());
            }
        }

        // monta o payload
        const data = Object.fromEntries(formData.entries());
        data.application_form_id = Number(data.application_form_id);
        data.financial_reviewer_id = Number(data.financial_reviewer_id);
        // sem nenhum radio marcado a chave nem existe no FormData: envia null para o backend
        // recusar a análise, em vez de gravar uma reprovação silenciosa
        const decision = formData.get("financial_approved");
        data.financial_approved = decision === null ? null : decision === "true";
        data.financial_reviewed_at = new Date().toISOString();

        setSubmitLoading(formSubmitButton, true);
        try {
            const response = await fetchWithAuth("/entrevista-adesao/application_form_approval", {
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
            await populateFormsApproveTable();
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
