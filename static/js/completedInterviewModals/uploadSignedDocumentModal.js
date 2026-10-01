import { fetchWithAuth } from "../utils/apiHelper.js";
import { populateCompletedInterviewsTable, downloadInterviewDocument } from "../completed_interviews.js";
import { setSubmitLoading } from "../utils/submitLoading.js";
import { bindOverlayDismiss } from "../utils/modalOverlay.js";
import { syncBodyScrollLock } from "../utils/modalControl.js";
import { formatBytes, formatCPF } from "../utils/detailsView.js";

// mesmo limite do backend (MAX_TOTAL_SIZE_BYTES em application_form_documents_services.py);
// validar aqui só poupa o upload de um arquivo que o servidor recusaria
const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024;

const overlay = document.getElementById("uploadSignedDocumentModalOverlay");
const formIdLabel = document.getElementById("uploadSignedDocumentModalFormId");
const beneficiaryNameLabel = document.getElementById("uploadSignedDocumentBeneficiaryName");
const beneficiaryMetaLabel = document.getElementById("uploadSignedDocumentBeneficiaryMeta");
const statusPill = document.getElementById("uploadSignedDocumentStatusPill");
const replaceNotice = document.getElementById("uploadSignedDocumentReplaceNotice");
const uploadForm = document.getElementById("uploadSignedDocumentForm");
const dropzone = document.getElementById("uploadSignedDocumentDropzone");
const fileInput = document.getElementById("uploadSignedDocumentFile");
const fileCard = document.getElementById("uploadSignedDocumentFileCard");
const fileNameLabel = document.getElementById("uploadSignedDocumentFileName");
const fileSizeLabel = document.getElementById("uploadSignedDocumentFileSize");
const removeButton = document.getElementById("uploadSignedDocumentRemove");
const errorLabel = document.getElementById("uploadSignedDocumentError");
const downloadButton = document.getElementById("uploadSignedDocumentDownload");
const closeButton = document.getElementById("uploadSignedDocumentModalClose");
const cancelButton = document.getElementById("uploadSignedDocumentModalCancel");
const submitButton = document.getElementById("uploadSignedDocumentModalSubmit");

// guarda a ficha que está recebendo o documento, já que o id vai na URL do endpoint
let currentApplicationFormId = null;
// arquivo já validado; o envio só é liberado quando ele existe
let selectedFile = null;

function isPdf(file) {
    return file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
}

function showError(message) {
    errorLabel.textContent = message;
    errorLabel.hidden = false;
    dropzone.classList.add("has-error");
}

function clearError() {
    errorLabel.textContent = "";
    errorLabel.hidden = true;
    dropzone.classList.remove("has-error");
}

function updateSubmitState() {
    submitButton.disabled = !selectedFile;
}

// troca a área de envio pelo cartão do arquivo (ou volta para a área quando não há arquivo)
function renderSelection() {
    const hasFile = Boolean(selectedFile);

    dropzone.hidden = hasFile;
    fileCard.hidden = !hasFile;

    if (hasFile) {
        fileNameLabel.textContent = selectedFile.name;
        fileNameLabel.title = selectedFile.name;
        fileSizeLabel.textContent = formatBytes(selectedFile.size);
    }

    updateSubmitState();
}

function clearSelection() {
    selectedFile = null;
    fileInput.value = "";
    renderSelection();
}

// valida o arquivo escolhido (pelo seletor ou arrastado) antes de aceitá-lo
function setFile(file) {
    clearError();

    if (!file) {
        clearSelection();
        return;
    }

    if (!isPdf(file)) {
        clearSelection();
        showError(`"${file.name}" não é um PDF. Envie apenas o documento assinado em PDF.`);
        return;
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
        clearSelection();
        showError(`O arquivo tem ${formatBytes(file.size)} e excede o limite de 20 MB.`);
        return;
    }

    selectedFile = file;
    renderSelection();
}

function resetState() {
    clearError();
    clearSelection();
    dropzone.classList.remove("is-dragover");
}

function closeModal() {
    overlay.hidden = true;
    syncBodyScrollLock();
    resetState();
    currentApplicationFormId = null;
}

// interview já vem do cache local da listagem (allInterviews), sem requisição nova
export function openUploadSignedDocumentModal(interview) {
    currentApplicationFormId = interview.application_form_id;

    formIdLabel.textContent = interview.application_form_id;
    beneficiaryNameLabel.textContent = interview.beneficiary_name || "—";

    // o número da ficha já está no subtítulo do cabeçalho, então aqui fica só o CPF
    const cpf = interview.beneficiary_cpf ? formatCPF(interview.beneficiary_cpf) : "";
    beneficiaryMetaLabel.textContent = cpf ? `CPF ${cpf}` : "";
    beneficiaryMetaLabel.hidden = !cpf;

    // o envio anterior não é apagado: o novo só passa a ser o atual
    statusPill.className = `pill ${interview.has_signed_document ? "pill--green" : "pill--gray"}`;
    statusPill.textContent = interview.has_signed_document ? "Já possui documento assinado" : "Assinatura pendente";
    replaceNotice.hidden = !interview.has_signed_document;

    // o atalho reaproveita o download da listagem, que lê o id deste data-*
    downloadButton.dataset.pdfFormId = interview.application_form_id;

    resetState();

    overlay.hidden = false;
    syncBodyScrollLock();
    fileInput.focus();
}

fileInput.addEventListener("change", () => setFile(fileInput.files[0]));

// ---------- Arrastar e soltar ----------
["dragenter", "dragover"].forEach(eventName => {
    dropzone.addEventListener(eventName, (event) => {
        event.preventDefault();
        dropzone.classList.add("is-dragover");
    });
});

dropzone.addEventListener("dragleave", (event) => {
    // o dragleave também dispara ao passar por cima dos filhos; só sai de fato quando deixa a área
    if (dropzone.contains(event.relatedTarget)) return;
    dropzone.classList.remove("is-dragover");
});

dropzone.addEventListener("drop", (event) => {
    event.preventDefault();
    dropzone.classList.remove("is-dragover");

    const files = event.dataTransfer?.files;
    if (!files || files.length === 0) return;

    if (files.length > 1) {
        clearSelection();
        showError("Envie apenas um arquivo: o documento assinado em PDF.");
        return;
    }

    setFile(files[0]);

    // sincroniza o input com o arquivo solto, para o FormData do envio continuar valendo
    if (selectedFile) {
        const transfer = new DataTransfer();
        transfer.items.add(selectedFile);
        fileInput.files = transfer.files;
    }
});

// soltar o arquivo fora da área abriria o PDF no navegador e tiraria o usuário da tela
overlay.addEventListener("dragover", (event) => event.preventDefault());
overlay.addEventListener("drop", (event) => event.preventDefault());

removeButton.addEventListener("click", () => {
    clearError();
    clearSelection();
    fileInput.focus();
});

downloadButton.addEventListener("click", () => downloadInterviewDocument(downloadButton));

// ---------- Envio ----------
uploadForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    if (!currentApplicationFormId || !selectedFile) return;

    // o FormData vai cru mesmo: como carrega arquivo, o próprio browser precisa montar o
    // Content-Type com o boundary do multipart. Definir o header na mão quebraria o upload.
    const formData = new FormData(uploadForm);

    // evita envio duplicado enquanto o upload está em andamento
    setSubmitLoading(submitButton, true, "Enviando...");

    try {
        const response = await fetchWithAuth(`/entrevista-adesao/application-form-interviews/${currentApplicationFormId}/signed-document`, {
            method: "POST",
            body: formData,
        });

        if (!response.ok) {
            const errorJSON = await response.json().catch(() => null);
            throw new Error(errorJSON?.message || `Erro ${response.status} ao enviar o documento assinado`);
        }

        closeModal();
        notyf.success("Documento assinado enviado com sucesso");
        await populateCompletedInterviewsTable();
    } catch (error) {
        const message = error.message || "Houve um erro ao enviar o documento assinado";
        showError(message);
        notyf.error(message);
    } finally {
        setSubmitLoading(submitButton, false);
        // o setSubmitLoading reabilita o botão; aqui ele volta a depender de haver arquivo
        updateSubmitState();
    }
});

closeButton.addEventListener("click", closeModal);
cancelButton.addEventListener("click", closeModal);
bindOverlayDismiss(overlay, closeModal);
document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !overlay.hidden) closeModal();
});
