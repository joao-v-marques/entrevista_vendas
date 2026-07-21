import { renderBeneficiaryInfo } from "../approveModals/beneficiaryInfoView.js";
import { fetchWithAuth, getLoggedUser } from "../utils/apiHelper.js"
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

function closeModal() {
    overlay.hidden = true;
}

// hoje não existe análise anterior para carregar (endpoint ainda não existe),
// então o formulário sempre abre limpo, pronto pra ser preenchido
function resetApprovalSection() {
    approvalStatusBanner.innerHTML = `<span class="pill pill--gray">Ainda não analisado</span>`;
    managementApprovalForm.reset();
}

export function openAnalyzeManagementModal(applicationForm) {
    formIdLabel.textContent = applicationForm.id;
    renderBeneficiaryInfo(beneficiaryInfoGrid, applicationForm);
    resetApprovalSection();

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
