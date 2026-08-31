import { renderBeneficiaryInfo } from "./beneficiaryInfoView.js";
import { fetchWithAuth, getLoggedUser } from "../utils/apiHelper.js"
import { populateFormsApproveTable } from "../approve_form.js";
import { getFormSubmitButton, setSubmitLoading } from "../utils/submitLoading.js";
import { bindOverlayDismiss } from "../utils/modalOverlay.js";

const overlay = document.getElementById("analyzeModalOverlay");
const formIdLabel = document.getElementById("analyzeModalFormId");
const beneficiaryInfoGrid = document.getElementById("beneficiaryInfoGrid");
const approvalStatusBanner = document.getElementById("approvalStatusBanner");
const financialApprovalForm = document.getElementById("financialApprovalForm");
const closeButton = document.getElementById("analyzeModalClose");
const cancelButton = document.getElementById("analyzeModalCancel");
const applicationFormIdInput = document.getElementById("application_form_id");
const reviewerIdInput = document.getElementById("reviewer_id");

function closeModal() {
    overlay.hidden = true;
}

// hoje não existe análise anterior para carregar (endpoint ainda não existe),
// então o formulário sempre abre limpo, pronto pra ser preenchido
function resetApprovalSection() {
    approvalStatusBanner.innerHTML = `<span class="pill pill--gray">Ainda não analisado</span>`;
    financialApprovalForm.reset();
}

export function openAnalyzeFormModal(applicationForm) {
    formIdLabel.textContent = applicationForm.id;
    renderBeneficiaryInfo(beneficiaryInfoGrid, applicationForm);
    resetApprovalSection();

    // preenche os campos ocultos que vão junto no envio pro backend
    applicationFormIdInput.value = applicationForm.id;
    reviewerIdInput.value = "";
    getLoggedUser().then(user => {
        reviewerIdInput.value = user?.id ?? "";
    });

    overlay.hidden = false;
}

function submitForm() {
    const formApprove = document.getElementById("financialApprovalForm");
    const submitButton = getFormSubmitButton(formApprove);

    formApprove.addEventListener("submit", async (e) => {
        e.preventDefault();

        // pega os dados do formulário
        const formData = new FormData(formApprove);

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
        data.financial_approved = data.financial_approved === "true";
        data.financial_reviewed_at = new Date().toISOString();

        // COLOCAR VALIDAÇÕES DE REQUIRED FIELDS NO FUTURO

        setSubmitLoading(submitButton, true);
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
