import { fetchWithAuth } from "./utils/apiHelper.js";
import { formatDateToBR } from "./utils/dateUtils.js";
import { escapeHtml, formatCPF } from "./utils/detailsView.js";
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

// guarda a lista completa carregada do backend; os filtros atuam sobre ela sem novo request
let allForms = [];

// ordenação atual da tabela: a mais recente primeiro, que é o que se espera de uma
// listagem de fichas. O desempate cai no id, que segue a ordem de inclusão.
let currentSort = { key: "date", dir: "desc" };

// colunas cujo primeiro clique já faz mais sentido em ordem decrescente
const DESC_FIRST_SORT_KEYS = new Set(["date"]);

// normaliza a data de inclusão (que vem como "Mon, 01 Jan 2001 00:00:00 GMT")
// para "YYYY-MM-DD" em UTC, mesmo formato do <input type="date">
function getFormDateISO(form) {
    if (!form.inclusion_date) return "";

    const date = new Date(form.inclusion_date);
    if (isNaN(date)) return "";

    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, "0");
    const day = String(date.getUTCDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
}

// preenche os selects de status e consultor com os valores presentes nos dados carregados
function populateFilterOptions(forms) {
    const statusSelect = document.getElementById("filterStatus");
    const consultantSelect = document.getElementById("filterConsultant");

    const statuses = [...new Set(forms.map(form => form.form_status_name).filter(Boolean))].sort((a, b) => a.localeCompare(b, "pt-BR"));
    const consultants = [...new Set(forms.map(form => form.consultant_name).filter(Boolean))].sort((a, b) => a.localeCompare(b, "pt-BR"));

    // mantém o valor selecionado ao recarregar a lista
    const previousStatus = statusSelect.value;
    const previousConsultant = consultantSelect.value;

    statusSelect.innerHTML = `<option value="">Todos</option>` +
        statuses.map(status => `<option value="${escapeHtml(status)}">${escapeHtml(status)}</option>`).join("");
    consultantSelect.innerHTML = `<option value="">Todos</option>` +
        consultants.map(consultant => `<option value="${escapeHtml(consultant)}">${escapeHtml(consultant)}</option>`).join("");

    if (statuses.includes(previousStatus)) statusSelect.value = previousStatus;
    if (consultants.includes(previousConsultant)) consultantSelect.value = previousConsultant;
}

// lê de uma vez os valores dos filtros, já normalizados para a comparação
function getActiveFilters() {
    return {
        search: document.getElementById("filterBeneficiary").value.trim().toLowerCase(),
        status: document.getElementById("filterStatus").value,
        consultant: document.getElementById("filterConsultant").value,
        dateFrom: document.getElementById("filterDateFrom").value, // "YYYY-MM-DD" ou ""
        dateTo: document.getElementById("filterDateTo").value,
    };
}

function hasActiveFilters(filters) {
    return Boolean(filters.search || filters.status || filters.consultant || filters.dateFrom || filters.dateTo);
}

// aplica os filtros sobre allForms. `ignoreStatus` é usado para contar os chips:
// cada chip mostra quantas fichas daquele status sobram com os *demais* filtros.
function getFilteredForms(filters, { ignoreStatus = false } = {}) {
    return allForms.filter(form => {
        // a busca cobre nome e CPF, cru e mascarado, para achar "12345678900" e "123.456.789-00"
        const cpf = form.beneficiary_cpf || "";
        const haystack = `${form.beneficiary_name || ""} ${cpf} ${formatCPF(cpf)}`.toLowerCase();
        const matchesSearch = !filters.search || haystack.includes(filters.search);
        const matchesStatus = ignoreStatus || !filters.status || form.form_status_name === filters.status;
        const matchesConsultant = !filters.consultant || form.consultant_name === filters.consultant;

        // período de inclusão: comparação lexicográfica funciona no formato "YYYY-MM-DD",
        // e os dois extremos entram no resultado
        const formDate = getFormDateISO(form);
        const matchesDateFrom = !filters.dateFrom || (formDate && formDate >= filters.dateFrom);
        const matchesDateTo = !filters.dateTo || (formDate && formDate <= filters.dateTo);

        return matchesSearch && matchesStatus && matchesConsultant && matchesDateFrom && matchesDateTo;
    });
}

// valor usado na comparação de cada coluna ordenável
function getSortValue(form, key) {
    if (key === "date") {
        const time = new Date(form.inclusion_date).getTime();
        return isNaN(time) ? 0 : time;
    }
    if (key === "type") return form.inclusion_type || "";
    if (key === "consultant") return form.consultant_name || "";
    if (key === "status") return form.form_status_name || "";
    if (key === "id") return Number(form.id) || 0;
    return form.beneficiary_name || "";
}

// ordena uma cópia da lista para não mexer na ordem original de allForms
function sortForms(forms) {
    const { key, dir } = currentSort;
    const factor = dir === "desc" ? -1 : 1;

    return [...forms].sort((a, b) => {
        const valueA = getSortValue(a, key);
        const valueB = getSortValue(b, key);

        const comparison = typeof valueA === "number"
            ? valueA - valueB
            : String(valueA).localeCompare(String(valueB), "pt-BR", { sensitivity: "base" });

        // empate cai para o id mais recente, para a ordem não ficar instável entre renders
        if (comparison === 0) return Number(b.id) - Number(a.id);

        return comparison * factor;
    });
}

// reflete a ordenação atual nos cabeçalhos (seta + aria-sort para leitores de tela)
function updateSortIndicators() {
    document.querySelectorAll(".forms-table th.is-sortable").forEach(th => {
        const isActive = th.dataset.sort === currentSort.key;

        th.classList.toggle("is-sorted-asc", isActive && currentSort.dir === "asc");
        th.classList.toggle("is-sorted-desc", isActive && currentSort.dir === "desc");
        th.setAttribute("aria-sort", isActive ? (currentSort.dir === "asc" ? "ascending" : "descending") : "none");
    });
}

// "12 formulários" quando não há filtro; "5 de 12 formulários" quando há
function updateFormsCount(shown, total) {
    const counter = document.getElementById("formsCount");
    const label = total === 1 ? "formulário" : "formulários";

    counter.textContent = shown === total ? `${total} ${label}` : `${shown} de ${total} ${label}`;
}

// desenha os atalhos de status: "Todos" + um chip por status presente nos dados
function renderStatusChips(filters) {
    const container = document.getElementById("statusChips");

    // as contagens ignoram o status selecionado, senão todos os outros chips zerariam
    const scoped = getFilteredForms(filters, { ignoreStatus: true });

    const counts = new Map();
    scoped.forEach(form => {
        const status = form.form_status_name;
        if (status) counts.set(status, (counts.get(status) || 0) + 1);
    });

    const statuses = [...new Set(allForms.map(form => form.form_status_name).filter(Boolean))]
        .sort((a, b) => a.localeCompare(b, "pt-BR"));

    const allChip = `
        <button type="button" class="pill forms-status-chip forms-status-chip--all${filters.status ? "" : " is-active"}"
                data-status="" aria-pressed="${filters.status ? "false" : "true"}">
            Todos<span class="forms-status-chip-count">${scoped.length}</span>
        </button>`;

    const statusChips = statuses.map(status => {
        const isActive = filters.status === status;

        return `
        <button type="button" class="pill ${getStatusPillClass(status)} forms-status-chip${isActive ? " is-active" : ""}"
                data-status="${escapeHtml(status)}" aria-pressed="${isActive}">
            ${escapeHtml(status)}<span class="forms-status-chip-count">${counts.get(status) || 0}</span>
        </button>`;
    }).join("");

    container.innerHTML = allChip + statusChips;
}

// renderiza a tabela a partir de uma lista já filtrada e ordenada
function renderFormsTable(forms, filters) {
    const tbodyForms = document.getElementById("tbodyForms");
    tbodyForms.innerHTML = ``;

    if (forms.length === 0) {
        // sem resultado por causa dos filtros é diferente de não haver ficha nenhuma
        tbodyForms.innerHTML = hasActiveFilters(filters)
            ? `<tr class="forms-empty-row"><td colspan="6">
                   <div class="forms-empty-state">
                       <span>Nenhum formulário encontrado para os filtros selecionados.</span>
                       <button type="button" class="btn btn--outline btn--sm" id="emptyClearFilters">Limpar filtros</button>
                   </div>
               </td></tr>`
            : `<tr class="forms-empty-row"><td colspan="6">Nenhum formulário cadastrado até o momento.</td></tr>`;
        return;
    }

    const formsFragment = document.createDocumentFragment();

    forms.forEach(form => {
        const trForms = document.createElement("tr");

        // a linha inteira abre o modal de visualização (ver delegação no DOMContentLoaded)
        trForms.dataset.id = form.id;
        trForms.tabIndex = 0;

        // botão exibido apenas quando o formulário está aguardando cadastro no Backoffice (status 5)
        const finalizeButton = form.form_status_id === 5 ? `
                    <button class="icon-btn icon-btn--primary btn-finalize" data-id="${form.id}" title="Finalizar Cadastro" aria-label="Finalizar Cadastro">
                        <svg viewBox="0 0 16 16" fill="none"><path d="M3 8.5l3 3 7-7" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
                    </button>` : "";

        const cpf = form.beneficiary_cpf ? formatCPF(form.beneficiary_cpf) : "";

        trForms.innerHTML = `
            <td>
                <div class="beneficiary-cell">
                    <span class="beneficiary-cell-name">${escapeHtml(form.beneficiary_name)}</span>
                    <span class="beneficiary-cell-meta">${cpf ? `${escapeHtml(cpf)} · ` : ""}#${escapeHtml(form.id)}</span>
                </div>
            </td>
            <td class="forms-cell-type">${escapeHtml(form.inclusion_type)}</td>
            <td class="forms-cell-consultant">${escapeHtml(form.consultant_name)}</td>
            <td class="forms-cell-date">${formatDateToBR(form.inclusion_date)}</td>
            <td class="status-column">
                <span class="pill ${getStatusPillClass(form.form_status_name)}">${escapeHtml(form.form_status_name)}</span>
            </td>
            <td class="actions-column">
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
}

// aplica os filtros, reordena e re-renderiza tudo que depende deles
function applyFilters() {
    const filters = getActiveFilters();
    const filtered = getFilteredForms(filters);

    renderStatusChips(filters);
    renderFormsTable(sortForms(filtered), filters);
    updateSortIndicators();
    updateFormsCount(filtered.length, allForms.length);

    document.getElementById("filterClear").classList.toggle("is-hidden", !hasActiveFilters(filters));
}

// zera todos os filtros e volta ao estado padrão da listagem
function clearFilters() {
    document.getElementById("filterBeneficiary").value = "";
    document.getElementById("filterStatus").value = "";
    document.getElementById("filterConsultant").value = "";
    document.getElementById("filterDateFrom").value = "";
    document.getElementById("filterDateTo").value = "";
    applyFilters();
}

async function populateFormsTable() {
    const tbodyForms = document.getElementById("tbodyForms");

    try {
        const response = await fetchWithAuth("/entrevista-adesao/application-forms")

        if (!response.ok) {
            const errorJSON = await response.json().catch(() => null);
            throw new Error(errorJSON?.message || "Erro ao carregar os formulários");
        }

        allForms = await response.json();

        populateFilterOptions(allForms);
        applyFilters();

    } catch (error) {
        // sem isso a tabela ficava presa em "Carregando..." e o erro só aparecia no console
        tbodyForms.innerHTML = `<tr class="forms-empty-row"><td colspan="6">Não foi possível carregar os formulários.</td></tr>`;
        notyf.error(error.message || "Houve um erro ao carregar os formulários");
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

    // ---------- Filtros ----------
    const filterBeneficiary = document.getElementById("filterBeneficiary");
    const filterStatus = document.getElementById("filterStatus");
    const filterConsultant = document.getElementById("filterConsultant");
    const filterDateFrom = document.getElementById("filterDateFrom");
    const filterDateTo = document.getElementById("filterDateTo");
    const filterClear = document.getElementById("filterClear");

    // "input" no campo de texto reage a cada tecla; "change" nos selects/datas
    filterBeneficiary.addEventListener("input", applyFilters);
    filterStatus.addEventListener("change", applyFilters);
    filterConsultant.addEventListener("change", applyFilters);
    filterDateFrom.addEventListener("change", applyFilters);
    filterDateTo.addEventListener("change", applyFilters);

    filterClear.addEventListener("click", clearFilters);

    // ---------- Atalhos de status ----------
    // os chips são só um atalho: quem guarda o status escolhido continua sendo o select
    document.getElementById("statusChips").addEventListener("click", (event) => {
        const chip = event.target.closest(".forms-status-chip");
        if (!chip) return;

        filterStatus.value = chip.dataset.status;
        applyFilters();
    });

    // ---------- Ordenação (delegação no thead) ----------
    const thead = document.querySelector(".forms-table thead");

    function toggleSort(th) {
        const key = th.dataset.sort;

        // clicar de novo na mesma coluna inverte; trocar de coluna recomeça na direção padrão dela
        currentSort = key === currentSort.key
            ? { key, dir: currentSort.dir === "asc" ? "desc" : "asc" }
            : { key, dir: DESC_FIRST_SORT_KEYS.has(key) ? "desc" : "asc" };

        applyFilters();
    }

    thead.addEventListener("click", (event) => {
        const th = event.target.closest("th.is-sortable");
        if (th) toggleSort(th);
    });

    // os cabeçalhos são focáveis (role="button"), então precisam responder ao teclado
    thead.addEventListener("keydown", (event) => {
        if (event.key !== "Enter" && event.key !== " ") return;

        const th = event.target.closest("th.is-sortable");
        if (!th) return;

        event.preventDefault(); // espaço rolaria a página
        toggleSort(th);
    });

    // ---------- Ações da tabela (delegação de evento) ----------
    // o tbody é recriado a cada render, mas o listener no elemento pai permanece
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

        if (event.target.closest("#emptyClearFilters")) {
            clearFilters();
            return;
        }

        // clique em qualquer outro ponto da linha abre a visualização; a área dos
        // botões fica de fora para um clique que erra o alvo não abrir o modal
        if (event.target.closest(".table-actions")) return;

        const row = event.target.closest("tr[data-id]");
        if (row) openViewFormModal(row.dataset.id);
    });

    // as linhas são focáveis, então Enter também abre a visualização
    tbodyForms.addEventListener("keydown", (event) => {
        if (event.key !== "Enter") return;

        const row = event.target.closest("tr[data-id]");
        if (row && event.target === row) openViewFormModal(row.dataset.id);
    });
})
