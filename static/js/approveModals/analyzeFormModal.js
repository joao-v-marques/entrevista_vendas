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
    renderInfoGrid,
    renderEmptySection,
    renderKpi,
    renderCommercialTags,
    renderObservationCallout,
} from "../utils/detailsView.js";
import {
    textOrDash,
    isDependent,
    formatPortability,
    formatAdditionals,
    renderResponsibles,
    renderResponsiblesCount,
    renderBeneficiaryTab,
    renderPlanTab,
} from "../utils/formCardsView.js";

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
    history: document.getElementById("financialHistoryContent"),
};

const { setActiveTab, getActiveTab, setTabCount } = createModalTabs(tabList, modalBody);

// cada abertura do modal ganha um número; respostas assíncronas (/details, usuário logado) só são
// aplicadas se ainda forem da abertura atual, senão uma ficha lenta sobrescreveria a que está na tela
let openRequestId = 0;

const ICON_ARROW = `
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <path d="M3 8h10m0 0L9 4m4 4l-4 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`;

const ICON_WARNING = `
    <svg width="18" height="18" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <path d="M8 1.8l6.5 11.4H1.5L8 1.8z" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/>
        <path d="M8 6.3v3.2M8 11.4v.1" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
    </svg>`;

/* ============================================================
   Helpers
   ============================================================ */

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

// a ficha voltou para o financeiro depois de uma reprovação: mostra quem pediu a reanálise e o
// que foi informado. A lista vem da mais recente para a mais antiga e só com as do financeiro
function renderReanalysisAlert(reanalysisRequests) {
    if (!reanalysisRequests || reanalysisRequests.length === 0) return "";

    const latest = reanalysisRequests[0];

    return `
        <div class="mgmt-alert" role="note">
            ${ICON_WARNING}
            <div>
                <p><strong>Ficha em reanálise</strong> — ${reanalysisRequests.length} solicitação(ões), a mais recente por
                ${textOrDash(latest.requester_name)} em ${escapeHtml(formatValue(latest.requested_at, "datetime"))}.</p>
                <p><button type="button" class="mgmt-link" data-go-tab="history">Ver o histórico de reanálises</button></p>
            </div>
        </div>
        ${renderObservationCallout("Observação da reanálise", latest.reanalysis_observation, true)}
    `;
}

function renderSummaryTab(form) {
    return [
        // preenchido quando o /details responder (ver loadDetails)
        `<div id="financialReanalysisContent" class="fin-reanalysis"></div>`,
        renderSummaryHeader(form),
        renderSummarySection("Beneficiário", "beneficiary", "Ver dados completos", renderBeneficiaryKpis(form)),
        renderSummarySection("Plano", "plan", "Ver detalhes do plano", renderPlanKpis(form)),
        renderSummaryObservations(form),
    ].join("");
}

/* ============================================================
   Aba: Histórico de Reanálises
   ============================================================ */

const REANALYSIS_FIELDS = [
    { label: "Solicitado por", key: "requester_name" },
    { label: "Solicitado em", key: "requested_at", format: "datetime" },
    { label: "Observação da solicitação", key: "reanalysis_observation", full: true, pre: true },
];

// todas as rodadas de reanálise do financeiro; o Resumo mostra só a mais recente
function renderHistoryTab(reanalysisRequests) {
    // undefined = /details ainda não respondeu; null = falhou
    if (reanalysisRequests === undefined) return `<p class="modal-loading">Carregando informações...</p>`;
    if (reanalysisRequests === null) {
        return renderSection("Solicitações de Reanálise", `<p class="fin-card-empty fin-card-empty--error">Não foi possível carregar o histórico de reanálises.</p>`);
    }

    if (reanalysisRequests.length === 0) {
        return renderSection("Solicitações de Reanálise", renderEmptySection("Nenhuma reanálise solicitada."));
    }

    // a lista vem da mais recente para a mais antiga, então a numeração é invertida
    const blocks = reanalysisRequests.map((reanalysisRequest, index) => `
        <div class="responsible-block">
            <p class="responsible-block-title">Reanálise ${reanalysisRequests.length - index}${index === 0 ? " (mais recente)" : ""}</p>
            ${renderInfoGrid(reanalysisRequest, REANALYSIS_FIELDS)}
        </div>
    `).join("");

    return renderSection("Solicitações de Reanálise", blocks);
}

/* ============================================================
   Carregamento e abertura
   ============================================================ */

// o /details só é necessário para os responsáveis pela inclusão e as reanálises do financeiro;
// todo o resto já veio da tabela
async function loadDetails(applicationFormId, requestId) {
    let responsibles = null;
    let reanalysisRequests = null;

    try {
        const response = await fetchWithAuth(`/entrevista-adesao/application-forms/${applicationFormId}/details`);
        if (!response.ok) throw new Error("Erro ao carregar o responsável pela inclusão");

        const details = await response.json();
        responsibles = details.responsibles || [];
        // a mesma tabela guarda as reanálises da gerência, que não interessam aqui
        reanalysisRequests = (details.reanalysis_requests || []).filter(request => request.stage === "financial");
    } catch (error) {
        console.error(error);
    }

    if (requestId !== openRequestId) return;

    const reanalysisContainer = document.getElementById("financialReanalysisContent");
    if (reanalysisContainer) reanalysisContainer.innerHTML = renderReanalysisAlert(reanalysisRequests);

    panels.history.innerHTML = renderHistoryTab(reanalysisRequests);
    setTabCount("history", reanalysisRequests ? reanalysisRequests.length : 0);

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
    // o /details chega depois: o badge e a lista dos responsáveis são trocados em loadDetails
    panels.beneficiary.innerHTML = renderBeneficiaryTab(applicationForm, {
        responsiblesBadge: `<span id="financialResponsibleCount"></span>`,
        responsiblesBody: `<div id="financialResponsibleContent">${renderResponsibles(undefined)}</div>`,
    });
    panels.plan.innerHTML = renderPlanTab(applicationForm);
    panels.history.innerHTML = renderHistoryTab(undefined);
    setTabCount("history", 0);
    loadDetails(applicationForm.id, requestId);

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
