import { fetchWithAuth } from "../utils/apiHelper.js";
import { populateAnalyzeInterviewTable } from "../analyze_interview.js";

const overlay = document.getElementById("rescheduleInterviewModalOverlay");
const interviewIdLabel = document.getElementById("rescheduleModalInterviewId");
const beneficiaryNameLabel = document.getElementById("rescheduleModalBeneficiaryName");
const closeButton = document.getElementById("rescheduleModalClose");
const cancelButton = document.getElementById("rescheduleModalCancel");
const applicationFormIdInput = document.getElementById("reschedule_application_form_id");

function closeModal() {
    overlay.hidden = true;
}

export function openRescheduleInterviewModal(applicationForm) {
    interviewIdLabel.textContent = applicationForm.id;
    beneficiaryNameLabel.textContent = applicationForm.beneficiary_name;

    // preenche o campo oculto que carrega o id da ficha pro envio ao backend
    applicationFormIdInput.value = applicationForm.id;

    overlay.hidden = false;
}

closeButton.addEventListener("click", closeModal);
cancelButton.addEventListener("click", closeModal);
overlay.addEventListener("click", (event) => {
    if (event.target === overlay) closeModal();
});
document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !overlay.hidden) closeModal();
});

// TODO: lógica de confirmar o reagendamento pro backend (ainda não implementado)
function submitRescheduleForm() {
    const rescheduleInterviewForm = document.getElementById("rescheduleInterviewForm");

    rescheduleInterviewForm.addEventListener("submit", async (e) => {
        e.preventDefault();

        const applicationFormId = applicationFormIdInput.value;

        try {
            const response = await fetchWithAuth(
                `/entrevista-adesao/application-form-interviews?application-form-id=${applicationFormId}`,
                { method: "DELETE" }
            );

            if (!response.ok) {
                const errorJSON = await response.json().catch(() => null);
                throw new Error(errorJSON?.message || "Erro ao solicitar reagendamento");
            }

            closeModal();
            notyf.success("Reagendamento solicitado com sucesso!");
            await populateAnalyzeInterviewTable();
        } catch (error) {
            notyf.error(error.message);
        }
    })
}

document.addEventListener("DOMContentLoaded", () => {
    submitRescheduleForm();
})