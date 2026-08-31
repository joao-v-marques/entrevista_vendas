import { fetchWithAuth } from "./utils/apiHelper.js";
import { formatCPF } from "./utils/detailsView.js";

// mapeia role_name (vindo do backend) para o rótulo exibido e o variant da .pill
const ROLE_LABELS = {
    administrator: "Administrador",
    employee: "Funcionário",
};

const ROLE_PILL_CLASSES = {
    administrator: "pill--purple",
    employee: "pill--gray",
};

// HELPER PARA PEGAR AS MENSAGENS DE ERRO (Tratamento de Exceptions)
async function getErrorMessage(response, fallback) {
    const rawBody = await response.text();
    try {
        const json = JSON.parse(rawBody);
        return json?.message || fallback;
    } catch {
        return rawBody || fallback;
    }
}

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

// aplica a máscara 000.000.000-00 conforme o usuário digita
function maskCpf(digits) {
    let masked = digits.slice(0, 3);
    if (digits.length > 3) masked += "." + digits.slice(3, 6);
    if (digits.length > 6) masked += "." + digits.slice(6, 9);
    if (digits.length > 9) masked += "-" + digits.slice(9, 11);
    return masked;
}

// prende o input à máscara: aceita só dígitos e no máximo os 11 do CPF
function bindCpfMask(input) {
    if (!input) return;
    input.addEventListener("input", () => {
        const digits = input.value.replace(/\D/g, "").slice(0, 11);
        input.value = maskCpf(digits);
    });
}

// só os dígitos vão para o backend (a coluna é CHAR(11)); vazio vira null
function getCpfDigits(value) {
    const digits = String(value || "").replace(/\D/g, "");
    return digits || null;
}

// guarda a lista completa carregada; os filtros atuam sobre ela sem novo request
let allUsers = [];

// guardam roles e sectors vindos do backend para reutilizar nos selects
let allRoles = [];
let allSectors = [];

// ordenação atual da tabela; a lista já vem do backend por id, mas por nome é
// bem mais útil para procurar alguém na lista
let currentSort = { key: "name", dir: "asc" };

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

// preenche um select de filtro com os valores distintos presentes nos dados carregados
function populateFilterSelect(select, values) {
    const previous = select.value;
    const options = [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b, "pt-BR"));

    select.innerHTML = `<option value="">Todos</option>` +
        options.map(value => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`).join("");

    if (options.includes(previous)) select.value = previous;
}

// o filtro de cargo guarda o role_name cru no value, mas exibe o rótulo traduzido
function populateRoleFilter(users) {
    const roleSelect = document.getElementById("filterRole");
    const roles = [...new Set(users.map(u => u.role_name).filter(Boolean))].sort();
    const previous = roleSelect.value;

    roleSelect.innerHTML = `<option value="">Todos</option>` +
        roles.map(role => `<option value="${escapeHtml(role)}">${escapeHtml(getRoleLabel(role))}</option>`).join("");

    if (roles.includes(previous)) roleSelect.value = previous;
}

function populateSectorFilter(users) {
    populateFilterSelect(document.getElementById("filterSector"), users.map(u => u.sector_name));
}

// aplica os filtros ativos sobre allUsers e retorna apenas os usuários correspondentes
function getFilteredUsers() {
    const search = document.getElementById("filterUser").value.trim().toLowerCase();
    const role = document.getElementById("filterRole").value;
    const sector = document.getElementById("filterSector").value;
    const status = document.getElementById("filterUserStatus").value; // "1", "0" ou ""

    return allUsers.filter(user => {
        // o CPF entra cru e mascarado para achar tanto "12345678900" quanto "123.456.789-00"
        const cpf = user.cpf || "";
        const haystack = `${user.name || ""} ${user.username || ""} ${user.email || ""} ${user.sector_name || ""} ${cpf} ${formatCPF(cpf)}`.toLowerCase();
        const matchesSearch = !search || haystack.includes(search);
        const matchesRole = !role || user.role_name === role;
        const matchesSector = !sector || user.sector_name === sector;
        const matchesStatus = status === "" || String(user.is_active ? 1 : 0) === status;

        return matchesSearch && matchesRole && matchesSector && matchesStatus;
    });
}

// valor usado na comparação de cada coluna ordenável
function getSortValue(user, key) {
    if (key === "role") return getRoleLabel(user.role_name);
    if (key === "status") return user.is_active ? 1 : 0;
    return user.name || user.username || "";
}

// ordena uma cópia da lista para não mexer na ordem original de allUsers
function sortUsers(users) {
    const { key, dir } = currentSort;
    const factor = dir === "desc" ? -1 : 1;

    return [...users].sort((a, b) => {
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
    document.querySelectorAll(".users-table th.is-sortable").forEach(th => {
        const isActive = th.dataset.sort === currentSort.key;

        th.classList.toggle("is-sorted-asc", isActive && currentSort.dir === "asc");
        th.classList.toggle("is-sorted-desc", isActive && currentSort.dir === "desc");
        th.setAttribute("aria-sort", isActive ? (currentSort.dir === "asc" ? "ascending" : "descending") : "none");
    });
}

// "12 usuários" quando não há filtro; "5 de 12 usuários" quando há
function updateUsersCount(shown, total) {
    const counter = document.getElementById("usersCount");
    const label = total === 1 ? "usuário" : "usuários";

    counter.textContent = shown === total ? `${total} ${label}` : `${shown} de ${total} ${label}`;
}

// renderiza a tabela a partir de uma lista já filtrada e ordenada
function renderUsersTable(users) {
    const tbody = document.getElementById("tbodyUsers");
    tbody.innerHTML = "";

    if (users.length === 0) {
        tbody.innerHTML = `<tr class="forms-empty-row"><td colspan="5">Nenhum usuário encontrado.</td></tr>`;
        return;
    }

    const fragment = document.createDocumentFragment();

    users.forEach(user => {
        const tr = document.createElement("tr");
        const statusPill = user.is_active
            ? `<span class="pill pill--green">Ativo</span>`
            : `<span class="pill pill--gray">Inativo</span>`;

        tr.innerHTML = `
            <td>
                <div class="user-cell">
                    <span class="user-cell-name">${escapeHtml(user.name)}</span>
                    <span class="user-cell-meta">@${escapeHtml(user.username)} · #${escapeHtml(user.id)}</span>
                    <span class="user-cell-email">${user.email ? escapeHtml(user.email) : "—"}</span>
                </div>
            </td>
            <td class="user-cpf">${user.cpf ? escapeHtml(formatCPF(user.cpf)) : "—"}</td>
            <td>
                <div class="user-role-cell">
                    <span class="pill ${getRolePillClass(user.role_name)}">${escapeHtml(getRoleLabel(user.role_name))}</span>
                    <span class="user-cell-sector">${user.sector_name ? escapeHtml(user.sector_name) : "—"}</span>
                </div>
            </td>
            <td class="status-column">${statusPill}</td>
            <td class="actions-column">
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
    const filtered = getFilteredUsers();

    renderUsersTable(sortUsers(filtered));
    updateSortIndicators();
    updateUsersCount(filtered.length, allUsers.length);
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
        populateSectorFilter(allUsers);
        applyFilters();
    } catch (error) {
        console.log(error);
        tbody.innerHTML = `<tr class="forms-empty-row"><td colspan="5">Não foi possível carregar os usuários.</td></tr>`;
    }
}

// ---------- Controle dos modais ----------
// Enquanto houver algum modal aberto o fundo não pode rolar. A trava é derivada do
// estado real dos overlays (e não de um contador), então qualquer caminho de
// fechamento — X, Cancelar, Esc ou clique fora — chega ao mesmo resultado.
function syncBodyScrollLock() {
    const anyOpen = [...document.querySelectorAll(".modal-overlay")].some(overlay => !overlay.hidden);
    const root = document.documentElement;

    if (anyOpen === root.classList.contains("modal-open")) return;

    // mede a barra de rolagem ANTES de travar; depois de travar ela já sumiu
    const scrollbarWidth = window.innerWidth - root.clientWidth;

    root.classList.toggle("modal-open", anyOpen);
    root.style.paddingRight = anyOpen && scrollbarWidth > 0 ? `${scrollbarWidth}px` : "";
}

function setModalVisible(overlayId, visible) {
    document.getElementById(overlayId).hidden = !visible;
    syncBodyScrollLock();
}

// ---------- Modal de cadastro ----------
function openCreateModal() {
    setModalVisible("createUserModalOverlay", true);
    document.getElementById("createName").focus();
}

function closeCreateModal() {
    setModalVisible("createUserModalOverlay", false);
}

// ---------- Modal de edição ----------
function openEditModal(user) {
    document.getElementById("editUserId").value = user.id ?? "";
    document.getElementById("editName").value = user.name ?? "";
    document.getElementById("editUsername").value = user.username ?? "";
    document.getElementById("editCpf").value = user.cpf ? formatCPF(user.cpf) : "";
    document.getElementById("editEmail").value = user.email ?? "";
    document.getElementById("editRole").value = user.role_id ?? "";
    document.getElementById("editSector").value = user.sector_id ?? "";
    document.getElementById("editStatus").value = user.is_active ? "1" : "0";

    setModalVisible("editUserModalOverlay", true);
}

function closeEditModal() {
    setModalVisible("editUserModalOverlay", false);
}

// ---------- Modal de exclusão ----------
let userToDelete = null;

function openDeleteModal(user) {
    userToDelete = user;
    document.getElementById("deleteUserName").textContent = user.name || user.username || `#${user.id}`;
    setModalVisible("deleteUserModalOverlay", true);
}

function closeDeleteModal() {
    userToDelete = null;
    setModalVisible("deleteUserModalOverlay", false);
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

    // ---------- Máscara de CPF (cadastro e edição) ----------
    bindCpfMask(document.getElementById("createCpf"));
    bindCpfMask(document.getElementById("editCpf"));

    // ---------- Filtros ----------
    const filterUser = document.getElementById("filterUser");
    const filterRole = document.getElementById("filterRole");
    const filterSector = document.getElementById("filterSector");
    const filterUserStatus = document.getElementById("filterUserStatus");
    const filterUserClear = document.getElementById("filterUserClear");

    filterUser.addEventListener("input", applyFilters);
    filterRole.addEventListener("change", applyFilters);
    filterSector.addEventListener("change", applyFilters);
    filterUserStatus.addEventListener("change", applyFilters);
    filterUserClear.addEventListener("click", () => {
        filterUser.value = "";
        filterRole.value = "";
        filterSector.value = "";
        filterUserStatus.value = "";
        applyFilters();
    });

    // ---------- Ordenação (delegação no thead) ----------
    document.querySelector(".users-table thead").addEventListener("click", (event) => {
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

    // ---------- Modal de cadastro ----------
    document.getElementById("btnOpenCreateUser").addEventListener("click", openCreateModal);
    document.getElementById("createUserModalClose").addEventListener("click", closeCreateModal);

    const createForm = document.getElementById("createUserForm");
    createForm.addEventListener("submit", async (e) => {
        e.preventDefault();

        try {
            const formData = new FormData(createForm);

            // validação remover espaços no inicio e final da string
            for (let [key, value] of formData.entries()) {
                if (typeof value === "string") {
                    formData.set(key, value.trim());
                }
            }

            const data = Object.fromEntries(formData.entries());

            const required_fields = [
                "username",
                "name",
                "password",
                "password_confirm",
                "role_id"
            ]

            for (let field of required_fields) {
                const value = formData.get(field);

                if (!value || value === "") {
                    notyf.error(`O campo ${field} não pode estar vazio`);
                    return;
                }
            }

            // o input mantém a máscara na tela, mas só os 11 dígitos vão para o backend
            // o CPF é opcional no cadastro
            data.cpf = getCpfDigits(data.cpf);

            if (data.cpf && data.cpf.length !== 11) {
                notyf.error("O CPF informado deve conter 11 dígitos");
                return;
            }

            if (data.password !== data.password_confirm) {
                notyf.error("As senhas inseridas não são iguais.")
                return;
            }

            const response = await fetchWithAuth("/entrevista-adesao/users", {
                method: "POST",
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            });

            if (!response.ok) {
                let errorMessage = "Houve um erro ao tentar cadastrar o usuário";

                try {
                    const errorJSON = await response.json();

                    if (errorJSON?.message) {
                        errorMessage = errorJSON.message;
                    }
                } catch (parseError) {
                    errorMessage = await response.text();
                }

                throw new Error(errorMessage);
            }

            createForm.reset();
            closeCreateModal();
            notyf.success("Usuário cadastrado com sucesso");
            populateUsersTable(); // atualiza a tabela para o usuário novo já aparecer na lista
        } catch (error) {
            notyf.error(error.message);
        }
    });

    // ---------- Modal de edição ----------
    document.getElementById("editUserModalClose").addEventListener("click", closeEditModal);
    document.getElementById("editUserCancel").addEventListener("click", closeEditModal);
    const editForm = document.getElementById("editUserForm");
    editForm.addEventListener("submit", async (event) => {
        event.preventDefault();

        try {
            const formData = new FormData(editForm);

            // validação remover espaços no inicio e final da string
            for (let [key, value] of formData.entries()) {
                if (typeof value === "string") {
                    formData.set(key, value.trim());
                }
            }

            const data = Object.fromEntries(formData.entries());

            const required_fields = [
                "username",
                "name",
                "role_id",
                "sector_id"
            ]

            for (let field of required_fields) {
                const value = formData.get(field);

                if (!value || value === "") {
                    notyf.error(`O campo ${field} não pode estar vazio`);
                    return;
                }
            }

            // o CPF continua opcional aqui porque existem usuários cadastrados antes do campo;
            // quando preenchido precisa estar completo e vai sem máscara para o backend
            data.cpf = getCpfDigits(data.cpf);

            if (data.cpf && data.cpf.length !== 11) {
                notyf.error("O CPF informado deve conter 11 dígitos");
                return;
            }

            // o select de status envia "1"/"0"; o backend espera um booleano
            data.is_active = data.is_active === "1";

            const response = await fetchWithAuth(`/entrevista-adesao/users/${data.id}`, {
                method: "PUT",
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            });

            if (!response.ok) {
                throw new Error(await getErrorMessage(response, "Houve um erro ao tentar atualizar o usuário"));
            }

            closeEditModal();
            notyf.success("Usuário atualizado com sucesso");
            populateUsersTable(); // atualiza a tabela após a edição
        } catch (error) {
            notyf.error(error.message);
        }
    });

    // ========== Modal de exclusão ==========
    document.getElementById("deleteUserModalClose").addEventListener("click", closeDeleteModal);

    document.getElementById("deleteUserCancel").addEventListener("click", closeDeleteModal);

    document.getElementById("deleteUserConfirm").addEventListener("click", async () => {
        try {
            if (!userToDelete) {
                notyf.error("Não foi encontrado nenhum id para excluir");
                return;
            }

            const response = await fetchWithAuth(`/entrevista-adesao/users/${userToDelete.id}`, {
                method: "DELETE"
            });

            if (!response.ok) {
                throw new Error(await getErrorMessage(response, "Houve um erroao tentar excluir o usuário"));
            }

            closeDeleteModal();
            notyf.success("Usuário deletado com sucesso");
            populateUsersTable(); // Atualiza a tabela após realiar a exclusão
        } catch (error) {
            notyf.error(error.message);
        }
    });

    // fecha os modais ao clicar fora do conteúdo ou pressionar Esc
    document.querySelectorAll(".modal-overlay").forEach(overlay => {
        overlay.addEventListener("click", (event) => {
            if (event.target !== overlay) return;

            overlay.hidden = true;
            syncBodyScrollLock();
        });
    });

    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape") {
            closeCreateModal();
            closeEditModal();
            closeDeleteModal();
        }
    });
});
