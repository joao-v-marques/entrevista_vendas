import { fetchWithAuth, getLoggedUser } from "../utils/apiHelper.js";
import { populateRejectedManagementFormsTable } from "../rejected_management_forms.js";
import { setSubmitLoading } from "../utils/submitLoading.js";
import { bindOverlayDismiss } from "../utils/modalOverlay.js";
import { syncBodyScrollLock } from "../utils/modalControl.js";
import {
    escapeHtml, formatValue, formatDateTime, formatAge, formatBeneficiaryType, formatBytes, renderCommercialTags,
} from "../utils/detailsView.js";

const overlay = document.getElementById("requestReanalysisModalOverlay");
const formIdLabel = document.getElementById("requestReanalysisModalFormId");
const reasonContainer = document.getElementById("requestReanalysisReason");
const beneficiaryContainer = document.getElementById("requestReanalysisBeneficiary");
const historyDetails = document.getElementById("requestReanalysisHistory");
const historySummary = document.getElementById("requestReanalysisHistorySummary");
const historyList = document.getElementById("requestReanalysisHistoryList");
const requestReanalysisForm = document.getElementById("requestReanalysisForm");
const observationInput = document.getElementById("reanalysisObservation");
const observationError = document.getElementById("reanalysisObservationError");
const fileInput = document.getElementById("reanalysisMedicalReport");
const fileList = document.getElementById("reanalysisFileList");
const dropzone = document.getElementById("reanalysisDropzone");
const closeButton = document.getElementById("requestReanalysisModalClose");
const cancelButton = document.getElementById("requestReanalysisModalCancel");
const submitButton = document.getElementById("requestReanalysisModalSubmit");
const requesterIdInput = document.getElementById("reanalysis_requester_id");

// mesmas extensões do accept do input: o arrastar-e-soltar não respeita o accept sozinho
const ACCEPTED_EXTENSIONS = [".pdf", ".jpg", ".jpeg", ".png"];

// guarda a ficha que está sendo reanalisada, já que o id vai na URL do endpoint
let currentApplicationFormId = null;

// cada abertura ganha um número; resposta do /details que chega depois de trocar de ficha é descartada
let detailsRequestToken = 0;

function closeModal() {
    overlay.hidden = true;
    syncBodyScrollLock();
    currentApplicationFormId = null;
    detailsRequestToken++;
}

// ---------- Motivo da reprova ----------

function renderReasonLoading() {
    reasonContainer.innerHTML = `
        <div class="rr-skeleton" aria-hidden="true">
            <span class="rr-skeleton-line"></span>
            <span class="rr-skeleton-line"></span>
            <span class="rr-skeleton-line rr-skeleton-line--short"></span>
        </div>
        <span class="sr-only">Carregando o motivo da reprova...</span>
    `;
}

function renderReasonError(applicationForm) {
    reasonContainer.innerHTML = `
        <div class="rr-verdict-error">
            <p>Não foi possível carregar o motivo da reprova.</p>
            <button type="button" class="btn btn--outline btn--sm" data-retry>Tentar novamente</button>
        </div>
    `;
    reasonContainer.querySelector("[data-retry]").addEventListener("click", () => loadDetails(applicationForm));
}

function renderReason(management) {
    const observation = (management?.management_observation || "").trim();

    const quote = observation
        ? `<blockquote class="rr-verdict-quote">${escapeHtml(observation)}</blockquote>`
        : `<p class="rr-verdict-quote rr-verdict-quote--empty">A gerência não registrou o motivo desta reprova.</p>`;

    const author = management?.manager_name ? escapeHtml(management.manager_name) : "Gerência";
    const reviewedAt = management?.management_reviewed_at
        ? `<time datetime="${escapeHtml(management.management_reviewed_at)}">${escapeHtml(formatDateTime(management.management_reviewed_at))}</time>`
        : "";

    reasonContainer.innerHTML = `
        ${quote}
        <p class="rr-verdict-author">
            <span>${author}</span>
            ${reviewedAt ? `<span class="rr-verdict-date">em ${reviewedAt}</span>` : ""}
        </p>
    `;
}

// ---------- Beneficiário ----------

function renderBeneficiaryRow(label, value) {
    return `
        <div class="rr-ben-row">
            <dt>${escapeHtml(label)}</dt>
            <dd>${value}</dd>
        </div>
    `;
}

function renderBeneficiary(form) {
    const birth = form.beneficiary_birth_date
        ? `${escapeHtml(formatAge(form.beneficiary_birth_date))}<span class="rr-ben-sub">${escapeHtml(formatValue(form.beneficiary_birth_date, "date"))}</span>`
        : "—";

    const plan = form.plan_type
        ? `${escapeHtml(form.plan_type)}${form.contract_type ? `<span class="rr-ben-sub">${escapeHtml(form.contract_type)}</span>` : ""}`
        : "—";

    const contact = [form.beneficiary_phone && formatValue(form.beneficiary_phone, "phone"), form.beneficiary_email]
        .filter(Boolean)
        .map(item => `<span class="rr-ben-contact">${escapeHtml(item)}</span>`)
        .join("") || "—";

    // dependente: mostra a quem está vinculado e o parentesco
    const holder = form.secondary_beneficiary_primary_name
        ? renderBeneficiaryRow(
            "Titular",
            `${escapeHtml(form.secondary_beneficiary_primary_name)}${form.secondary_beneficiary_kinship ? `<span class="rr-ben-sub">${escapeHtml(form.secondary_beneficiary_kinship)}</span>` : ""}`
        )
        : "";

    const tags = renderCommercialTags(form);

    beneficiaryContainer.innerHTML = `
        <div class="rr-ben-head">
            <p class="rr-ben-name">${escapeHtml(form.beneficiary_name || "—")}</p>
            <p class="rr-ben-cpf">${escapeHtml(formatValue(form.beneficiary_cpf, "cpf"))}</p>
            <span class="pill pill--gray rr-ben-type">${escapeHtml(formatBeneficiaryType(form.beneficiary_type) || "—")}</span>
        </div>
        <dl class="rr-ben-list">
            ${renderBeneficiaryRow("Idade", birth)}
            ${holder}
            ${renderBeneficiaryRow("Contato", contact)}
            ${renderBeneficiaryRow("Plano", plan)}
            ${renderBeneficiaryRow("Inclusão", `${escapeHtml(formatValue(form.inclusion_type))}<span class="rr-ben-sub">em ${escapeHtml(formatValue(form.inclusion_date, "date"))}</span>`)}
            ${renderBeneficiaryRow("Consultor", escapeHtml(formatValue(form.consultant_name)))}
        </dl>
        ${tags ? `<div class="forms-tags rr-ben-tags">${tags}</div>` : ""}
    `;
}

// ---------- Solicitações anteriores ----------

function renderHistory(reanalysisRequests) {
    // só as reanálises pedidas à gerência; as do financeiro não dizem respeito a esta reprova
    const previous = (reanalysisRequests || [])
        .filter(request => (request.stage || "management") === "management")
        .sort((a, b) => new Date(b.requested_at) - new Date(a.requested_at));

    if (previous.length === 0) {
        historyDetails.hidden = true;
        historyList.innerHTML = "";
        return;
    }

    historySummary.textContent = previous.length === 1
        ? "Esta ficha já teve 1 reanálise solicitada"
        : `Esta ficha já teve ${previous.length} reanálises solicitadas`;

    historyList.innerHTML = previous.map(request => `
        <li class="rr-history-item">
            <p class="rr-history-meta">
                <span>${escapeHtml(formatValue(request.requester_name))}</span>
                <time>${escapeHtml(formatValue(request.requested_at, "datetime"))}</time>
            </p>
            <p class="rr-history-text">${escapeHtml((request.reanalysis_observation || "").trim() || "Sem observação.")}</p>
        </li>
    `).join("");

    historyDetails.open = false;
    historyDetails.hidden = false;
}

async function loadDetails(applicationForm) {
    const token = ++detailsRequestToken;
    renderReasonLoading();

    try {
        const response = await fetchWithAuth(`/entrevista-adesao/application-forms/${applicationForm.id}/details`);

        if (!response.ok) throw new Error(`Erro ${response.status}`);

        const details = await response.json();
        if (token !== detailsRequestToken) return;

        renderReason(details.management);
        if (details.form) renderBeneficiary(details.form);
        renderHistory(details.reanalysis_requests);
    } catch (error) {
        if (token !== detailsRequestToken) return;
        renderReasonError(applicationForm);
    }
}

// ---------- Laudos ----------

function isAcceptedFile(file) {
    const name = file.name.toLowerCase();
    return ACCEPTED_EXTENSIONS.some(extension => name.endsWith(extension));
}

// o input é a fonte da verdade (é ele que vai no FormData); a lista só espelha o que está nele
function setFiles(files) {
    const transfer = new DataTransfer();
    files.forEach(file => transfer.items.add(file));
    fileInput.files = transfer.files;
    renderFileList();
}

function renderFileList() {
    const files = [...fileInput.files];
    fileList.hidden = files.length === 0;

    fileList.innerHTML = files.map((file, index) => `
        <li class="rr-file">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="M9 1.5H4.5a1 1 0 00-1 1v11a1 1 0 001 1h7a1 1 0 001-1V5L9 1.5z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/>
                <path d="M9 1.5V5h3.5" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/>
            </svg>
            <span class="rr-file-name">${escapeHtml(file.name)}</span>
            <span class="rr-file-size">${escapeHtml(formatBytes(file.size))}</span>
            <button type="button" class="rr-file-remove" data-index="${index}" aria-label="Remover ${escapeHtml(file.name)}">
                <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M3 3l10 10M13 3L3 13" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
            </button>
        </li>
    `).join("");
}

// selecionar de novo pelo seletor soma aos arquivos já escolhidos, em vez de substituir
let filesBeforePicker = [];

fileInput.addEventListener("click", () => {
    filesBeforePicker = [...fileInput.files];
});

fileInput.addEventListener("change", () => {
    const picked = [...fileInput.files].filter(isAcceptedFile);
    setFiles([...filesBeforePicker, ...picked]);
    filesBeforePicker = [];
});

fileList.addEventListener("click", (event) => {
    const removeButton = event.target.closest(".rr-file-remove");
    if (!removeButton) return;

    const files = [...fileInput.files];
    files.splice(Number(removeButton.dataset.index), 1);
    setFiles(files);
    dropzone.focus?.();
});

["dragenter", "dragover"].forEach(type => dropzone.addEventListener(type, (event) => {
    event.preventDefault();
    dropzone.classList.add("is-dragging");
}));

["dragleave", "drop"].forEach(type => dropzone.addEventListener(type, () => {
    dropzone.classList.remove("is-dragging");
}));

dropzone.addEventListener("drop", (event) => {
    event.preventDefault();

    const dropped = [...(event.dataTransfer?.files || [])];
    const accepted = dropped.filter(isAcceptedFile);

    if (accepted.length < dropped.length) {
        notyf.error("Só é possível anexar laudos em PDF, JPG ou PNG");
    }
    if (accepted.length) setFiles([...fileInput.files, ...accepted]);
});

// ---------- Abertura ----------

function showObservationError(visible) {
    observationError.hidden = !visible;
    observationInput.classList.toggle("error", visible);
    observationInput.setAttribute("aria-invalid", String(visible));
}

export function openRequestReanalysisModal(applicationForm) {
    currentApplicationFormId = applicationForm.id;

    formIdLabel.textContent = applicationForm.id;

    // limpa a observação e o arquivo selecionado para não vazar dados de outra ficha
    requestReanalysisForm.reset();
    renderFileList();
    showObservationError(false);
    historyDetails.hidden = true;

    // os dados da listagem já bastam para o resumo; o /details completa e traz o motivo
    renderBeneficiary(applicationForm);
    loadDetails(applicationForm);

    requesterIdInput.value = "";
    getLoggedUser().then(user => {
        requesterIdInput.value = user?.id ?? "";
    });

    overlay.hidden = false;
    syncBodyScrollLock();
    observationInput.focus();
}

observationInput.addEventListener("input", () => {
    if (!observationError.hidden && observationInput.value.trim()) showObservationError(false);
});

function submitForm() {
    requestReanalysisForm.addEventListener("submit", async (e) => {
        e.preventDefault();

        if (!currentApplicationFormId) return;

        if (!observationInput.value.trim()) {
            showObservationError(true);
            observationInput.focus();
            return;
        }

        // o FormData vai cru mesmo: como carrega arquivo, o próprio browser precisa montar o
        // Content-Type com o boundary do multipart. Definir o header na mão quebraria o upload.
        const formData = new FormData(requestReanalysisForm);

        const observation = formData.get("reanalysis_observation");
        if (typeof observation === "string") {
            formData.set("reanalysis_observation", observation.trim());
        }

        // evita envio duplicado enquanto o upload do laudo está em andamento
        setSubmitLoading(submitButton, true, "Solicitando...");

        try {
            const response = await fetchWithAuth(`/entrevista-adesao/application_form_management/${currentApplicationFormId}/request-reanalysis`, {
                method: "POST",
                body: formData,
            });

            if (!response.ok) {
                const errorJSON = await response.json().catch(() => null);
                throw new Error(errorJSON?.message || `Erro ${response.status} ao solicitar reanálise`);
            }

            closeModal();
            notyf.success("Reanálise solicitada");
            await populateRejectedManagementFormsTable();
        } catch (error) {
            notyf.error(error.message || "Não foi possível solicitar a reanálise. Tente novamente.");
        } finally {
            setSubmitLoading(submitButton, false);
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
