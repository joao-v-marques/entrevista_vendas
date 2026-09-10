import { fetchWithAuth, getErrorMessage } from "../utils/apiHelper.js";
import { escapeHtml } from "../utils/htmlEscape.js";
import { setModalVisible, registerModalDismiss } from "../utils/modalControl.js";
import { getFormSubmitButton, setSubmitLoading } from "../utils/submitLoading.js";
import { loadSectors } from "./usersSection.js";

// espelha SECTOR_NAME_MAX_LENGTH em services/sectors_services.py — o backend recusa
// nomes maiores, então validar aqui evita um round-trip só para tomar 400
const SECTOR_NAME_MAX_LENGTH = 155;

// Setores não têm exclusão: o backend só expõe deactivate/reactivate, e a FK
// users.sector_id é ON DELETE RESTRICT. As duas ações compartilham o mesmo modal
// de confirmação, e este mapa é o que muda entre elas.
const TOGGLE_ACTIONS = {
    deactivate: {
        title: "Desativar setor",
        confirmLabel: "Desativar",
        confirmClass: "btn--danger",
        loadingLabel: "Desativando...",
        method: "DELETE",
        path: sectorId => `/entrevista-adesao/sectors/${sectorId}/deactivate`,
        successMessage: "Setor desativado com sucesso",
        errorMessage: "Houve um erro ao tentar desativar o setor",
        buildText: safeName => `Desativar o setor <strong>${safeName}</strong>? Ele deixa de ficar disponível para vínculo com novos usuários.`,
    },
    reactivate: {
        title: "Reativar setor",
        confirmLabel: "Reativar",
        confirmClass: "btn--primary",
        loadingLabel: "Reativando...",
        method: "PATCH",
        path: sectorId => `/entrevista-adesao/sectors/${sectorId}/reactivate`,
        successMessage: "Setor reativado com sucesso",
        errorMessage: "Houve um erro ao tentar reativar o setor",
        buildText: safeName => `Reativar o setor <strong>${safeName}</strong>? Ele volta a ficar disponível para vínculo com os usuários.`,
    },
};

// guarda a lista completa carregada; os filtros atuam sobre ela sem novo request
let allSectors = [];

// ordenação atual da tabela; o backend já devolve por nome, mas por status ajuda
// a separar de uma vez os setores que saíram de uso
let currentSort = { key: "name", dir: "asc" };

// o que o modal de confirmação está prestes a fazer: { sector, action }
let sectorToToggle = null;

// aplica os filtros ativos sobre allSectors e retorna apenas os correspondentes
function getFilteredSectors() {
    const search = document.getElementById("filterSectorName").value.trim().toLowerCase();
    const status = document.getElementById("filterSectorStatus").value; // "1", "0" ou ""

    return allSectors.filter(sector => {
        // o id entra na busca porque a tabela mostra "#12" abaixo do nome
        const haystack = `${sector.name || ""} #${sector.id}`.toLowerCase();
        const matchesSearch = !search || haystack.includes(search);
        const matchesStatus = status === "" || String(sector.is_active ? 1 : 0) === status;

        return matchesSearch && matchesStatus;
    });
}

// valor usado na comparação de cada coluna ordenável
function getSortValue(sector, key) {
    if (key === "status") return sector.is_active ? 1 : 0;
    return sector.name || "";
}

// ordena uma cópia da lista para não mexer na ordem original de allSectors
function sortSectors(sectors) {
    const { key, dir } = currentSort;
    const factor = dir === "desc" ? -1 : 1;

    return [...sectors].sort((a, b) => {
        const valueA = getSortValue(a, key);
        const valueB = getSortValue(b, key);

        const comparison = typeof valueA === "number"
            ? valueA - valueB
            : String(valueA).localeCompare(String(valueB), "pt-BR", { sensitivity: "base" });

        // empate cai para o nome, para a ordem não ficar instável entre renders
        if (comparison === 0 && key !== "name") {
            return String(a.name || "").localeCompare(String(b.name || ""), "pt-BR");
        }

        return comparison * factor;
    });
}

// reflete a ordenação atual nos cabeçalhos (seta + aria-sort para leitores de tela)
function updateSortIndicators() {
    document.querySelectorAll(".sectors-table th.is-sortable").forEach(th => {
        const isActive = th.dataset.sort === currentSort.key;

        th.classList.toggle("is-sorted-asc", isActive && currentSort.dir === "asc");
        th.classList.toggle("is-sorted-desc", isActive && currentSort.dir === "desc");
        th.setAttribute("aria-sort", isActive ? (currentSort.dir === "asc" ? "ascending" : "descending") : "none");
    });
}

// "12 setores" quando não há filtro; "5 de 12 setores" quando há
function updateSectorsCount(shown, total) {
    const counter = document.getElementById("sectorsCount");
    const label = total === 1 ? "setor" : "setores";

    counter.textContent = shown === total ? `${total} ${label}` : `${shown} de ${total} ${label}`;
}

// renderiza a tabela a partir de uma lista já filtrada e ordenada
function renderSectorsTable(sectors) {
    const tbody = document.getElementById("tbodySectors");
    tbody.innerHTML = "";

    if (sectors.length === 0) {
        tbody.innerHTML = `<tr class="forms-empty-row"><td colspan="3">Nenhum setor encontrado.</td></tr>`;
        return;
    }

    const fragment = document.createDocumentFragment();

    sectors.forEach(sector => {
        const tr = document.createElement("tr");
        const statusPill = sector.is_active
            ? `<span class="pill pill--green">Ativo</span>`
            : `<span class="pill pill--gray">Inativo</span>`;

        // um setor ativo só pode ser desativado, e vice-versa
        const toggleButton = sector.is_active
            ? `<button class="icon-btn icon-btn--danger btn-toggle-sector" data-id="${escapeHtml(sector.id)}" data-action="deactivate" title="Desativar" aria-label="Desativar">
                    <svg viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="5.5" stroke="currentColor" stroke-width="1.4"/><path d="M4.2 4.2l7.6 7.6" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>
               </button>`
            : `<button class="icon-btn btn-toggle-sector" data-id="${escapeHtml(sector.id)}" data-action="reactivate" title="Reativar" aria-label="Reativar">
                    <svg viewBox="0 0 16 16" fill="none"><path d="M13.2 8a5.2 5.2 0 1 1-1.7-3.85" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/><path d="M13.4 2.4v3.1h-3.1" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>
               </button>`;

        tr.innerHTML = `
            <td>
                <div class="sector-cell">
                    <span class="sector-cell-name">${escapeHtml(sector.name)}</span>
                    <span class="sector-cell-meta">#${escapeHtml(sector.id)}</span>
                </div>
            </td>
            <td class="status-column">${statusPill}</td>
            <td class="actions-column">
                <div class="table-actions">
                    <button class="icon-btn btn-edit-sector" data-id="${escapeHtml(sector.id)}" title="Editar" aria-label="Editar">
                        <svg viewBox="0 0 16 16" fill="none"><path d="M11.5 2.5l2 2L6 12l-2.7.7L4 10l7.5-7.5z" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/></svg>
                    </button>
                    ${toggleButton}
                </div>
            </td>
        `;

        fragment.appendChild(tr);
    });

    tbody.appendChild(fragment);
}

function applyFilters() {
    const filtered = getFilteredSectors();

    renderSectorsTable(sortSectors(filtered));
    updateSortIndicators();
    updateSectorsCount(filtered.length, allSectors.length);
}

async function populateSectorsTable() {
    const tbody = document.getElementById("tbodySectors");
    try {
        const response = await fetchWithAuth("/entrevista-adesao/sectors");

        if (!response.ok) {
            const errorJSON = await response.json().catch(() => null);
            throw new Error(errorJSON?.message || "Erro ao carregar os setores");
        }

        allSectors = await response.json();
        applyFilters();
    } catch (error) {
        console.log(error);
        tbody.innerHTML = `<tr class="forms-empty-row"><td colspan="3">Não foi possível carregar os setores.</td></tr>`;
    }
}

// Depois de qualquer alteração, além da própria tabela, os selects de setor da aba
// de Usuários precisam ser recarregados — senão ficam com a lista antiga até um
// refresh da página.
async function refreshSectors() {
    await populateSectorsTable();
    loadSectors().catch(error => console.log(error));
}

// valida o nome nos dois formulários; devolve o nome limpo ou null se inválido
function getValidatedName(formData) {
    const name = String(formData.get("name") || "").trim();

    if (!name) {
        notyf.error("O campo nome não pode estar vazio");
        return null;
    }

    if (name.length > SECTOR_NAME_MAX_LENGTH) {
        notyf.error(`O nome do setor deve ter no máximo ${SECTOR_NAME_MAX_LENGTH} caracteres`);
        return null;
    }

    return name;
}

// ---------- Modal de cadastro ----------
function openCreateModal() {
    setModalVisible("createSectorModalOverlay", true);
    document.getElementById("createSectorName").focus();
}

function closeCreateModal() {
    setModalVisible("createSectorModalOverlay", false);
}

// ---------- Modal de edição ----------
function openEditModal(sector) {
    document.getElementById("editSectorId").value = sector.id ?? "";
    document.getElementById("editSectorNameInput").value = sector.name ?? "";
    document.getElementById("editSectorStatus").value = sector.is_active ? "1" : "0";

    setModalVisible("editSectorModalOverlay", true);
}

function closeEditModal() {
    setModalVisible("editSectorModalOverlay", false);
}

// ---------- Modal de ativação / desativação ----------
function openToggleModal(sector, action) {
    const config = TOGGLE_ACTIONS[action];
    if (!config) return;

    sectorToToggle = { sector, action };

    const confirmButton = document.getElementById("toggleSectorConfirm");

    document.getElementById("toggleSectorTitle").textContent = config.title;
    document.getElementById("toggleSectorText").innerHTML = config.buildText(escapeHtml(sector.name));
    confirmButton.textContent = config.confirmLabel;
    confirmButton.classList.toggle("btn--danger", config.confirmClass === "btn--danger");
    confirmButton.classList.toggle("btn--primary", config.confirmClass === "btn--primary");

    setModalVisible("toggleSectorModalOverlay", true);
}

function closeToggleModal() {
    sectorToToggle = null;
    setModalVisible("toggleSectorModalOverlay", false);
}

// Inicializa a seção "Setores" da página de Configurações. O markup da seção já
// está no DOM quando esta função roda, então não há nada a adiar.
export function initSectorsSection() {
    populateSectorsTable();

    // ---------- Filtros ----------
    const filterSectorName = document.getElementById("filterSectorName");
    const filterSectorStatus = document.getElementById("filterSectorStatus");
    const filterSectorClear = document.getElementById("filterSectorClear");

    filterSectorName.addEventListener("input", applyFilters);
    filterSectorStatus.addEventListener("change", applyFilters);
    filterSectorClear.addEventListener("click", () => {
        filterSectorName.value = "";
        filterSectorStatus.value = "";
        applyFilters();
    });

    // ---------- Ordenação (delegação no thead) ----------
    document.querySelector(".sectors-table thead").addEventListener("click", (event) => {
        const th = event.target.closest("th.is-sortable");
        if (!th) return;

        const key = th.dataset.sort;

        // clicar de novo na mesma coluna inverte; trocar de coluna recomeça em asc
        currentSort = key === currentSort.key
            ? { key, dir: currentSort.dir === "asc" ? "desc" : "asc" }
            : { key, dir: "asc" };

        applyFilters();
    });

    // ---------- Ações da tabela (delegação de evento) ----------
    const tbody = document.getElementById("tbodySectors");
    tbody.addEventListener("click", (event) => {
        const editBtn = event.target.closest(".btn-edit-sector");
        if (editBtn) {
            const sector = allSectors.find(s => String(s.id) === editBtn.dataset.id);
            if (sector) openEditModal(sector);
            return;
        }

        const toggleBtn = event.target.closest(".btn-toggle-sector");
        if (toggleBtn) {
            const sector = allSectors.find(s => String(s.id) === toggleBtn.dataset.id);
            if (sector) openToggleModal(sector, toggleBtn.dataset.action);
            return;
        }
    });

    // ---------- Modal de cadastro ----------
    document.getElementById("btnOpenCreateSector").addEventListener("click", openCreateModal);
    document.getElementById("createSectorModalClose").addEventListener("click", closeCreateModal);

    const createForm = document.getElementById("createSectorForm");
    const createSubmitButton = getFormSubmitButton(createForm);
    createForm.addEventListener("submit", async (event) => {
        event.preventDefault();

        try {
            const name = getValidatedName(new FormData(createForm));
            if (!name) return;

            setSubmitLoading(createSubmitButton, true, "Cadastrando...");
            const response = await fetchWithAuth("/entrevista-adesao/sectors", {
                method: "POST",
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ name })
            });

            if (!response.ok) {
                throw new Error(await getErrorMessage(response, "Houve um erro ao tentar cadastrar o setor"));
            }

            createForm.reset();
            closeCreateModal();
            notyf.success("Setor cadastrado com sucesso");
            await refreshSectors(); // o setor novo já aparece na lista
        } catch (error) {
            notyf.error(error.message);
        } finally {
            setSubmitLoading(createSubmitButton, false);
        }
    });

    // ---------- Modal de edição ----------
    document.getElementById("editSectorModalClose").addEventListener("click", closeEditModal);
    document.getElementById("editSectorCancel").addEventListener("click", closeEditModal);

    const editForm = document.getElementById("editSectorForm");
    const editSubmitButton = getFormSubmitButton(editForm);
    editForm.addEventListener("submit", async (event) => {
        event.preventDefault();

        try {
            const formData = new FormData(editForm);
            const name = getValidatedName(formData);
            if (!name) return;

            const sectorId = formData.get("id");

            setSubmitLoading(editSubmitButton, true, "Salvando...");
            const response = await fetchWithAuth(`/entrevista-adesao/sectors/${sectorId}`, {
                method: "PUT",
                headers: {
                    'Content-Type': 'application/json'
                },
                // o select de status envia "1"/"0"; o backend espera um booleano
                body: JSON.stringify({ name, is_active: formData.get("is_active") === "1" })
            });

            if (!response.ok) {
                throw new Error(await getErrorMessage(response, "Houve um erro ao tentar atualizar o setor"));
            }

            closeEditModal();
            notyf.success("Setor atualizado com sucesso");
            await refreshSectors();
        } catch (error) {
            notyf.error(error.message);
        } finally {
            setSubmitLoading(editSubmitButton, false);
        }
    });

    // ---------- Modal de ativação / desativação ----------
    document.getElementById("toggleSectorModalClose").addEventListener("click", closeToggleModal);
    document.getElementById("toggleSectorCancel").addEventListener("click", closeToggleModal);

    const toggleConfirmButton = document.getElementById("toggleSectorConfirm");
    toggleConfirmButton.addEventListener("click", async () => {
        if (!sectorToToggle) {
            notyf.error("Nenhum setor foi selecionado");
            return;
        }

        const { sector, action } = sectorToToggle;
        const config = TOGGLE_ACTIONS[action];

        try {
            setSubmitLoading(toggleConfirmButton, true, config.loadingLabel);
            const response = await fetchWithAuth(config.path(sector.id), {
                method: config.method
            });

            if (!response.ok) {
                throw new Error(await getErrorMessage(response, config.errorMessage));
            }

            closeToggleModal();
            notyf.success(config.successMessage);
            await refreshSectors();
        } catch (error) {
            notyf.error(error.message);
        } finally {
            setSubmitLoading(toggleConfirmButton, false);
        }
    });

    // fecha os modais desta seção ao clicar fora do conteúdo ou pressionar Esc
    registerModalDismiss("createSectorModalOverlay", closeCreateModal);
    registerModalDismiss("editSectorModalOverlay", closeEditModal);
    registerModalDismiss("toggleSectorModalOverlay", closeToggleModal);
}
