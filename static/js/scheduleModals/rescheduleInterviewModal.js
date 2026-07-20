const overlay = document.getElementById("rescheduleInterviewModalOverlay");
const interviewIdLabel = document.getElementById("rescheduleModalInterviewId");
const beneficiaryNameLabel = document.getElementById("rescheduleModalBeneficiaryName");
const closeButton = document.getElementById("rescheduleModalClose");
const cancelButton = document.getElementById("rescheduleModalCancel");

function closeModal() {
    overlay.hidden = true;
}

export function openRescheduleInterviewModal(applicationForm) {
    interviewIdLabel.textContent = applicationForm.id;
    beneficiaryNameLabel.textContent = applicationForm.beneficiary_name;

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
