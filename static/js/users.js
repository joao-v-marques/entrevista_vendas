import { fetchWithAuth } from "./utils/apiHelper.js";

// mapeia role_name (vindo do backend) para o rótulo exibido e o variant da .pill
const ROLE_LABELS = {
    administrator: "Administrador",
    employee: "Funcionário",
};

const ROLE_PILL_CLASSES = {
    administrator: "pill--purple",
    employee: "pill--gray",
};

function getRoleLabel(roleName) {
    return ROLE_LABELS[roleName] || (roleName || "—");
}

function getRolePillClass(roleName) {
    return ROLE_PILL_CLASSES[roleName] || "pill--gray";
}

// pequeno helper para não injetar HTML a partir de dados do backend sem escapar
function escapeHtml(value) {
    if (value == null) return "";
    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

// guarda a lista completa carregada; os filtros atuam sobre ela sem novo request
let allUsers = [];

// guardam roles e sectors vindos do backend para reutilizar nos selects
let allRoles = [];
let allSectors = [];

// preenche um <select> com options a partir de uma lista, escapando os valores
function fillSelectOptions(select, items, getValue, getLabel) {
    if (!select) return;
    const previous = select.value;

    select.innerHTML = items
        .map(item => `<option value="${escapeHtml(getValue(item))}">${escapeHtml(getLabel(item))}</option>`)
        .join("");

    // mantém a seleção anterior caso o valor ainda exista
    if (items.some(item => String(getValue(item)) === previous)) select.value = previous;
}

// carrega os cargos do backend e preenche os selects de cargo (cadastro e edição)
async function loadRoles() {
    const response = await fetchWithAuth("/entrevista-adesao/roles");

    if (!response.ok) {
        const errorJSON = await response.json().catch(() => null);
        throw new Error(errorJSON?.message || "Erro ao carregar os cargos");
    }

    allRoles = await response.json();

    const getValue = role => role.id;
    const getLabel = role => getRoleLabel(role.name);

    fillSelectOptions(document.getElementById("createRole"), allRoles, getValue, getLabel);
    fillSelectOptions(document.getElementById("editRole"), allRoles, getValue, getLabel);
}

// carrega os setores do backend e preenche os selects de setor (cadastro e edição)
async function loadSectors() {
    const response = await fetchWithAuth("/entrevista-adesao/sectors");

    if (!response.ok) {
        const errorJSON = await response.json().catch(() => null);
        throw new Error(errorJSON?.message || "Erro ao carregar os setores");
    }

    allSectors = await response.json();

    const getValue = sector => sector.id;
    const getLabel = sector => sector.name;

    fillSelectOptions(document.getElementById("createSector"), allSectors, getValue, getLabel);
    fillSelectOptions(document.getElementById("editSector"), allSectors, getValue, getLabel);
}

// preenche o select de cargo do filtro com os valores presentes nos dados carregados
function populateRoleFilter(users) {
    const roleSelect = document.getElementById("filterRole");
    const roles = [...new Set(users.map(u => u.role_name).filter(Boolean))].sort();
    const previous = roleSelect.value;

    roleSelect.innerHTML = `<option value="">Todos</option>` +
        roles.map(role => `<option value="${escapeHtml(role)}">${escapeHtml(getRoleLabel(role))}</option>`).join("");

    if (roles.includes(previous)) roleSelect.value = previous;
}

// aplica os filtros ativos sobre allUsers e retorna apenas os usuários correspondentes
function getFilteredUsers() {
    const search = document.getElementById("filterUser").value.trim().toLowerCase();
    const role = document.getElementById("filterRole").value;
    const status = document.getElementById("filterUserStatus").value; // "1", "0" ou ""

    return allUsers.filter(user => {
        const haystack = `${user.name || ""} ${user.username || ""} ${user.email || ""}`.toLowerCase();
        const matchesSearch = !search || haystack.includes(search);
        const matchesRole = !role || user.role_name === role;
        const matchesStatus = status === "" || String(user.is_active ? 1 : 0) === status;

        return matchesSearch && matchesRole && matchesStatus;
    });
}

// renderiza a tabela a partir de uma lista já filtrada
function renderUsersTable(users) {
    const tbody = document.getElementById("tbodyUsers");
    tbody.innerHTML = "";

    if (users.length === 0) {
        tbody.innerHTML = `<tr class="forms-empty-row"><td colspan="8">Nenhum usuário encontrado.</td></tr>`;
        return;
    }

    const fragment = document.createDocumentFragment();

    users.forEach(user => {
        const tr = document.createElement("tr");
        const statusPill = user.is_active
            ? `<span class="pill pill--green">Ativo</span>`
            : `<span class="pill pill--gray">Inativo</span>`;

        tr.innerHTML = `
            <td>${escapeHtml(user.id)}</td>
            <td>${escapeHtml(user.name)}</td>
            <td>${escapeHtml(user.username)}</td>
            <td class="user-email">${escapeHtml(user.email)}</td>
            <td><span class="pill ${getRolePillClass(user.role_name)}">${escapeHtml(getRoleLabel(user.role_name))}</span></td>
            <td>${escapeHtml(user.sector_name)}</td>
            <td class="status-column">${statusPill}</td>
            <td>
                <div class="table-actions">
                    <button class="icon-btn btn-edit-user" data-id="${escapeHtml(user.id)}" title="Editar" aria-label="Editar">
                        <svg viewBox="0 0 16 16" fill="none"><path d="M11.5 2.5l2 2L6 12l-2.7.7L4 10l7.5-7.5z" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/></svg>
                    </button>
                    <button class="icon-btn icon-btn--danger btn-delete-user" data-id="${escapeHtml(user.id)}" title="Excluir" aria-label="Excluir">
                        <svg viewBox="0 0 16 16" fill="none"><path d="M3 4.5h10M6.5 4.5V3a1 1 0 011-1h1a1 1 0 011 1v1.5M4.5 4.5l.5 8a1 1 0 001 1h4a1 1 0 001-1l.5-8" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>
                    </button>
                </div>
            </td>
        `;

        fragment.appendChild(tr);
    });

    tbody.appendChild(fragment);
}

function applyFilters() {
    renderUsersTable(getFilteredUsers());
}

async function populateUsersTable() {
    const tbody = document.getElementById("tbodyUsers");
    try {
        const response = await fetchWithAuth("/entrevista-adesao/users");

        if (!response.ok) {
            const errorJSON = await response.json().catch(() => null);
            throw new Error(errorJSON?.message || "Erro ao carregar os usuários");
        }

        allUsers = await response.json();
        populateRoleFilter(allUsers);
        applyFilters();
    } catch (error) {
        console.log(error);
        tbody.innerHTML = `<tr class="forms-empty-row"><td colspan="8">Não foi possível carregar os usuários.</td></tr>`;
    }
}

// ---------- Modal de edição ----------
function openEditModal(user) {
    document.getElementById("editUserId").value = user.id ?? "";
    document.getElementById("editName").value = user.name ?? "";
    document.getElementById("editUsername").value = user.username ?? "";
    document.getElementById("editEmail").value = user.email ?? "";
    document.getElementById("editRole").value = user.role_id ?? "";
    document.getElementById("editSector").value = user.sector_id ?? "";
    document.getElementById("editStatus").value = user.is_active ? "1" : "0";

    document.getElementById("editUserModalOverlay").hidden = false;
}

function closeEditModal() {
    document.getElementById("editUserModalOverlay").hidden = true;
}

// ---------- Modal de exclusão ----------
let userToDelete = null;

function openDeleteModal(user) {
    userToDelete = user;
    document.getElementById("deleteUserName").textContent = user.name || user.username || `#${user.id}`;
    document.getElementById("deleteUserModalOverlay").hidden = false;
}

function closeDeleteModal() {
    userToDelete = null;
    document.getElementById("deleteUserModalOverlay").hidden = true;
}

document.addEventListener("DOMContentLoaded", () => {
    populateUsersTable();

    // carrega cargos e setores do backend para preencher os selects
    loadRoles().catch(error => {
        console.log(error);
        notyf.error("Não foi possível carregar os cargos.");
    });
    loadSectors().catch(error => {
        console.log(error);
        notyf.error("Não foi possível carregar os setores.");
    });

    // ---------- Filtros ----------
    const filterUser = document.getElementById("filterUser");
    const filterRole = document.getElementById("filterRole");
    const filterUserStatus = document.getElementById("filterUserStatus");
    const filterUserClear = document.getElementById("filterUserClear");

    filterUser.addEventListener("input", applyFilters);
    filterRole.addEventListener("change", applyFilters);
    filterUserStatus.addEventListener("change", applyFilters);
    filterUserClear.addEventListener("click", () => {
        filterUser.value = "";
        filterRole.value = "";
        filterUserStatus.value = "";
        applyFilters();
    });

    // ---------- Ações da tabela (delegação de evento) ----------
    const tbody = document.getElementById("tbodyUsers");
    tbody.addEventListener("click", (event) => {
        const editBtn = event.target.closest(".btn-edit-user");
        if (editBtn) {
            const user = allUsers.find(u => String(u.id) === editBtn.dataset.id);
            if (user) openEditModal(user);
            return;
        }

        const deleteBtn = event.target.closest(".btn-delete-user");
        if (deleteBtn) {
            const user = allUsers.find(u => String(u.id) === deleteBtn.dataset.id);
            if (user) openDeleteModal(user);
            return;
        }
    });

    // ---------- Formulário de cadastro (lógica de backend pendente) ----------
    const createForm = document.getElementById("createUserForm");
    createForm.addEventListener("submit", (event) => {
        event.preventDefault();
        notyf.success("Interface pronta — a criação do usuário será integrada ao backend posteriormente.");
    });

    // ---------- Modal de edição ----------
    document.getElementById("editUserModalClose").addEventListener("click", closeEditModal);
    document.getElementById("editUserCancel").addEventListener("click", closeEditModal);
    document.getElementById("editUserForm").addEventListener("submit", (event) => {
        event.preventDefault();
        notyf.success("Interface pronta — a edição do usuário será integrada ao backend posteriormente.");
        closeEditModal();
    });

    // ---------- Modal de exclusão ----------
    document.getElementById("deleteUserModalClose").addEventListener("click", closeDeleteModal);
    document.getElementById("deleteUserCancel").addEventListener("click", closeDeleteModal);
    document.getElementById("deleteUserConfirm").addEventListener("click", () => {
        notyf.success("Interface pronta — a exclusão do usuário será integrada ao backend posteriormente.");
        closeDeleteModal();
    });

    // fecha os modais ao clicar fora do conteúdo ou pressionar Esc
    document.querySelectorAll(".modal-overlay").forEach(overlay => {
        overlay.addEventListener("click", (event) => {
            if (event.target === overlay) overlay.hidden = true;
        });
    });
    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape") {
            closeEditModal();
            closeDeleteModal();
        }
    });
});
