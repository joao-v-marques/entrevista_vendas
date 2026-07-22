import { fetchWithAuth } from "./utils/apiHelper.js";
import { formatDateToBR } from "./utils/dateUtils.js";
import { openViewFormModal } from "./formsModals/viewFormModal.js";

// mapeia cada form_status.name pra um variant de .pill (ver static/css/global.css)
const STATUS_PILL_CLASSES = {
    "Aguardando aprovação financeira": "pill--gray",
    "Aguardando Agendamento de Entrevista": "pill--blue",
    "Aguardando Aprovação da Entrevista": "pill--purple",
    "Aguardando Aprovação da Gerência": "pill--amber",
    "Aguardando Cadastro no Backoffice": "pill--teal",
    "Finalizado": "pill--green",
    "Reprovado Pelo Financeiro": "pill--red",
    "Negociação Encerrada Financeiro": "pill--gray",
};

function getStatusPillClass(statusName) {
    return STATUS_PILL_CLASSES[statusName] || "pill--gray";
}

async function populateFormsTable() {
    try {
        const response = await fetchWithAuth("/entrevista-adesao/application-forms")

        if (!response.ok) {
            const errorJSON = await response.json().catch(() => null);
            throw new Error(errorJSON?.message || "Erro ao carregar os formulários"); 
        }

        const forms = await response.json();

        const tbodyForms = document.getElementById("tbodyForms");
        tbodyForms.innerHTML = ``;
        
        const formsFragment = document.createDocumentFragment();

        forms.forEach(form => {
            const trForms = document.createElement("tr");

            // botão exibido apenas quando o formulário está aguardando cadastro no Backoffice (status 5)
            const finalizeButton = form.form_status_id === 5 ? `
                        <button class="icon-btn icon-btn--primary btn-finalize" data-id="${form.id}" title="Finalizar Cadastro" aria-label="Finalizar Cadastro">
                            <svg viewBox="0 0 16 16" fill="none"><path d="M3 8.5l3 3 7-7" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
                        </button>` : "";

            trForms.innerHTML = `
                <td>${form.id}</td>
                <td>${form.beneficiary_name}</td>
                <td>${form.inclusion_type}</td>
                <td>${form.consultant_name}</td>
                <td>${formatDateToBR(form.inclusion_date)}</td>
                <td class="status-column">
                    <span class="pill ${getStatusPillClass(form.form_status_name)}">${form.form_status_name}</span>
                </td>
                <td>
                    <div class="table-actions">
                        <button class="icon-btn btn-view-form" data-id="${form.id}" title="Visualizar" aria-label="Visualizar">
                            <svg viewBox="0 0 16 16" fill="none"><path d="M1 8s2.7-5 7-5 7 5 7 5-2.7 5-7 5-7-5-7-5z" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/><circle cx="8" cy="8" r="2.2" stroke="currentColor" stroke-width="1.4"/></svg>
                        </button>
                        <button class="icon-btn btn-download-docs" data-id="${form.id}" title="Baixar documentos" aria-label="Baixar documentos">
                            <svg viewBox="0 0 16 16" fill="none"><path d="M8 1.5v8.5M8 10l-2.8-2.8M8 10l2.8-2.8" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/><path d="M2.5 12v1.3a1 1 0 001 1h9a1 1 0 001-1V12" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>
                        </button>${finalizeButton}
                    </div>
                </td>
            `;

            formsFragment.appendChild(trForms);
        });

        tbodyForms.appendChild(formsFragment);

    } catch (error) {
        console.log(error)
    }
}

// baixa, em um único .zip, todos os documentos anexados ao formulário
async function downloadFormDocuments(applicationFormId, button) {
    // evita múltiplos cliques enquanto o download é preparado
    if (button.dataset.loading === "true") return;
    button.dataset.loading = "true";
    button.disabled = true;

    try {
        const response = await fetchWithAuth(`/entrevista-adesao/application-form-documents/${applicationFormId}/download`);

        if (!response.ok) {
            const errorJSON = await response.json().catch(() => null);
            throw new Error(errorJSON?.message || "Erro ao baixar os documentos");
        }

        const blob = await response.blob();

        // tenta reaproveitar o nome de arquivo enviado pelo backend (Content-Disposition)
        const disposition = response.headers.get("Content-Disposition") || "";
        const match = disposition.match(/filename="?([^"]+)"?/);
        const filename = match ? match[1] : `documentos_${applicationFormId}.zip`;

        const url = window.URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(url);
    } catch (error) {
        notyf.error(error.message || "Houve um erro ao baixar os documentos");
    } finally {
        button.dataset.loading = "false";
        button.disabled = false;
    }
}

// finaliza o cadastro do formulário (muda o status de 5. Aguardando Cadastro no Backoffice para 6. Finalizado)
async function finalizeRegistration(applicationFormId, button) {
    // evita múltiplos cliques enquanto a requisição é processada
    if (button.dataset.loading === "true") return;
    button.dataset.loading = "true";
    button.disabled = true;

    try {
        const response = await fetchWithAuth(`/entrevista-adesao/application-forms/${applicationFormId}/finalize`, {
            method: "POST",
        });

        if (!response.ok) {
            const errorJSON = await response.json().catch(() => null);
            throw new Error(errorJSON?.message || "Erro ao finalizar o cadastro");
        }

        notyf.success("Cadastro finalizado com sucesso");
        // recarrega a tabela: o formulário continua na lista, agora como Finalizado
        await populateFormsTable();
    } catch (error) {
        notyf.error(error.message || "Houve um erro ao finalizar o cadastro");
        // só reabilita em caso de erro; no sucesso a linha é recriada pelo populateFormsTable
        button.dataset.loading = "false";
        button.disabled = false;
    }
}

document.addEventListener("DOMContentLoaded", () => {
    populateFormsTable();

    // delegação de evento: o tbody é recriado, mas o listener no elemento pai permanece
    const tbodyForms = document.getElementById("tbodyForms");
    tbodyForms.addEventListener("click", (event) => {
        const viewButton = event.target.closest(".btn-view-form");
        if (viewButton) {
            openViewFormModal(viewButton.dataset.id);
            return;
        }

        const downloadButton = event.target.closest(".btn-download-docs");
        if (downloadButton) {
            downloadFormDocuments(downloadButton.dataset.id, downloadButton);
            return;
        }

        const finalizeButton = event.target.closest(".btn-finalize");
        if (finalizeButton) {
            finalizeRegistration(finalizeButton.dataset.id, finalizeButton);
            return;
        }
    });
})