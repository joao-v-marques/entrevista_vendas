import { fetchWithAuth, getErrorMessage } from "../utils/apiHelper.js";
import { escapeHtml } from "../utils/htmlEscape.js";
import { setModalVisible, registerModalDismiss } from "../utils/modalControl.js";
import { getFormSubmitButton, setSubmitLoading } from "../utils/submitLoading.js";
import { loadRoles } from "./usersSection.js";

// espelha ROLE_NAME_MAX_LENGTH em services/roles_services.py. A descrição não tem
// limite: a coluna é text e o service só faz trim.
const ROLE_NAME_MAX_LENGTH = 155;

// Cargos não têm exclusão: o backend só expõe deactivate/reactivate, e a FK
// users.role_id é ON DELETE RESTRICT. As duas ações dividem o mesmo modal de
// confirmação, e este mapa é o que muda entre elas.
const TOGGLE_ACTIONS = {
    deactivate: {
        title: "Desativar cargo",
        confirmLabel: "Desativar",
        confirmClass: "btn--danger",
        loadingLabel: "Desativando...",
        method: "DELETE",
        path: roleId => `/entrevista-adesao/roles/${roleId}/deactivate`,
        successMessage: "Cargo desativado com sucesso",
        errorMessage: "Houve um erro ao tentar desativar o cargo",
        // o segundo período não é detalhe: users_services revalida o role_id no
        // update, então um cargo inativo trava a edição de quem já o tem
        buildText: safeName => `Desativar o cargo <strong>${safeName}</strong>? Ele deixa de ficar disponível para novos usuários, e os usuários que já o têm não poderão ser editados enquanto ele estiver inativo. O acesso de quem usa o cargo não é revogado.`,
    },
    reactivate: {
        title: "Reativar cargo",
        confirmLabel: "Reativar",
        confirmClass: "btn--primary",
        loadingLabel: "Reativando...",
        method: "PATCH",
        path: roleId => `/entrevista-adesao/roles/${roleId}/reactivate`,
        successMessage: "Cargo reativado com sucesso",
        errorMessage: "Houve um erro ao tentar reativar o cargo",
        buildText: safeName => `Reativar o cargo <strong>${safeName}</strong>? Ele volta a ficar disponível para vínculo com os usuários.`,
    },
};

// guarda a lista completa carregada; os filtros atuam sobre ela sem novo request
let allRoles = [];

let currentSort = { key: "name", dir: "asc" };

// o que o modal de confirmação está prestes a fazer: { role, action }
let roleToToggle = null;

// aplica os filtros ativos sobre allRoles e retorna apenas os correspondentes
function getFilteredRoles() {
    const search = document.getElementById("filterRoleName").value.trim().toLowerCase();
    const status = document.getElementById("filterRoleStatus").value; // "1", "0" ou ""

    return allRoles.filter(role => {
        // a descrição entra na busca porque é onde está escrito o que o cargo faz;
        // o id entra porque a tabela mostra "#3" abaixo do nome
        const haystack = `${role.name || ""} ${role.description || ""} #${role.id}`.toLowerCase();
        const matchesSearch = !search || haystack.includes(search);
        const matchesStatus = status === "" || String(role.is_active ? 1 : 0) === status;

        return matchesSearch && matchesStatus;
    });
}

// valor usado na comparação de cada coluna ordenável
function getSortValue(role, key) {
    if (key === "status") return role.is_active ? 1 : 0;
    return role.name || "";
}

// ordena uma cópia da lista para não mexer na ordem original de allRoles
function sortRoles(roles) {
    const { key, dir } = currentSort;
    const factor = dir === "desc" ? -1 : 1;

    return [...roles].sort((a, b) => {
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
    document.querySelectorAll(".roles-table th.is-sortable").forEach(th => {
        const isActive = th.dataset.sort === currentSort.key;

        th.classList.toggle("is-sorted-asc", isActive && currentSort.dir === "asc");
        th.classList.toggle("is-sorted-desc", isActive && currentSort.dir === "desc");
        th.setAttribute("aria-sort", isActive ? (currentSort.dir === "asc" ? "ascending" : "descending") : "none");
    });
}

// "5 cargos" quando não há filtro; "2 de 5 cargos" quando há
function updateRolesCount(shown, total) {
    const counter = document.getElementById("rolesCount");
    const label = total === 1 ? "cargo" : "cargos";

    counter.textContent = shown === total ? `${total} ${label}` : `${shown} de ${total} ${label}`;
}

// renderiza a tabela a partir de uma lista já filtrada e ordenada
function renderRolesTable(roles) {
    const tbody = document.getElementById("tbodyRoles");
    tbody.innerHTML = "";

    if (roles.length === 0) {
        tbody.innerHTML = `<tr class="forms-empty-row"><td colspan="4">Nenhum cargo encontrado.</td></tr>`;
        return;
    }

    const fragment = document.createDocumentFragment();

    roles.forEach(role => {
        const tr = document.createElement("tr");
        const statusPill = role.is_active
            ? `<span class="pill pill--green">Ativo</span>`
            : `<span class="pill pill--gray">Inativo</span>`;

        // um cargo ativo só pode ser desativado, e vice-versa
        const toggleButton = role.is_active
            ? `<button class="icon-btn icon-btn--danger btn-toggle-role" data-id="${escapeHtml(role.id)}" data-action="deactivate" title="Desativar" aria-label="Desativar">
                    <svg viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="5.5" stroke="currentColor" stroke-width="1.4"/><path d="M4.2 4.2l7.6 7.6" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>
               </button>`
            : `<button class="icon-btn btn-toggle-role" data-id="${escapeHtml(role.id)}" data-action="reactivate" title="Reativar" aria-label="Reativar">
                    <svg viewBox="0 0 16 16" fill="none"><path d="M13.2 8a5.2 5.2 0 1 1-1.7-3.85" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/><path d="M13.4 2.4v3.1h-3.1" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>
               </button>`;

        // a célula trunca em duas linhas por CSS; o title guarda o texto inteiro
        const description = role.description
            ? `<span class="role-description-cell" title="${escapeHtml(role.description)}">${escapeHtml(role.description)}</span>`
            : "—";

        tr.innerHTML = `
            <td>
                <div class="role-cell">
                    <span class="role-cell-name">${escapeHtml(role.name)}</span>
                    <span class="role-cell-meta">#${escapeHtml(role.id)}</span>
                </div>
            </td>
            <td class="roles-col-description">${description}</td>
            <td class="status-column">${statusPill}</td>
            <td class="actions-column">
                <div class="table-actions">
                    <button class="icon-btn btn-edit-role" data-id="${escapeHtml(role.id)}" title="Editar" aria-label="Editar">
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
    const filtered = getFilteredRoles();

    renderRolesTable(sortRoles(filtered));
    updateSortIndicators();
    updateRolesCount(filtered.length, allRoles.length);
}

async function populateRolesTable() {
    const tbody = document.getElementById("tbodyRoles");
    try {
        const response = await fetchWithAuth("/entrevista-adesao/roles");

        if (!response.ok) {
            const errorJSON = await response.json().catch(() => null);
            throw new Error(errorJSON?.message || "Erro ao carregar os cargos");
        }

        allRoles = await response.json();
        applyFilters();
    } catch (error) {
        console.log(error);
        tbody.innerHTML = `<tr class="forms-empty-row"><td colspan="4">Não foi possível carregar os cargos.</td></tr>`;
    }
}

// Depois de qualquer alteração, além da própria tabela, os selects de cargo da aba
// de Usuários precisam ser recarregados — senão ficam com a lista antiga até um
// refresh da página.
async function refreshRoles() {
    await populateRolesTable();
    loadRoles().catch(error => console.log(error));
}

// valida o nome nos dois formulários; devolve o nome limpo ou null se inválido
function getValidatedName(formData) {
    const name = String(formData.get("name") || "").trim();

    if (!name) {
        notyf.error("O campo nome não pode estar vazio");
        return null;
    }

    if (name.length > ROLE_NAME_MAX_LENGTH) {
        notyf.error(`O nome do cargo deve ter no máximo ${ROLE_NAME_MAX_LENGTH} caracteres`);
        return null;
    }

    return name;
}

// ---------- Modal de cadastro ----------
function openCreateModal() {
    setModalVisible("createRoleModalOverlay", true);
    document.getElementById("createRoleName").focus();
}

function closeCreateModal() {
    setModalVisible("createRoleModalOverlay", false);
}

// ---------- Modal de edição ----------
function openEditModal(role) {
    document.getElementById("editRoleId").value = role.id ?? "";
    document.getElementById("editRoleNameInput").value = role.name ?? "";
    document.getElementById("editRoleDescription").value = role.description ?? "";
    document.getElementById("editRoleStatus").value = role.is_active ? "1" : "0";

    setModalVisible("editRoleModalOverlay", true);
}

function closeEditModal() {
    setModalVisible("editRoleModalOverlay", false);
}

// ---------- Modal de ativação / desativação ----------
function openToggleModal(role, action) {
    const config = TOGGLE_ACTIONS[action];
    if (!config) return;

    roleToToggle = { role, action };

    const confirmButton = document.getElementById("toggleRoleConfirm");

    document.getElementById("toggleRoleTitle").textContent = config.title;
    document.getElementById("toggleRoleText").innerHTML = config.buildText(escapeHtml(role.name));
    confirmButton.textContent = config.confirmLabel;
    confirmButton.classList.toggle("btn--danger", config.confirmClass === "btn--danger");
    confirmButton.classList.toggle("btn--primary", config.confirmClass === "btn--primary");

    setModalVisible("toggleRoleModalOverlay", true);
}

function closeToggleModal() {
    roleToToggle = null;
    setModalVisible("toggleRoleModalOverlay", false);
}

// Inicializa a seção "Cargos" da página de Configurações. O markup da seção já
// está no DOM quando esta função roda, então não há nada a adiar.
export function initRolesSection() {
    populateRolesTable();

    // ---------- Filtros ----------
    const filterRoleName = document.getElementById("filterRoleName");
    const filterRoleStatus = document.getElementById("filterRoleStatus");
    const filterRoleClear = document.getElementById("filterRoleClear");

    filterRoleName.addEventListener("input", applyFilters);
    filterRoleStatus.addEventListener("change", applyFilters);
    filterRoleClear.addEventListener("click", () => {
        filterRoleName.value = "";
        filterRoleStatus.value = "";
        applyFilters();
    });

    // ---------- Ordenação (delegação no thead) ----------
    document.querySelector(".roles-table thead").addEventListener("click", (event) => {
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
    const tbody = document.getElementById("tbodyRoles");
    tbody.addEventListener("click", (event) => {
        const editBtn = event.target.closest(".btn-edit-role");
        if (editBtn) {
            const role = allRoles.find(r => String(r.id) === editBtn.dataset.id);
            if (role) openEditModal(role);
            return;
        }

        const toggleBtn = event.target.closest(".btn-toggle-role");
        if (toggleBtn) {
            const role = allRoles.find(r => String(r.id) === toggleBtn.dataset.id);
            if (role) openToggleModal(role, toggleBtn.dataset.action);
            return;
        }
    });

    // ---------- Modal de cadastro ----------
    document.getElementById("btnOpenCreateRole").addEventListener("click", openCreateModal);
    document.getElementById("createRoleModalClose").addEventListener("click", closeCreateModal);

    const createForm = document.getElementById("createRoleForm");
    const createSubmitButton = getFormSubmitButton(createForm);
    createForm.addEventListener("submit", async (event) => {
        event.preventDefault();

        try {
            const formData = new FormData(createForm);
            const name = getValidatedName(formData);
            if (!name) return;

            // descrição vazia vai como string; o service converte para None
            const description = String(formData.get("description") || "").trim();

            setSubmitLoading(createSubmitButton, true, "Cadastrando...");
            const response = await fetchWithAuth("/entrevista-adesao/roles", {
                method: "POST",
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ name, description })
            });

            if (!response.ok) {
                throw new Error(await getErrorMessage(response, "Houve um erro ao tentar cadastrar o cargo"));
            }

            createForm.reset();
            closeCreateModal();
            notyf.success("Cargo cadastrado com sucesso");
            await refreshRoles(); // o cargo novo já aparece na lista
        } catch (error) {
            notyf.error(error.message);
        } finally {
            setSubmitLoading(createSubmitButton, false);
        }
    });

    // ---------- Modal de edição ----------
    document.getElementById("editRoleModalClose").addEventListener("click", closeEditModal);
    document.getElementById("editRoleCancel").addEventListener("click", closeEditModal);

    const editForm = document.getElementById("editRoleForm");
    const editSubmitButton = getFormSubmitButton(editForm);
    editForm.addEventListener("submit", async (event) => {
        event.preventDefault();

        try {
            const formData = new FormData(editForm);
            const name = getValidatedName(formData);
            if (!name) return;

            const roleId = formData.get("id");
            const description = String(formData.get("description") || "").trim();

            setSubmitLoading(editSubmitButton, true, "Salvando...");
            const response = await fetchWithAuth(`/entrevista-adesao/roles/${roleId}`, {
                method: "PUT",
                headers: {
                    'Content-Type': 'application/json'
                },
                // o select de status envia "1"/"0"; o backend espera um booleano
                body: JSON.stringify({ name, description, is_active: formData.get("is_active") === "1" })
            });

            if (!response.ok) {
                throw new Error(await getErrorMessage(response, "Houve um erro ao tentar atualizar o cargo"));
            }

            closeEditModal();
            notyf.success("Cargo atualizado com sucesso");
            await refreshRoles();
        } catch (error) {
            notyf.error(error.message);
        } finally {
            setSubmitLoading(editSubmitButton, false);
        }
    });

    // ---------- Modal de ativação / desativação ----------
    document.getElementById("toggleRoleModalClose").addEventListener("click", closeToggleModal);
    document.getElementById("toggleRoleCancel").addEventListener("click", closeToggleModal);

    const toggleConfirmButton = document.getElementById("toggleRoleConfirm");
    toggleConfirmButton.addEventListener("click", async () => {
        if (!roleToToggle) {
            notyf.error("Nenhum cargo foi selecionado");
            return;
        }

        const { role, action } = roleToToggle;
        const config = TOGGLE_ACTIONS[action];

        try {
            setSubmitLoading(toggleConfirmButton, true, config.loadingLabel);
            const response = await fetchWithAuth(config.path(role.id), {
                method: config.method
            });

            if (!response.ok) {
                throw new Error(await getErrorMessage(response, config.errorMessage));
            }

            closeToggleModal();
            notyf.success(config.successMessage);
            await refreshRoles();
        } catch (error) {
            notyf.error(error.message);
        } finally {
            setSubmitLoading(toggleConfirmButton, false);
        }
    });

    // fecha os modais desta seção ao clicar fora do conteúdo ou pressionar Esc
    registerModalDismiss("createRoleModalOverlay", closeCreateModal);
    registerModalDismiss("editRoleModalOverlay", closeEditModal);
    registerModalDismiss("toggleRoleModalOverlay", closeToggleModal);
}
