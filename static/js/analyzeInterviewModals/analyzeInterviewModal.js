import { renderBeneficiaryInfo } from "../approveModals/beneficiaryInfoView.js";
import { fetchWithAuth, getLoggedUser } from "../utils/apiHelper.js";

const overlay = document.getElementById("analyzeInterviewModalOverlay");
const formIdLabel = document.getElementById("analyzeInterviewModalFormId");
const beneficiaryInfoGrid = document.getElementById("analyzeInterviewBeneficiaryInfoGrid");
const interviewAnalysisForm = document.getElementById("interviewAnalysisForm");
const closeButton = document.getElementById("analyzeInterviewModalClose");
const cancelButton = document.getElementById("analyzeInterviewModalCancel");
const applicationFormIdInput = document.getElementById("analyze_interview_application_form_id");
const interviewerIdInput = document.getElementById("analyze_interview_interviewer_id");

function closeModal() {
    overlay.hidden = true;
}

export function openAnalyzeInterviewModal(applicationForm) {
    formIdLabel.textContent = applicationForm.id;
    renderBeneficiaryInfo(beneficiaryInfoGrid, applicationForm);
    interviewAnalysisForm.reset();

    // preenche os campos ocultos que vão junto no envio pro backend
    applicationFormIdInput.value = applicationForm.id;
    interviewerIdInput.value = "";
    getLoggedUser().then(user => {
        interviewerIdInput.value = user?.id ?? "";
    });

    overlay.hidden = false;
}

function submitForm() {
    interviewAnalysisForm.addEventListener("submit", async (e) => {
        e.preventDefault();

        // pega os dados do formulário
        const formData = new FormData(interviewAnalysisForm);

        // validação para remover espaços no inicio e final da string
        for (let [key, value] of formData.entries()) {
            if (typeof value === "string") {
                formData.set(key, value.trim());
            }
        }

        // monta o payload
        const data = Object.fromEntries(formData.entries());
        data.application_form_id = Number(data.application_form_id);
        data.interviewer_id = Number(data.interviewer_id);
        data.interview_approved = data.interview_approved === "true";
        data.interview_reviewed_at = new Date().toISOString();

        // TODO: enviar `data` para o backend (lógica de update da análise ainda não implementada)
        console.log("Payload da análise da entrevista:", data);
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
