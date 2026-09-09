// Camada de dados do dashboard.
//
// O painel antigo vivia de uma única chamada a /application-forms, então só conseguia
// contar formulários por coluna. Aqui cada recurso da API vira um loader próprio, e as
// abas pedem só o que precisam — quem nunca é aberta não dispara requisição nenhuma.
//
// O cache guarda a *Promise*, não o resultado: se duas abas pedirem o mesmo recurso
// ao mesmo tempo (acontece ao trocar de aba antes da primeira terminar), sai um fetch só.

import { fetchWithAuth } from "../utils/apiHelper.js";

const API = "/entrevista-adesao";

const cache = new Map(); // path -> Promise<array>

async function fetchList(path, label) {
    const response = await fetchWithAuth(`${API}${path}`);

    if (!response.ok) {
        const error = await response.json().catch(() => null);
        throw new Error(error?.message || `Erro ao carregar ${label}`);
    }

    const data = await response.json();
    return Array.isArray(data) ? data : [];
}

function loadOnce(path, label) {
    if (!cache.has(path)) {
        const promise = fetchList(path, label).catch((error) => {
            console.error(error);
            if (window.notyf) notyf.error(error.message || `Erro ao carregar ${label}`);

            // solta o cache para que reabrir a aba tente de novo, em vez de
            // servir para sempre a lista vazia de uma falha momentânea
            cache.delete(path);
            return [];
        });

        cache.set(path, promise);
    }

    return cache.get(path);
}

export const loadForms = () => loadOnce("/application-forms", "os formulários");
export const loadApprovals = () => loadOnce("/application_form_approval", "as aprovações financeiras");
export const loadInterviews = () => loadOnce("/application-form-interviews", "as entrevistas");
export const loadCompletedInterviews = () => loadOnce("/application-form-interviews/completed", "as entrevistas realizadas");
export const loadManagement = () => loadOnce("/application_form_management", "as aprovações da gerência");
export const loadQualifyInterviews = () => loadOnce("/qualify-interviews", "as declarações de saúde");
export const loadUsers = () => loadOnce("/users", "os usuários");
export const loadRoles = () => loadOnce("/roles", "os cargos");
export const loadSectors = () => loadOnce("/sectors", "os setores");
export const loadDocuments = () => loadOnce("/application-form-documents", "os documentos");

// usado pelo botão de recarregar do cabeçalho
export function clearCache() {
    cache.clear();
}

// último registro por formulário. Aprovação, entrevista e gerência ganham uma linha nova
// a cada reanálise, então indexar "o que vale hoje" tem que ser pela data mais recente —
// pegar a primeira linha encontrada devolveria a decisão antiga.
export function indexByLatest(list, dateField, key = "application_form_id") {
    const map = new Map();

    (list || []).forEach((item) => {
        const id = item?.[key];
        if (id === undefined || id === null) return;

        const current = map.get(id);
        if (!current) {
            map.set(id, item);
            return;
        }

        const currentTime = new Date(current[dateField] || 0).getTime() || 0;
        const itemTime = new Date(item[dateField] || 0).getTime() || 0;
        if (itemTime >= currentTime) map.set(id, item);
    });

    return map;
}

// todas as linhas de cada formulário (ex.: documentos, que são muitos por ficha)
export function groupByForm(list, key = "application_form_id") {
    const map = new Map();

    (list || []).forEach((item) => {
        const id = item?.[key];
        if (id === undefined || id === null) return;

        if (!map.has(id)) map.set(id, []);
        map.get(id).push(item);
    });

    return map;
}
