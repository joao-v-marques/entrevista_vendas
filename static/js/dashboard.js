import { fetchWithAuth } from "./utils/apiHelper.js";
import { formatDateToBR } from "./utils/dateUtils.js";

/* ============================================================
   Configuração base
   ============================================================ */

// paleta derivada dos tokens Unimed (global.css). Ordem escolhida para
// maximizar a separação entre categorias adjacentes; todo gráfico traz
// legenda/rótulo, então a identidade nunca depende só da cor.
const PALETTE = ["#3b82f6", "#f59e0b", "#22a04e", "#8b5cf6", "#14b8a6", "#ef4444", "#6b7280"];

// cores semânticas por status (espelham as pills de global.css)
const STATUS_HEX = {
  "Aguardando aprovação financeira": "#6b7280",
  "Aguardando Agendamento de Entrevista": "#3b82f6",
  "Aguardando Aprovação da Entrevista": "#8b5cf6",
  "Aguardando Aprovação da Gerência": "#f59e0b",
  "Aguardando Cadastro no Backoffice": "#14b8a6",
  "Finalizado": "#22a04e",
  "Reprovado Pelo Financeiro": "#ef4444",
  "Negociação Encerrada Financeiro": "#9ca3af",
  "Reprovado na Entrevista": "#dc2626",
  "Negociação Encerrada Entrevista": "#9ca3af",
  "Reprovado Pela Gerência": "#b91c1c",
  "Negociação Encerrada Gerência": "#9ca3af",
};

// categorização por status_id
const ACTIVE_IDS = [1, 2, 3, 4, 5];
const FINALIZED_ID = 6;

const INK = "#374151";        // gray-700
const MUTED = "#6b7280";      // gray-500
const GRID = "rgba(145,158,171,0.16)";

if (window.Chart) {
  Chart.defaults.font.family = "'DM Sans', sans-serif";
  Chart.defaults.font.size = 12;
  Chart.defaults.color = MUTED;
  Chart.defaults.plugins.tooltip.backgroundColor = "rgba(17,24,39,0.92)";
  Chart.defaults.plugins.tooltip.padding = 10;
  Chart.defaults.plugins.tooltip.cornerRadius = 8;
  Chart.defaults.plugins.tooltip.titleFont = { weight: "600" };
  Chart.defaults.plugins.tooltip.boxPadding = 4;
}

/* ============================================================
   Estado
   ============================================================ */

let allForms = [];
const charts = {}; // guarda instâncias Chart.js p/ destruir antes de recriar

/* ============================================================
   Helpers
   ============================================================ */

// created_at chega como "Mon, 21 Jul 2025 14:47:00 GMT" (padrão Flask)
function parseDate(value) {
  if (!value) return null;
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d;
}

// chave YYYY-MM-DD em UTC (evita shift de fuso, igual aos utils do projeto)
function dayKey(d) {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

function monthKey(d) {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function pct(part, total) {
  if (!total) return 0;
  return Math.round((part / total) * 100);
}

function initials(name) {
  if (!name) return "?";
  const parts = String(name).trim().split(/\s+/);
  const first = parts[0]?.[0] || "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase();
}

function statusColor(name) {
  return STATUS_HEX[name] || "#9ca3af";
}

// converte um <input type="date"> (YYYY-MM-DD, local) para limites UTC do dia
function inputToUTCStart(value) {
  if (!value) return null;
  const [y, m, d] = value.split("-").map(Number);
  return Date.UTC(y, m - 1, d, 0, 0, 0);
}
function inputToUTCEnd(value) {
  if (!value) return null;
  const [y, m, d] = value.split("-").map(Number);
  return Date.UTC(y, m - 1, d, 23, 59, 59, 999);
}

/* ============================================================
   Filtro de data
   ============================================================ */

function applyDateFilter() {
  const startVal = document.getElementById("filterStart").value;
  const endVal = document.getElementById("filterEnd").value;
  const startMs = inputToUTCStart(startVal);
  const endMs = inputToUTCEnd(endVal);

  return allForms.filter((f) => {
    const d = parseDate(f.created_at);
    if (!d) return false;
    const t = d.getTime();
    if (startMs !== null && t < startMs) return false;
    if (endMs !== null && t > endMs) return false;
    return true;
  });
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

/* ============================================================
   Renderização — KPIs
   ============================================================ */

function renderKpis(forms) {
  const total = forms.length;
  const done = forms.filter((f) => f.form_status_id === FINALIZED_ID).length;
  const active = forms.filter((f) => ACTIVE_IDS.includes(f.form_status_id)).length;
  const lost = total - done - active;
  const conv = pct(done, total);

  const set = (id, val) => {
    const el = document.getElementById(id);
    el.textContent = val;
    el.classList.remove("skeleton");
  };

  set("kpiTotal", total);
  set("kpiDone", done);
  set("kpiActive", active);
  set("kpiLost", lost);
  set("kpiConv", `${conv}%`);

  document.getElementById("kpiDoneFoot").innerHTML =
    `<span class="kpi-badge kpi-badge--green">${pct(done, total)}%</span> do total`;
  document.getElementById("kpiActiveFoot").innerHTML =
    `<span class="kpi-badge kpi-badge--amber">${pct(active, total)}%</span> aguardando etapa`;
  document.getElementById("kpiLostFoot").innerHTML =
    `<span class="kpi-badge kpi-badge--red">${pct(lost, total)}%</span> não convertidos`;
  document.getElementById("kpiConvFoot").textContent =
    `${done} de ${total} formulários`;
}

/* ============================================================
   Renderização — mini indicadores
   ============================================================ */

function renderMini(forms) {
  const total = forms.length;
  const port = forms.filter((f) => f.is_portability).length;
  const disc = forms.filter((f) => f.is_discount).length;
  const pa = forms.filter((f) => f.is_pa_digital).length;

  document.getElementById("miniPort").textContent = `${port} · ${pct(port, total)}%`;
  document.getElementById("miniDisc").textContent = `${disc} · ${pct(disc, total)}%`;
  document.getElementById("miniPa").textContent = `${pa} · ${pct(pa, total)}%`;
}

/* ============================================================
   Renderização — funil de conversão
   ============================================================ */

function renderFunnel(forms) {
  const inSet = (ids) => forms.filter((f) => ids.includes(f.form_status_id)).length;

  // aproximação por status atual: um form numa etapa avançada passou pelas anteriores
  const stages = [
    { label: "Formulários recebidos", count: forms.length },
    { label: "Aprovados no Financeiro", count: forms.filter((f) => ![1, 7, 8].includes(f.form_status_id)).length },
    { label: "Aprovados na Entrevista", count: inSet([4, 5, 6, 11, 12]) },
    { label: "Aprovados na Gerência", count: inSet([5, 6]) },
    { label: "Cadastro finalizado", count: inSet([6]) },
  ];

  const top = stages[0].count || 1;
  const container = document.getElementById("funnel");

  container.innerHTML = stages.map((s, i) => {
    const width = Math.max((s.count / top) * 100, s.count > 0 ? 2 : 0);
    const rate = pct(s.count, top);
    const prev = i > 0 ? stages[i - 1].count : null;
    const drop = prev !== null && prev > 0 ? prev - s.count : 0;
    const dropHtml = i > 0 && drop > 0
      ? `<span class="funnel-drop">− ${drop} (${pct(drop, prev)}%)</span>`
      : "";

    return `
      <div class="funnel-row">
        <div class="funnel-row-head">
          <span class="funnel-stage">${s.label}</span>
          <span class="funnel-meta"><strong>${s.count}</strong> · ${rate}%</span>
        </div>
        <div class="funnel-track">
          <div class="funnel-fill" style="width:${width}%"></div>
        </div>
        ${dropHtml}
      </div>
    `;
  }).join("");
}

/* ============================================================
   Renderização — gráficos (Chart.js)
   ============================================================ */

function destroyChart(key) {
  if (charts[key]) {
    charts[key].destroy();
    delete charts[key];
  }
}

// evolução temporal (área) — série única, forma para "mudança ao longo do tempo"
function renderTrend(forms) {
  destroyChart("trend");
  const dated = forms.map((f) => parseDate(f.created_at)).filter(Boolean).sort((a, b) => a - b);

  const descEl = document.getElementById("trendDesc");
  if (dated.length === 0) {
    descEl.textContent = "Sem dados no período selecionado";
    charts.trend = new Chart(document.getElementById("chartTrend"), {
      type: "line", data: { labels: [], datasets: [] }, options: baseLineOptions("dia"),
    });
    return;
  }

  const spanDays = (dated[dated.length - 1] - dated[0]) / 86400000;
  const byMonth = spanDays > 92;
  descEl.textContent = byMonth ? "Formulários criados por mês" : "Formulários criados por dia";

  const buckets = new Map();
  dated.forEach((d) => {
    const key = byMonth ? monthKey(d) : dayKey(d);
    buckets.set(key, (buckets.get(key) || 0) + 1);
  });

  // preenche lacunas entre o primeiro e o último bucket
  const keys = [];
  const cursor = new Date(Date.UTC(dated[0].getUTCFullYear(), dated[0].getUTCMonth(), byMonth ? 1 : dated[0].getUTCDate()));
  const last = dated[dated.length - 1];
  while (cursor <= last) {
    keys.push(byMonth ? monthKey(cursor) : dayKey(cursor));
    if (byMonth) cursor.setUTCMonth(cursor.getUTCMonth() + 1);
    else cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  const labels = keys.map((k) => {
    if (byMonth) {
      const [y, m] = k.split("-");
      return new Date(Date.UTC(Number(y), Number(m) - 1, 1)).toLocaleDateString("pt-BR", { month: "short", year: "2-digit", timeZone: "UTC" });
    }
    const [y, m, d] = k.split("-");
    return `${d}/${m}`;
  });
  const values = keys.map((k) => buckets.get(k) || 0);

  const ctx = document.getElementById("chartTrend").getContext("2d");
  const grad = ctx.createLinearGradient(0, 0, 0, 300);
  grad.addColorStop(0, "rgba(34,160,78,0.28)");
  grad.addColorStop(1, "rgba(34,160,78,0.01)");

  charts.trend = new Chart(ctx, {
    type: "line",
    data: {
      labels,
      datasets: [{
        label: "Formulários",
        data: values,
        borderColor: "#1a7a3c",
        backgroundColor: grad,
        borderWidth: 2,
        fill: true,
        tension: 0.32,
        pointRadius: values.length > 40 ? 0 : 3,
        pointHoverRadius: 5,
        pointBackgroundColor: "#1a7a3c",
      }],
    },
    options: baseLineOptions(byMonth ? "mês" : "dia"),
  });
}

function baseLineOptions() {
  return {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: "index", intersect: false },
    plugins: {
      legend: { display: false },
      tooltip: { callbacks: { label: (c) => ` ${c.parsed.y} formulário(s)` } },
    },
    scales: {
      x: { grid: { display: false }, ticks: { maxRotation: 0, autoSkip: true, maxTicksLimit: 12 } },
      y: { beginAtZero: true, grid: { color: GRID }, ticks: { precision: 0 }, border: { display: false } },
    },
  };
}

// distribuição por status (rosca) — paleta de status reservada + legenda
function renderStatus(forms) {
  destroyChart("status");
  const counts = new Map();
  forms.forEach((f) => {
    const name = f.form_status_name || "—";
    counts.set(name, (counts.get(name) || 0) + 1);
  });
  const entries = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  const labels = entries.map((e) => e[0]);
  const values = entries.map((e) => e[1]);
  const colors = labels.map(statusColor);
  const total = values.reduce((a, b) => a + b, 0);

  charts.status = new Chart(document.getElementById("chartStatus"), {
    type: "doughnut",
    data: { labels, datasets: [{ data: values, backgroundColor: colors, borderColor: "#fff", borderWidth: 2, hoverOffset: 6 }] },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: "62%",
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: (c) => ` ${c.label}: ${c.parsed} (${pct(c.parsed, total)}%)` } },
      },
    },
  });

  // legenda HTML customizada (com contagem)
  document.getElementById("statusLegend").innerHTML = entries.map(([name, val], i) =>
    `<span class="legend-item"><span class="legend-swatch" style="background:${colors[i]}"></span>${name} <strong>${val}</strong></span>`
  ).join("");
}

// volume por consultor (barras horizontais) — magnitude → hue única (verde)
function renderConsultants(forms) {
  destroyChart("consultants");
  const counts = new Map();
  forms.forEach((f) => {
    const name = f.consultant_name || "—";
    counts.set(name, (counts.get(name) || 0) + 1);
  });
  const entries = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);

  charts.consultants = new Chart(document.getElementById("chartConsultants"), {
    type: "bar",
    data: {
      labels: entries.map((e) => e[0]),
      datasets: [{
        label: "Formulários",
        data: entries.map((e) => e[1]),
        backgroundColor: "#22a04e",
        hoverBackgroundColor: "#1a7a3c",
        borderRadius: 5,
        borderSkipped: false,
        maxBarThickness: 26,
      }],
    },
    options: {
      indexAxis: "y",
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: (c) => ` ${c.parsed.x} formulário(s)` } },
      },
      scales: {
        x: { beginAtZero: true, grid: { color: GRID }, ticks: { precision: 0 }, border: { display: false } },
        y: { grid: { display: false } },
      },
    },
  });
}

// rosca genérica p/ categorias (planos)
function renderCategoryDoughnut(key, canvasId, forms, field) {
  destroyChart(key);
  const counts = new Map();
  forms.forEach((f) => {
    const v = f[field] || "Não informado";
    counts.set(v, (counts.get(v) || 0) + 1);
  });
  const entries = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  const labels = entries.map((e) => e[0]);
  const values = entries.map((e) => e[1]);
  const total = values.reduce((a, b) => a + b, 0);
  const colors = labels.map((_, i) => PALETTE[i % PALETTE.length]);

  charts[key] = new Chart(document.getElementById(canvasId), {
    type: "doughnut",
    data: { labels, datasets: [{ data: values, backgroundColor: colors, borderColor: "#fff", borderWidth: 2, hoverOffset: 6 }] },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: "58%",
      plugins: {
        legend: { position: "bottom", labels: { boxWidth: 10, boxHeight: 10, usePointStyle: true, pointStyle: "circle", padding: 14, color: MUTED } },
        tooltip: { callbacks: { label: (c) => ` ${c.label}: ${c.parsed} (${pct(c.parsed, total)}%)` } },
      },
    },
  });
}

// barras agrupadas: contrato + tipo de inclusão (duas categorias distintas)
function renderContract(forms) {
  destroyChart("contract");
  const contract = new Map();
  const inclusion = new Map();
  forms.forEach((f) => {
    const c = f.contract_type || "Não informado";
    const i = f.inclusion_type || "Não informado";
    contract.set(c, (contract.get(c) || 0) + 1);
    inclusion.set(i, (inclusion.get(i) || 0) + 1);
  });

  // combina os dois eixos categóricos em um único gráfico de barras verticais
  const items = [
    ...[...contract.entries()].map(([k, v]) => ["Contrato: " + k, v, "#3b82f6"]),
    ...[...inclusion.entries()].map(([k, v]) => ["Inclusão: " + k, v, "#f59e0b"]),
  ];

  charts.contract = new Chart(document.getElementById("chartContract"), {
    type: "bar",
    data: {
      labels: items.map((i) => i[0]),
      datasets: [{
        label: "Formulários",
        data: items.map((i) => i[1]),
        backgroundColor: items.map((i) => i[2]),
        borderRadius: 5,
        borderSkipped: false,
        maxBarThickness: 46,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: (c) => ` ${c.parsed.y} formulário(s)` } },
      },
      scales: {
        x: { grid: { display: false }, ticks: { autoSkip: false, maxRotation: 30, minRotation: 0, font: { size: 11 } } },
        y: { beginAtZero: true, grid: { color: GRID }, ticks: { precision: 0 }, border: { display: false } },
      },
    },
  });
}

/* ============================================================
   Renderização — tabelas
   ============================================================ */

function renderRanking(forms) {
  const map = new Map();
  forms.forEach((f) => {
    const name = f.consultant_name || "—";
    if (!map.has(name)) map.set(name, { total: 0, done: 0, active: 0 });
    const r = map.get(name);
    r.total++;
    if (f.form_status_id === FINALIZED_ID) r.done++;
    else if (ACTIVE_IDS.includes(f.form_status_id)) r.active++;
  });

  const rows = [...map.entries()].sort((a, b) => b[1].total - a[1].total);
  const maxTotal = rows.length ? rows[0][1].total : 1;
  const tbody = document.getElementById("rankBody");

  if (rows.length === 0) {
    tbody.innerHTML = `<tr class="table-empty-row"><td colspan="5">Nenhum formulário no período.</td></tr>`;
    return;
  }

  tbody.innerHTML = rows.map(([name, r]) => {
    const conv = pct(r.done, r.total);
    const convClass = conv >= 60 ? "text-green" : conv >= 30 ? "text-amber" : "text-red";
    return `
      <tr>
        <td>
          <div class="rank-name">
            <span class="rank-avatar">${initials(name)}</span>
            <span>${name}</span>
          </div>
          <div class="rank-bar rank-bar-cell"><div class="rank-bar-fill" style="width:${(r.total / maxTotal) * 100}%"></div></div>
        </td>
        <td class="num-cell">${r.total}</td>
        <td class="num-cell">${r.done}</td>
        <td class="num-cell">${r.active}</td>
        <td><span class="conv-tag ${convClass}">${conv}%</span></td>
      </tr>
    `;
  }).join("");
}

function renderRecent(forms) {
  const rows = [...forms]
    .sort((a, b) => (parseDate(b.created_at) || 0) - (parseDate(a.created_at) || 0))
    .slice(0, 8);
  const tbody = document.getElementById("recentBody");

  if (rows.length === 0) {
    tbody.innerHTML = `<tr class="table-empty-row"><td colspan="3">Nenhum formulário no período.</td></tr>`;
    return;
  }

  tbody.innerHTML = rows.map((f) => {
    const color = statusColor(f.form_status_name);
    return `
      <tr>
        <td>
          <div class="td-name">${f.beneficiary_name || "—"}</div>
          <div class="td-cpf">${f.consultant_name || ""}</div>
        </td>
        <td>${formatDateToBR(f.created_at)}</td>
        <td><span class="legend-item"><span class="legend-swatch" style="background:${color}"></span>${f.form_status_name || "—"}</span></td>
      </tr>
    `;
  }).join("");
}

/* ============================================================
   Orquestração
   ============================================================ */

function renderAll() {
  const forms = applyDateFilter();
  renderKpis(forms);
  renderMini(forms);
  renderFunnel(forms);
  renderTrend(forms);
  renderStatus(forms);
  renderConsultants(forms);
  renderCategoryDoughnut("plans", "chartPlans", forms, "plan_type");
  renderContract(forms);
  renderRanking(forms);
  renderRecent(forms);

  const now = new Date();
  document.getElementById("dashUpdated").textContent =
    `Atualizado às ${now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
}

async function loadData() {
  try {
    const response = await fetchWithAuth("/entrevista-adesao/application-forms");
    if (!response.ok) {
      const err = await response.json().catch(() => null);
      throw new Error(err?.message || "Erro ao carregar os dados do painel");
    }
    allForms = await response.json();
    renderAll();
  } catch (error) {
    console.error(error);
    if (window.notyf) notyf.error(error.message || "Erro ao carregar o painel");
  }
}

/* ============================================================
   Eventos
   ============================================================ */

function setupFilters() {
  const presets = document.getElementById("filterPresets");
  const startEl = document.getElementById("filterStart");
  const endEl = document.getElementById("filterEnd");

  presets.addEventListener("click", (e) => {
    const btn = e.target.closest(".preset-btn");
    if (!btn) return;
    presets.querySelectorAll(".preset-btn").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    setPreset(btn.dataset.preset);
    renderAll();
  });

  document.getElementById("filterApply").addEventListener("click", () => {
    presets.querySelectorAll(".preset-btn").forEach((b) => b.classList.remove("active"));
    renderAll();
  });

  // Enter em qualquer input de data aplica o filtro
  [startEl, endEl].forEach((el) => {
    el.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        presets.querySelectorAll(".preset-btn").forEach((b) => b.classList.remove("active"));
        renderAll();
      }
    });
  });
}

document.addEventListener("DOMContentLoaded", () => {
  if (!window.Chart) {
    console.error("Chart.js não carregou");
  }
  setupFilters();
  loadData();
});
