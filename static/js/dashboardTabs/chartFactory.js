// Camada compartilhada de Chart.js do dashboard.
//
// Antes cada gráfico repetia o seu bloco de options inteiro dentro de dashboard.js e
// guardava a instância num objeto solto. Aqui o registry é único e as options viram
// fábricas, para que as cinco abas tenham o mesmo eixo, o mesmo tooltip e a mesma grade.
//
// Chart.js 4.4.1 (UMD) já vem do CDN no template, antes deste módulo.

/* ============================================================
   Cores
   ============================================================ */

// paleta derivada dos tokens Unimed (global.css). Ordem escolhida para maximizar a
// separação entre categorias adjacentes; todo gráfico traz legenda ou rótulo, então a
// identidade nunca depende só da cor.
export const PALETTE = ["#3b82f6", "#f59e0b", "#22a04e", "#8b5cf6", "#14b8a6", "#ef4444", "#6b7280"];

// cores semânticas por status, indexadas pelo ID e não pelo nome: o mapa antigo era
// keyed por string e "Reprovado Pela Gerência" (P maiúsculo) nunca batia com o valor do
// banco, "Reprovado pela Gerência" — aquele status caía sempre no cinza de fallback.
export const STATUS_HEX = {
    1: "#6b7280",
    2: "#3b82f6",
    3: "#8b5cf6",
    4: "#f59e0b",
    5: "#14b8a6",
    6: "#22a04e",
    7: "#ef4444",
    8: "#9ca3af",
    9: "#dc2626",
    10: "#9ca3af",
    11: "#b91c1c",
    12: "#9ca3af",
};

export const GREEN = "#1a7a3c";
export const MUTED = "#6b7280";
export const GRID = "rgba(145,158,171,0.16)";

export function statusColor(statusId) {
    return STATUS_HEX[statusId] || "#9ca3af";
}

export function colorAt(index) {
    return PALETTE[index % PALETTE.length];
}

/* ============================================================
   Defaults globais
   ============================================================ */

if (window.Chart) {
    Chart.defaults.font.family = "'DM Sans', sans-serif";
    Chart.defaults.font.size = 11;
    Chart.defaults.color = MUTED;
    Chart.defaults.plugins.tooltip.backgroundColor = "rgba(17,24,39,0.92)";
    Chart.defaults.plugins.tooltip.padding = 10;
    Chart.defaults.plugins.tooltip.cornerRadius = 8;
    Chart.defaults.plugins.tooltip.titleFont = { weight: "600" };
    Chart.defaults.plugins.tooltip.boxPadding = 4;
}

/* ============================================================
   Registry
   ============================================================ */

// chave "aba:grafico" — o prefixo é o que permite redimensionar só os gráficos
// da aba que acabou de ser exibida
const charts = new Map();

export function destroyChart(key) {
    const chart = charts.get(key);
    if (chart) {
        chart.destroy();
        charts.delete(key);
    }
}

export function makeChart(key, canvas, config) {
    destroyChart(key);
    if (!canvas || !window.Chart) return null;

    const chart = new Chart(canvas, config);
    charts.set(key, chart);
    return chart;
}

// Um canvas construído dentro de painel com [hidden] nasce com tamanho zero e fica
// achatado quando o painel aparece. Chamar resize ao exibir a aba conserta isso.
export function resizeTab(tabName) {
    charts.forEach((chart, key) => {
        if (key.startsWith(`${tabName}:`)) chart.resize();
    });
}

/* ============================================================
   Fábricas de options
   ============================================================ */

const noLegend = { legend: { display: false } };

// os valores do tooltip eram interpolados crus: saíam com ponto decimal ("39.13%")
// e com todas as casas que a divisão produzisse
const localized = (value) =>
    Number(value).toLocaleString("pt-BR", { maximumFractionDigits: 2 });

export function lineOptions({ suffix = "", stacked = false } = {}) {
    return {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: "index", intersect: false },
        plugins: {
            ...noLegend,
            tooltip: { callbacks: { label: (ctx) => ` ${ctx.dataset.label || ""}: ${localized(ctx.parsed.y)}${suffix}` } },
        },
        scales: {
            x: { stacked, grid: { display: false }, ticks: { maxRotation: 0, autoSkip: true, maxTicksLimit: 12 } },
            y: { stacked, beginAtZero: true, grid: { color: GRID }, ticks: { precision: 0 }, border: { display: false } },
        },
    };
}

export function barOptions({ horizontal = false, suffix = "", stacked = false, legend = false } = {}) {
    const valueAxis = {
        stacked,
        beginAtZero: true,
        grid: { color: GRID },
        ticks: { precision: 0 },
        border: { display: false },
    };
    const categoryAxis = {
        stacked,
        grid: { display: false },
        ticks: { autoSkip: false, maxRotation: horizontal ? 0 : 30 },
    };

    return {
        responsive: true,
        maintainAspectRatio: false,
        indexAxis: horizontal ? "y" : "x",
        plugins: {
            legend: legend
                ? { position: "bottom", labels: { usePointStyle: true, pointStyle: "circle", boxWidth: 7, padding: 12 } }
                : { display: false },
            tooltip: {
                callbacks: {
                    label: (ctx) => ` ${ctx.dataset.label || ctx.label}: ${localized(horizontal ? ctx.parsed.x : ctx.parsed.y)}${suffix}`,
                },
            },
        },
        scales: horizontal
            ? { x: valueAxis, y: categoryAxis }
            : { x: categoryAxis, y: valueAxis },
    };
}

export function doughnutOptions({ legend = true, cutout = "60%" } = {}) {
    return {
        responsive: true,
        maintainAspectRatio: false,
        cutout,
        plugins: {
            legend: legend
                ? { position: "bottom", labels: { usePointStyle: true, pointStyle: "circle", boxWidth: 7, padding: 10 } }
                : { display: false },
            tooltip: {
                callbacks: {
                    label: (ctx) => {
                        const total = ctx.dataset.data.reduce((sum, value) => sum + value, 0);
                        const share = total ? Math.round((ctx.parsed / total) * 10000) / 100 : 0;
                        return ` ${ctx.label}: ${ctx.parsed} (${localized(share)}%)`;
                    },
                },
            },
        },
    };
}

/* ============================================================
   Auxiliares de desenho
   ============================================================ */

// gradiente da área da linha do tempo. A altura vem do canvas em vez de um literal:
// o valor antigo (300) estava casado na unha com o min-height do CSS e quebrava
// silenciosamente sempre que a altura do card mudava.
export function areaGradient(context, hex = "34,160,78") {
    const height = context.canvas.clientHeight || 220;
    const gradient = context.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, `rgba(${hex},0.26)`);
    gradient.addColorStop(1, `rgba(${hex},0.01)`);
    return gradient;
}

export const BAR_STYLE = { borderRadius: 4, borderSkipped: false, maxBarThickness: 26 };
