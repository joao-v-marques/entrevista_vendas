import { fetchWithAuth } from "../utils/apiHelper.js";
import { populateRejectedFormsTable } from "../rejected_forms.js";
import { setSubmitLoading } from "../utils/submitLoading.js";
import { bindOverlayDismiss } from "../utils/modalOverlay.js";
import { renderSection, renderInfoGrid } from "../utils/detailsView.js";
import { FORM_FIELDS, DISCOUNT_FIELDS, BENEFICIARY_FIELDS, PORTABILITY_FIELDS, OTHER_FIELDS } from "../utils/applicationFormFields.js";

const overlay = document.getElementById("requestReanalysisModalOverlay");
const formIdLabel = document.getElementById("requestReanalysisModalFormId");
const body = document.getElementById("requestReanalysisModalBody");
const closeButton = document.getElementById("requestReanalysisModalClose");
const cancelButton = document.getElementById("requestReanalysisModalCancel");
const confirmButton = document.getElementById("requestReanalysisModalConfirm");

// guarda a ficha que está sendo reanalisada, já que o id vai na URL do endpoint
let currentApplicationFormId = null;

function buildBody(form) {
    return [
        renderSection("Dados do Formulário", renderInfoGrid(form, FORM_FIELDS)),
        renderSection("Desconto", renderInfoGrid(form, DISCOUNT_FIELDS)),
        renderSection("Dados do Beneficiário", renderInfoGrid(form, BENEFICIARY_FIELDS)),
        renderSection("Portabilidade", renderInfoGrid(form, PORTABILITY_FIELDS)),
        renderSection("Outras Informações", renderInfoGrid(form, OTHER_FIELDS)),
    ].join("");
}

function closeModal() {
    overlay.hidden = true;
    body.innerHTML = "";
    currentApplicationFormId = null;
}

// applicationForm já vem do cache local (allRejectedForms), sem requisição nova
export function openRequestReanalysisModal(applicationForm) {
    currentApplicationFormId = applicationForm.id;

    formIdLabel.textContent = applicationForm.id;
    body.innerHTML = buildBody(applicationForm);

    overlay.hidden = false;
}

confirmButton.addEventListener("click", async () => {
    if (!currentApplicationFormId) return;

    setSubmitLoading(confirmButton, true, "Solicitando...");

    try {
        const response = await fetchWithAuth(`/entrevista-adesao/application-forms/${currentApplicationFormId}/request-reanalysis`, {
            method: "POST",
        });

        if (!response.ok) {
            const errorJSON = await response.json().catch(() => null);
            throw new Error(errorJSON?.message || `Erro ${response.status} ao solicitar reanálise`);
        }

        closeModal();
        notyf.success("Reanálise solicitada com sucesso");
        await populateRejectedFormsTable();
    } catch (error) {
        notyf.error(error.message || "Houve um erro ao solicitar a reanálise");
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
