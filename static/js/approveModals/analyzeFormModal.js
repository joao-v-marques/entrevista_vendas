import { renderBeneficiaryInfo } from "./beneficiaryInfoView.js";

const overlay = document.getElementById("analyzeModalOverlay");
const formIdLabel = document.getElementById("analyzeModalFormId");
const beneficiaryInfoGrid = document.getElementById("beneficiaryInfoGrid");
const approvalStatusBanner = document.getElementById("approvalStatusBanner");
const financialApprovalForm = document.getElementById("financialApprovalForm");
const closeButton = document.getElementById("analyzeModalClose");
const cancelButton = document.getElementById("analyzeModalCancel");

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
