import { renderBeneficiaryInfo } from "../approveModals/beneficiaryInfoView.js";
import { fetchWithAuth, getLoggedUser } from "../utils/apiHelper.js"
import { formatDateTimeToBR } from "../utils/dateUtils.js";
import { populateManagementApproveTable } from "../management_approval.js";

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

    const previousHtml = previousObservation
        ? `
            <div class="info-item info-item--full">
                <span class="info-label">Observação da reprovação anterior</span>
                <span class="info-value info-value--pre">${escapeHtml(previousObservation)}</span>
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

    reanalysisContent.innerHTML = `<div class="info-grid">${previousHtml}</div>${blocks}`;
    reanalysisSection.hidden = false;
}

// busca o histórico completo da ficha para descobrir se ela já passou por uma reanálise
async function loadReanalysisSection(applicationFormId) {
    try {
        const response = await fetchWithAuth(`/entrevista-adesao/application-forms/${applicationFormId}/details`);

        if (!response.ok) throw new Error("Erro ao carregar o histórico da ficha");

        renderReanalysisSection(await response.json());
    } catch (error) {
        // a análise não pode ser bloqueada por causa do histórico, então só esconde a seção
        console.log(error);
        reanalysisSection.hidden = true;
    }
}

export function openAnalyzeManagementModal(applicationForm) {
    formIdLabel.textContent = applicationForm.id;
    renderBeneficiaryInfo(beneficiaryInfoGrid, applicationForm);
    resetApprovalSection();

    // esconde a seção enquanto o histórico ainda não chegou, evitando mostrar dados da ficha anterior
    reanalysisSection.hidden = true;
    reanalysisContent.innerHTML = ``;
    loadReanalysisSection(applicationForm.id);

    // preenche os campos ocultos que vão junto no envio pro backend
    applicationFormIdInput.value = applicationForm.id;
    managerIdInput.value = "";
    getLoggedUser().then(user => {
        managerIdInput.value = user?.id ?? "";
    });

    overlay.hidden = false;
}

function submitForm() {
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
        data.management_approved = data.management_approved === "true";
        data.management_reviewed_at = new Date().toISOString();

        // COLOCAR VALIDAÇÕES DE REQUIRED FIELDS NO FUTURO

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
        }
    });
}

closeButton.addEventListener("click", closeModal);
cancelButton.addEventListener("click", closeModal);
overlay.addEventListener("click", (event) => {
    if (event.target === overlay) closeModal();
});
document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !overlay.hidden) closeModal();
});

document.addEventListener("DOMContentLoaded", () => {
    submitForm();
})
