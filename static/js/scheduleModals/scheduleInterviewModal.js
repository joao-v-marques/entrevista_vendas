import { renderBeneficiaryInfo } from "../approveModals/beneficiaryInfoView.js";

const overlay = document.getElementById("scheduleInterviewModalOverlay");
const formIdLabel = document.getElementById("scheduleModalFormId");
const beneficiaryInfoGrid = document.getElementById("scheduleBeneficiaryInfoGrid");
const scheduleInterviewForm = document.getElementById("scheduleInterviewForm");
const closeButton = document.getElementById("scheduleModalClose");
const cancelButton = document.getElementById("scheduleModalCancel");
const applicationFormIdInput = document.getElementById("schedule_application_form_id");

function closeModal() {
    overlay.hidden = true;
}

export function openScheduleInterviewModal(applicationForm) {
    formIdLabel.textContent = applicationForm.id;
    renderBeneficiaryInfo(beneficiaryInfoGrid, applicationForm);
    scheduleInterviewForm.reset();

    // preenche o campo oculto que vai junto no envio pro backend
    applicationFormIdInput.value = applicationForm.id;

    overlay.hidden = false;
}

function submitForm() {
    scheduleInterviewForm.addEventListener("submit", (e) => {
        e.preventDefault();

        // TODO: enviar o agendamento pro backend (POST ainda não implementado)
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
