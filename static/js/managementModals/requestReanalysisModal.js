import { fetchWithAuth, getLoggedUser } from "../utils/apiHelper.js";
import { populateRejectedManagementFormsTable } from "../rejected_management_forms.js";

const overlay = document.getElementById("requestReanalysisModalOverlay");
const formIdLabel = document.getElementById("requestReanalysisModalFormId");
const beneficiaryNameLabel = document.getElementById("requestReanalysisBeneficiaryName");
const requestReanalysisForm = document.getElementById("requestReanalysisForm");
const closeButton = document.getElementById("requestReanalysisModalClose");
const cancelButton = document.getElementById("requestReanalysisModalCancel");
const submitButton = document.getElementById("requestReanalysisModalSubmit");
const requesterIdInput = document.getElementById("reanalysis_requester_id");

// guarda a ficha que está sendo reanalisada, já que o id vai na URL do endpoint
let currentApplicationFormId = null;

function closeModal() {
    overlay.hidden = true;
    currentApplicationFormId = null;
}

export function openRequestReanalysisModal(applicationForm) {
    currentApplicationFormId = applicationForm.id;

    formIdLabel.textContent = applicationForm.id;
    beneficiaryNameLabel.textContent = applicationForm.beneficiary_name;

    // limpa a observação e o arquivo selecionado para não vazar dados de outra ficha
    requestReanalysisForm.reset();

    requesterIdInput.value = "";
    getLoggedUser().then(user => {
        requesterIdInput.value = user?.id ?? "";
    });

    overlay.hidden = false;
}

function submitForm() {
    requestReanalysisForm.addEventListener("submit", async (e) => {
        e.preventDefault();

        if (!currentApplicationFormId) return;

        // o FormData vai cru mesmo: como carrega arquivo, o próprio browser precisa montar o
        // Content-Type com o boundary do multipart. Definir o header na mão quebraria o upload.
        const formData = new FormData(requestReanalysisForm);

        const observation = formData.get("reanalysis_observation");
        if (typeof observation === "string") {
            formData.set("reanalysis_observation", observation.trim());
        }

        // evita envio duplicado enquanto o upload do laudo está em andamento
        submitButton.disabled = true;

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
            notyf.success("Reanálise solicitada com sucesso");
            await populateRejectedManagementFormsTable();
        } catch (error) {
            notyf.error(error.message || "Houve um erro ao solicitar a reanálise");
        } finally {
            submitButton.disabled = false;
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
