// Shell do dashboard: filtro de período, troca de abas e boot.
//
// Nenhuma métrica é calculada aqui — cada aba mora em dashboardTabs/ e expõe
// init(panel) + render(panel, period). O padrão de registro é o mesmo de configs.js,
// com uma diferença obrigatória: lá todas as seções são inicializadas de uma vez, e
// aqui isso quebraria os gráficos — um <canvas> criado dentro de painel com [hidden]
// nasce com tamanho zero. Por isso a aba só se inicializa quando é exibida.

import { inputToUTCStart, inputToUTCEnd } from "./dashboardTabs/aggregations.js";
import { resizeTab } from "./dashboardTabs/chartFactory.js";
import { clearCache } from "./dashboardTabs/dashboardData.js";

import * as overviewTab from "./dashboardTabs/overviewTab.js";
import * as salesTab from "./dashboardTabs/salesTab.js";
import * as pipelineTab from "./dashboardTabs/pipelineTab.js";
import * as interviewsTab from "./dashboardTabs/interviewsTab.js";
import * as teamTab from "./dashboardTabs/teamTab.js";

// a chave é o data-tab, usado tanto no botão quanto no painel correspondente
const TAB_MODULES = {
    "visao-geral": overviewTab,
    "vendas": salesTab,
    "pipeline": pipelineTab,
    "entrevistas": interviewsTab,
    "colaboradores": teamTab,
};

const initialized = new Set();
const renderQueues = new Map(); // data-tab -> Promise (serializa renders da mesma aba)

let activeTab = null;

/* ============================================================
   Filtro de período
   ============================================================ */

function getPeriod() {
    return {
        startMs: inputToUTCStart(document.getElementById("filterStart").value),
        endMs: inputToUTCEnd(document.getElementById("filterEnd").value),
    };
}

function setPreset(preset) {
    const startEl = document.getElementById("filterStart");
    const endEl = document.getElementById("filterEnd");
    const now = new Date();
    const todayIso = now.toISOString().slice(0, 10);

    if (preset === "all") {
        startEl.value = "";
        endEl.value = "";
    } else if (preset === "year") {
        startEl.value = `${now.getFullYear()}-01-01`;
        endEl.value = todayIso;
    } else {
        const days = Number(preset);
        const start = new Date(now.getTime() - (days - 1) * 86400000);
        startEl.value = start.toISOString().slice(0, 10);
        endEl.value = todayIso;
    }
}

function clearPresetHighlight() {
    document.querySelectorAll("#filterPresets .preset-btn").forEach((button) => {
        button.classList.remove("active");
    });
}

/* ============================================================
   Abas
   ============================================================ */

function panelOf(name) {
    return document.querySelector(`.dash-panel[data-tab="${name}"]`);
}

// Encadeia os renders de uma mesma aba: se o período mudar enquanto o primeiro
// fetch ainda está no ar, o segundo render espera o primeiro e pinta por último —
// sem isso a resposta mais lenta poderia sobrescrever o filtro mais recente.
function renderTab(name) {
    const module = TAB_MODULES[name];
    const panel = panelOf(name);
    if (!module || !panel) return Promise.resolve();

    const previous = renderQueues.get(name) || Promise.resolve();
    const next = previous
        .then(() => module.render(panel, getPeriod()))
        .catch((error) => {
            console.error(`Erro ao renderizar a aba "${name}"`, error);
        });

    renderQueues.set(name, next);
    return next;
}

async function showTab(name) {
    if (!TAB_MODULES[name]) name = "visao-geral";
    activeTab = name;

    document.querySelectorAll(".dash-tab[data-tab]").forEach((button) => {
        const isActive = button.dataset.tab === name;
        button.classList.toggle("is-active", isActive);
        button.setAttribute("aria-selected", isActive ? "true" : "false");
        button.tabIndex = isActive ? 0 : -1;
    });

    document.querySelectorAll(".dash-panel[data-tab]").forEach((panel) => {
        panel.hidden = panel.dataset.tab !== name;
    });

    if (window.location.hash.slice(1) !== name) {
        history.replaceState(null, "", `#${name}`);
    }

    const panel = panelOf(name);

    if (!initialized.has(name)) {
        TAB_MODULES[name].init(panel);
        initialized.add(name);
    }

    await renderTab(name);

    // o painel acabou de sair do [hidden]: os canvas só agora têm largura real
    resizeTab(name);
}

function renderActiveTab() {
    if (activeTab) renderTab(activeTab).then(() => resizeTab(activeTab));
}

function stampUpdatedAt() {
    const now = new Date();
    document.getElementById("dashUpdated").textContent =
        `Atualizado às ${now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
}

/* ============================================================
   Eventos
   ============================================================ */

function setupFilters() {
    const presets = document.getElementById("filterPresets");
    const startEl = document.getElementById("filterStart");
    const endEl = document.getElementById("filterEnd");

    presets.addEventListener("click", (event) => {
        const button = event.target.closest(".preset-btn");
        if (!button) return;

        clearPresetHighlight();
        button.classList.add("active");
        setPreset(button.dataset.preset);
        renderActiveTab();
    });

    document.getElementById("filterApply").addEventListener("click", () => {
        clearPresetHighlight();
        renderActiveTab();
    });

    [startEl, endEl].forEach((element) => {
        element.addEventListener("keydown", (event) => {
            if (event.key !== "Enter") return;
            clearPresetHighlight();
            renderActiveTab();
        });
    });

    document.getElementById("dashRefresh").addEventListener("click", () => {
        clearCache();
        stampUpdatedAt();
        renderActiveTab();
    });
}

function setupTabs() {
    const tablist = document.getElementById("dashTabs");

    tablist.addEventListener("click", (event) => {
        const button = event.target.closest(".dash-tab[data-tab]");
        if (button) showTab(button.dataset.tab);
    });

    // navegação por teclado esperada de um tablist
    tablist.addEventListener("keydown", (event) => {
        if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;

        const buttons = [...tablist.querySelectorAll(".dash-tab[data-tab]")];
        const current = buttons.findIndex((button) => button.dataset.tab === activeTab);
        const step = event.key === "ArrowRight" ? 1 : -1;
        const next = buttons[(current + step + buttons.length) % buttons.length];

        next.focus();
        showTab(next.dataset.tab);
    });

    window.addEventListener("hashchange", () => {
        const name = window.location.hash.slice(1);
        if (name && name !== activeTab) showTab(name);
    });
}

document.addEventListener("DOMContentLoaded", () => {
    if (!window.Chart) console.error("Chart.js não carregou");

    setupFilters();
    setupTabs();
    stampUpdatedAt();

    showTab(window.location.hash.slice(1) || "visao-geral");
});
