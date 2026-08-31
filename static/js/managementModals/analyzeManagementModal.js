import { renderBeneficiaryInfo } from "../approveModals/beneficiaryInfoView.js";
import { fetchWithAuth, getLoggedUser } from "../utils/apiHelper.js"
import { formatDateTimeToBR } from "../utils/dateUtils.js";
import { populateManagementApproveTable } from "../management_approval.js";
import { getFormSubmitButton, setSubmitLoading } from "../utils/submitLoading.js";
import { bindOverlayDismiss } from "../utils/modalOverlay.js";

const overlay = document.getElementById("analyzeManagementModalOverlay");
const formIdLabel = document.getElementById("analyzeManagementModalFormId");
const beneficiaryInfoGrid = document.getElementById("managementBeneficiaryInfoGrid");
const approvalStatusBanner = document.getElementById("managementApprovalStatusBanner");
const managementApprovalForm = document.getElementById("managementApprovalForm");
const closeButton = document.getElementById("analyzeManagementModalClose");
const cancelButton = document.getElementById("analyzeManagementModalCancel");
const applicationFormIdInput = document.getElementById("management_application_form_id");
const managerIdInput = document.getElementById("manager_id_input");
const reanalysisSection = document.getElementById("managementReanalysisSection");
const reanalysisContent = document.getElementById("managementReanalysisContent");
const interviewContent = document.getElementById("managementInterviewContent");

function closeModal() {
    overlay.hidden = true;
}

// hoje não existe análise anterior para carregar (endpoint ainda não existe),
// então o formulário sempre abre limpo, pronto pra ser preenchido
function resetApprovalSection() {
    approvalStatusBanner.innerHTML = `<span class="pill pill--gray">Ainda não analisado</span>`;
    managementApprovalForm.reset();
}

function escapeHtml(value) {
    if (value === null || value === undefined) return "";

    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;");
}

// monta a lista de laudos de uma rodada, com link que abre o arquivo no navegador
function renderMedicalReports(documents) {
    if (documents.length === 0) {
        return `<p class="empty-section">Nenhum laudo médico anexado nesta solicitação.</p>`;
    }

    const items = documents.map(document => `
        <a class="document-item" href="/entrevista-adesao/application-form-documents/${document.id}/file"
           target="_blank" rel="noopener">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M4 1.5h5L13 5.5V14a.5.5 0 0 1-.5.5h-9A.5.5 0 0 1 3 14V2a.5.5 0 0 1 .5-.5z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/>
                <path d="M9 1.5V5.5h4" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/>
            </svg>
            <span>${escapeHtml(document.original_filename || "laudo")}</span>
        </a>
    `).join("");

    return `<div class="documents-list">${items}</div>`;
}

// destaca um texto longo em um bloco próprio, mais legível do que espremido em um item da grade
function renderObservationCallout(label, text, isHighlighted = false) {
    const trimmedText = (text || "").trim();

    const body = trimmedText
        ? `<p class="observation-callout-text">${escapeHtml(trimmedText)}</p>`
        : `<p class="observation-callout-text observation-callout-text--empty">Nenhuma observação registrada.</p>`;

    return `
        <div class="observation-callout${isHighlighted ? " observation-callout--highlight" : ""}">
            <span class="observation-callout-label">${label}</span>
            ${body}
        </div>
    `;
}

// Mostra à gerência o resultado da entrevista e, principalmente, o que o entrevistador anotou,
// para a decisão ser tomada com o mesmo contexto de quem conversou com o beneficiário.
function renderInterviewSection(details) {
    const interview = details.interview;

    if (!interview) {
        interviewContent.innerHTML = `<p class="empty-section">Esta ficha ainda não possui entrevista registrada.</p>`;
        return;
    }

    // interview_approved fica nulo enquanto a entrevista está só agendada, sem análise
    let resultPill = `<span class="pill pill--gray">Entrevista ainda não analisada</span>`;
    if (interview.interview_approved === true) resultPill = `<span class="pill pill--green">Entrevista aprovada</span>`;
    if (interview.interview_approved === false) resultPill = `<span class="pill pill--red">Entrevista reprovada</span>`;

    const reviewedAt = formatDateTimeToBR(interview.interview_reviewed_at);

    interviewContent.innerHTML = `
        <div class="approval-status">
            ${resultPill}
            ${reviewedAt ? `<span class="approval-status-meta">Analisada em ${escapeHtml(reviewedAt)}</span>` : ``}
        </div>

        <div class="info-grid">
            <div class="info-item">
                <span class="info-label">Entrevistador</span>
                <span class="info-value">${escapeHtml(interview.interviewer_name || "—")}</span>
            </div>
            <div class="info-item">
                <span class="info-label">Data da entrevista</span>
                <span class="info-value">${escapeHtml(formatDateTimeToBR(interview.interview_date) || "—")}</span>
            </div>
        </div>

        ${renderObservationCallout("Observações da entrevista", interview.interview_observation, true)}
        ${renderObservationCallout("Observação do agendamento", interview.schedule_observation)}
    `;
}

// Mostra por que a ficha voltou para a gerência: a observação da reprovação anterior,
// o que foi alegado na reanálise e os laudos anexados.
function renderReanalysisSection(details) {
    const reanalysisRequests = details.reanalysis_requests || [];

    // ficha em primeira análise não tem reanálise nenhuma, a seção fica escondida
    if (reanalysisRequests.length === 0) {
        reanalysisSection.hidden = true;
        reanalysisContent.innerHTML = ``;
        return;
    }

    const medicalReports = (details.documents || []).filter(document => document.document_type === "laudo_medico");
    const previousObservation = details.management?.management_observation;

    // o wrapper só é renderizado quando existe observação, senão sobraria uma grade
    // vazia carregando o espaçamento que separa esse trecho dos blocos de reanálise
    const previousHtml = previousObservation
        ? `
            <div class="info-grid reanalysis-previous">
                <div class="info-item info-item--full">
                    <span class="info-label">Observação da reprovação anterior</span>
                    <span class="info-value info-value--pre">${escapeHtml(previousObservation)}</span>
                </div>
            </div>
        `
        : ``;

    // a lista vem da mais recente para a mais antiga, então a numeração é invertida
    const blocks = reanalysisRequests.map((reanalysisRequest, index) => {
        const reports = medicalReports.filter(document => document.reanalysis_request_id === reanalysisRequest.id);

        return `
            <div class="responsible-block">
                <p class="responsible-block-title">Reanálise ${reanalysisRequests.length - index}</p>
                <div class="info-grid">
                    <div class="info-item">
                        <span class="info-label">Solicitado por</span>
                        <span class="info-value">${escapeHtml(reanalysisRequest.requester_name || "—")}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Solicitado em</span>
                        <span class="info-value">${escapeHtml(formatDateTimeToBR(reanalysisRequest.requested_at) || "—")}</span>
                    </div>
                    <div class="info-item info-item--full">
                        <span class="info-label">Observação da solicitação</span>
                        <span class="info-value info-value--pre">${escapeHtml(reanalysisRequest.reanalysis_observation || "—")}</span>
                    </div>
                </div>
                ${renderMedicalReports(reports)}
            </div>
        `;
    }).join("");

    reanalysisContent.innerHTML = `${previousHtml}${blocks}`;
    reanalysisSection.hidden = false;
}

// busca o histórico completo da ficha: a entrevista e se ela já passou por uma reanálise
async function loadFormDetails(applicationFormId) {
    try {
        const response = await fetchWithAuth(`/entrevista-adesao/application-forms/${applicationFormId}/details`);

        if (!response.ok) throw new Error("Erro ao carregar o histórico da ficha");

        const details = await response.json();

        renderInterviewSection(details);
        renderReanalysisSection(details);
    } catch (error) {
        // a análise não pode ser bloqueada por causa do histórico, então só esconde a seção
        console.log(error);
        interviewContent.innerHTML = `<p class="empty-section">Não foi possível carregar as informações da entrevista.</p>`;
        reanalysisSection.hidden = true;
    }
}

export function openAnalyzeManagementModal(applicationForm) {
    formIdLabel.textContent = applicationForm.id;
    renderBeneficiaryInfo(beneficiaryInfoGrid, applicationForm);
    resetApprovalSection();

    // limpa as seções enquanto o histórico ainda não chegou, evitando mostrar dados da ficha anterior
    reanalysisSection.hidden = true;
    reanalysisContent.innerHTML = ``;
    interviewContent.innerHTML = `<p class="empty-section">Carregando informações da entrevista...</p>`;
    loadFormDetails(applicationForm.id);

    // preenche os campos ocultos que vão junto no envio pro backend
    applicationFormIdInput.value = applicationForm.id;
    managerIdInput.value = "";
    getLoggedUser().then(user => {
        managerIdInput.value = user?.id ?? "";
    });

    overlay.hidden = false;
}

function submitForm() {
    const submitButton = getFormSubmitButton(managementApprovalForm);
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

        setSubmitLoading(submitButton, true);
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
