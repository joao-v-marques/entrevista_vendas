import { fetchWithAuth } from "../utils/apiHelper.js";
import { populateRejectedFormsTable } from "../rejected_forms.js";
import { setSubmitLoading } from "../utils/submitLoading.js";
import { bindOverlayDismiss } from "../utils/modalOverlay.js";

const overlay = document.getElementById("closeNegotiationModalOverlay");
const formIdLabel = document.getElementById("closeNegotiationModalFormId");
const beneficiaryNameLabel = document.getElementById("closeNegotiationBeneficiaryName");
const closeButton = document.getElementById("closeNegotiationModalClose");
const cancelButton = document.getElementById("closeNegotiationModalCancel");
const confirmButton = document.getElementById("closeNegotiationModalConfirm");

// guarda a ficha que está sendo encerrada, já que o id vai na URL do endpoint
let currentApplicationFormId = null;

function closeModal() {
    overlay.hidden = true;
    currentApplicationFormId = null;
}

export function openCloseNegotiationModal(applicationForm) {
    currentApplicationFormId = applicationForm.id;

    formIdLabel.textContent = applicationForm.id;
    beneficiaryNameLabel.textContent = applicationForm.beneficiary_name;

    overlay.hidden = false;
}

confirmButton.addEventListener("click", async () => {
    if (!currentApplicationFormId) return;

    setSubmitLoading(confirmButton, true, "Encerrando...");

    try {
        const response = await fetchWithAuth(`/entrevista-adesao/application-forms/${currentApplicationFormId}/close-negotiation`, {
            method: "POST",
        });

        if (!response.ok) {
            const errorJSON = await response.json().catch(() => null);
            throw new Error(errorJSON?.message || `Erro ${response.status} ao encerrar a negociação`);
        }

        closeModal();
        notyf.success("Negociação encerrada com sucesso");
        await populateRejectedFormsTable();
    } catch (error) {
        notyf.error(error.message || "Houve um erro ao encerrar a negociação");
    } finally {
        setSubmitLoading(confirmButton, false);
    }
});

closeButton.addEventListener("click", closeModal);
cancelButton.addEventListener("click", closeModal);
bindOverlayDismiss(overlay, closeModal);
document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !overlay.hidden) closeModal();
});
