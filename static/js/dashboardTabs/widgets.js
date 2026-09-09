// Construtores de markup compartilhados pelas abas do dashboard.
//
// Cada aba monta o próprio esqueleto em init() e só preenche valores em render().
// Sem isto, os cinco módulos repetiriam a mesma estrutura de card, tabela e KPI —
// era exatamente o que deixava o dashboard antigo difícil de mexer.

import { escapeHtml } from "../utils/detailsView.js";

/* ============================================================
   Blocos
   ============================================================ */

// título de um agrupamento dentro da aba (ex.: "Operação" x "Perfil de saúde")
export function blockTitle(text) {
    return `<h2 class="dash-block-title">${escapeHtml(text)}</h2>`;
}

export function grid(inner) {
    return `<div class="charts-grid">${inner}</div>`;
}

/* ============================================================
   KPI
   ============================================================ */

// accent: total | done | active | lost | conv | neutral (define a barra lateral colorida)
export function kpiCard({ id, label, foot = "", accent = "total" }) {
    return `
        <div class="kpi-card kpi-card--${accent}">
            <div class="kpi-top">
                <span class="kpi-label">${escapeHtml(label)}</span>
            </div>
            <div class="kpi-value" id="${id}">—</div>
            <div class="kpi-foot" id="${id}Foot">${escapeHtml(foot)}</div>
        </div>
    `;
}

export function kpiGrid(cards) {
    return `<div class="kpi-grid">${cards.join("")}</div>`;
}

/* ============================================================
   Cards de gráfico
   ============================================================ */

export function chartCard({ id, title, desc = "", span = 6, tall = false, legend = false }) {
    return `
        <div class="chart-card chart-card--span${span}">
            <div class="chart-head">
                <div>
                    <div class="chart-title">${escapeHtml(title)}</div>
                    <div class="chart-desc" id="${id}Desc">${escapeHtml(desc)}</div>
                </div>
            </div>
            <div class="chart-canvas-wrap${tall ? " chart-canvas-wrap--tall" : ""}">
                <canvas id="${id}"></canvas>
                <div class="chart-empty" id="${id}Empty" hidden>Sem dados no período</div>
            </div>
            ${legend ? `<div class="chart-legend" id="${id}Legend"></div>` : ""}
        </div>
    `;
}

// card sem canvas, para conteúdo montado em HTML (funil, listas de barras, tiles)
export function contentCard({ id, title, desc = "", span = 6 }) {
    return `
        <div class="chart-card chart-card--span${span}">
            <div class="chart-head">
                <div>
                    <div class="chart-title">${escapeHtml(title)}</div>
                    <div class="chart-desc" id="${id}Desc">${escapeHtml(desc)}</div>
                </div>
            </div>
            <div class="card-body" id="${id}"></div>
        </div>
    `;
}

export function tableCard({ id, title, desc = "", span = 6, columns = [], link = null }) {
    const head = columns
        .map((column) => `<th${column.numeric ? ' class="num-cell"' : ""}>${escapeHtml(column.label)}</th>`)
        .join("");

    return `
        <div class="chart-card chart-card--span${span}">
            <div class="chart-head">
                <div>
                    <div class="chart-title">${escapeHtml(title)}</div>
                    <div class="chart-desc">${escapeHtml(desc)}</div>
                </div>
                ${link ? `<a href="${link.href}" class="table-card-link">${escapeHtml(link.label)}</a>` : ""}
            </div>
            <div class="table-wrapper">
                <table>
                    <thead><tr>${head}</tr></thead>
                    <tbody id="${id}">
                        <tr class="table-empty-row"><td colspan="${columns.length}">Carregando...</td></tr>
                    </tbody>
                </table>
            </div>
        </div>
    `;
}

/* ============================================================
   Preenchimento
   ============================================================ */

export function setText(panel, id, value) {
    const element = panel.querySelector(`#${id}`);
    if (element) element.textContent = value;
}

// mostra a mensagem de vazio por cima do canvas em vez de deixar um gráfico oco
export function setChartEmpty(panel, canvasId, isEmpty) {
    const canvas = panel.querySelector(`#${canvasId}`);
    const empty = panel.querySelector(`#${canvasId}Empty`);
    if (canvas) canvas.hidden = isEmpty;
    if (empty) empty.hidden = !isEmpty;
    return isEmpty;
}

export function fillTable(panel, tbodyId, rowsHtml, colspan, emptyMessage = "Nenhum registro no período.") {
    const tbody = panel.querySelector(`#${tbodyId}`);
    if (!tbody) return;

    tbody.innerHTML = rowsHtml.length
        ? rowsHtml.join("")
        : `<tr class="table-empty-row"><td colspan="${colspan}">${escapeHtml(emptyMessage)}</td></tr>`;
}

// legenda em HTML das roscas de status (a nativa do Chart.js não cabe no card denso)
export function renderLegend(panel, id, items) {
    const element = panel.querySelector(`#${id}`);
    if (!element) return;

    element.innerHTML = items.map((item) => `
        <span class="legend-item">
            <span class="legend-swatch" style="background:${item.color}"></span>
            ${escapeHtml(item.label)} <strong>${item.value}</strong>
        </span>
    `).join("");
}

// lista de barras horizontais em HTML pura — usada onde há muitas categorias
// (os 27 grupos da declaração de saúde, por exemplo), em que um gráfico ficaria ilegível
export function renderBarList(panel, id, items, { suffix = "", emptyMessage = "Sem dados no período." } = {}) {
    const element = panel.querySelector(`#${id}`);
    if (!element) return;

    if (!items.length) {
        element.innerHTML = `<p class="dash-empty">${escapeHtml(emptyMessage)}</p>`;
        return;
    }

    const max = Math.max(...items.map((item) => item.value)) || 1;

    element.innerHTML = `<div class="bar-list">${items.map((item) => `
        <div class="bar-row">
            <span class="bar-label" title="${escapeHtml(item.label)}">${escapeHtml(item.label)}</span>
            <span class="bar-track">
                <span class="bar-fill" style="width:${(item.value / max) * 100}%;${item.color ? `background:${item.color}` : ""}"></span>
            </span>
            <span class="bar-value">${item.value}${suffix}</span>
        </div>
    `).join("")}</div>`;
}

// tiles compactos de número solto (com portabilidade, via PA Digital, etc.)
export function renderTiles(panel, id, items) {
    const element = panel.querySelector(`#${id}`);
    if (!element) return;

    element.innerHTML = `<div class="mini-grid">${items.map((item) => `
        <div class="mini-tile">
            <div class="mini-body">
                <span class="mini-value">${escapeHtml(String(item.value))}</span>
                <span class="mini-label">${escapeHtml(item.label)}</span>
            </div>
        </div>
    `).join("")}</div>`;
}

export function renderMessage(panel, id, message) {
    const element = panel.querySelector(`#${id}`);
    if (element) element.innerHTML = `<p class="dash-empty">${escapeHtml(message)}</p>`;
}
