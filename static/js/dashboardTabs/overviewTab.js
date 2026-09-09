// Aba 1 — Visão Geral.
// Responde "como estamos?" em poucos segundos: números do período, o que exige ação
// hoje, o funil e a evolução. O detalhe fica nas outras abas.

import { escapeHtml } from "../utils/detailsView.js";
import { loadForms, loadInterviews } from "./dashboardData.js";
import {
    FINALIZED_ID, isActive, isFinalized, isRejected, isClosed,
    parseDate, bucketDates, keyOfDate, filterByPeriod,
    percentOf, countBy, sortedEntries, ageInDays, formatDays,
} from "./aggregations.js";
import { makeChart, barOptions, doughnutOptions, statusColor, BAR_STYLE, GREEN } from "./chartFactory.js";
import {
    blockTitle, grid, kpiCard, kpiGrid, chartCard, contentCard,
    setText, setChartEmpty, renderLegend, renderTiles,
} from "./widgets.js";

const TAB = "visao-geral";

export function init(panel) {
    panel.innerHTML = `
        ${kpiGrid([
            kpiCard({ id: "ovTotal", label: "Total de formulários", foot: "no período selecionado", accent: "total" }),
            kpiCard({ id: "ovDone", label: "Finalizados", foot: "adesões concluídas", accent: "done" }),
            kpiCard({ id: "ovActive", label: "Em andamento", foot: "no pipeline", accent: "active" }),
            kpiCard({ id: "ovRejected", label: "Reprovados", foot: "aguardando reanálise ou encerramento", accent: "lost" }),
            kpiCard({ id: "ovClosed", label: "Encerrados", foot: "negociação encerrada", accent: "neutral" }),
            kpiCard({ id: "ovConv", label: "Taxa de conversão", foot: "finalizados / total", accent: "conv" }),
        ])}

        ${blockTitle("Precisa de atenção agora")}
        ${grid(contentCard({
            id: "ovAlerts",
            title: "Situação atual",
            desc: "Fotografia de hoje — não acompanha o filtro de período",
            span: 12,
        }))}

        ${blockTitle("Evolução e distribuição")}
        ${grid(`
            ${chartCard({ id: "ovTrend", title: "Evolução de formulários", desc: "Criados no período, por desfecho atual", span: 8, tall: true })}
            ${chartCard({ id: "ovStatus", title: "Distribuição por status", desc: "Onde estão os formulários do período", span: 4, tall: true, legend: true })}
        `)}

        ${grid(`
            ${contentCard({ id: "ovFunnel", title: "Funil de conversão", desc: "Avanço pelas etapas de aprovação", span: 6 })}
            ${chartCard({ id: "ovConsultants", title: "Top consultores", desc: "Volume de formulários no período", span: 6 })}
        `)}
    `;
}

export async function render(panel, period) {
    const [allForms, allInterviews] = await Promise.all([loadForms(), loadInterviews()]);
    const forms = filterByPeriod(allForms, "created_at", period);

    renderKpis(panel, forms);
    renderAlerts(panel, allForms, allInterviews);
    renderTrend(panel, forms);
    renderStatus(panel, forms);
    renderFunnel(panel, forms);
    renderConsultants(panel, forms);
}

/* ============================================================
   KPIs
   ============================================================ */

function renderKpis(panel, forms) {
    const total = forms.length;
    const done = forms.filter(isFinalized).length;
    const active = forms.filter(isActive).length;
    const rejected = forms.filter(isRejected).length;
    const closed = forms.filter(isClosed).length;

    setText(panel, "ovTotal", total);
    setText(panel, "ovDone", done);
    setText(panel, "ovActive", active);
    setText(panel, "ovRejected", rejected);
    setText(panel, "ovClosed", closed);
    setText(panel, "ovConv", percentOf(done, total));
}

/* ============================================================
   Alertas — estado de hoje, deliberadamente fora do filtro de período
   ============================================================ */

function renderAlerts(panel, allForms, allInterviews) {
    const now = new Date();
    const todayKey = now.toISOString().slice(0, 10);
    const weekAhead = now.getTime() + 7 * 86400000;

    const scheduled = allInterviews.filter((interview) => parseDate(interview.interview_date));

    const today = scheduled.filter((interview) => {
        const date = parseDate(interview.interview_date);
        return date && date.toISOString().slice(0, 10) === todayKey;
    }).length;

    const nextWeek = scheduled.filter((interview) => {
        const date = parseDate(interview.interview_date);
        if (!date) return false;
        const time = date.getTime();
        return time >= now.getTime() && time <= weekAhead;
    }).length;

    const countStatus = (id) => allForms.filter((form) => form.form_status_id === id).length;

    // o formulário ativo mais antigo. "há X dias no sistema" e não "parado há X dias":
    // sem histórico de status, só existe a data de criação — não dá para saber quanto
    // tempo ele passou em cada etapa
    const activeForms = allForms.filter(isActive);
    const oldest = activeForms.reduce((worst, form) => {
        const age = ageInDays(form.created_at);
        return age !== null && (worst === null || age > worst) ? age : worst;
    }, null);

    renderTiles(panel, "ovAlerts", [
        { label: "Entrevistas hoje", value: today },
        { label: "Entrevistas nos próximos 7 dias", value: nextWeek },
        { label: "Aguardando aprovação financeira", value: countStatus(1) },
        { label: "Aguardando agendamento", value: countStatus(2) },
        { label: "Fila do backoffice", value: countStatus(5) },
        { label: "Ativo mais antigo (no sistema)", value: formatDays(oldest) },
    ]);
}

/* ============================================================
   Evolução — coorte por data de criação
   ============================================================ */

// Não existe "finalizados por dia": sem histórico de status, a única data confiável é
// created_at. Então a barra empilhada mostra a coorte criada em cada período e em que
// situação ela está hoje — o que é uma leitura honesta do mesmo dado.
function renderTrend(panel, forms) {
    const dated = forms.filter((form) => parseDate(form.created_at));
    const dates = dated.map((form) => parseDate(form.created_at));
    const canvas = panel.querySelector("#ovTrend");

    if (setChartEmpty(panel, "ovTrend", dated.length === 0)) {
        setText(panel, "ovTrendDesc", "Sem dados no período selecionado");
        return;
    }

    const { keys, labels, byMonth } = bucketDates(dates);
    setText(panel, "ovTrendDesc", byMonth
        ? "Criados por mês, pelo desfecho atual da coorte"
        : "Criados por dia, pelo desfecho atual da coorte");

    const buckets = new Map(keys.map((key) => [key, { active: 0, done: 0, lost: 0 }]));

    dated.forEach((form) => {
        const key = keyOfDate(parseDate(form.created_at), byMonth);
        const bucket = buckets.get(key);
        if (!bucket) return;

        if (isFinalized(form)) bucket.done++;
        else if (isActive(form)) bucket.active++;
        else bucket.lost++;
    });

    const series = (field) => keys.map((key) => buckets.get(key)[field]);

    makeChart(`${TAB}:trend`, canvas, {
        type: "bar",
        data: {
            labels,
            datasets: [
                { label: "Em andamento", data: series("active"), backgroundColor: "#f59e0b", ...BAR_STYLE },
                { label: "Finalizados", data: series("done"), backgroundColor: "#22a04e", ...BAR_STYLE },
                { label: "Reprov./encerrados", data: series("lost"), backgroundColor: "#ef4444", ...BAR_STYLE },
            ],
        },
        options: barOptions({ stacked: true, legend: true }),
    });
}

/* ============================================================
   Status
   ============================================================ */

function renderStatus(panel, forms) {
    const canvas = panel.querySelector("#ovStatus");

    if (setChartEmpty(panel, "ovStatus", forms.length === 0)) {
        renderLegend(panel, "ovStatusLegend", []);
        return;
    }

    const counts = countBy(forms, (form) => form.form_status_id);
    const entries = sortedEntries(counts);

    const nameOf = (statusId) =>
        forms.find((form) => form.form_status_id === statusId)?.form_status_name || `Status ${statusId}`;

    makeChart(`${TAB}:status`, canvas, {
        type: "doughnut",
        data: {
            labels: entries.map(([statusId]) => nameOf(statusId)),
            datasets: [{
                data: entries.map(([, count]) => count),
                backgroundColor: entries.map(([statusId]) => statusColor(statusId)),
                borderColor: "#fff",
                borderWidth: 2,
                hoverOffset: 5,
            }],
        },
        options: doughnutOptions({ legend: false, cutout: "62%" }),
    });

    renderLegend(panel, "ovStatusLegend", entries.map(([statusId, count]) => ({
        label: nameOf(statusId),
        value: count,
        color: statusColor(statusId),
    })));
}

/* ============================================================
   Funil
   ============================================================ */

function renderFunnel(panel, forms) {
    const inSet = (ids) => forms.filter((form) => ids.includes(form.form_status_id)).length;

    // aproximação por status atual: um formulário numa etapa avançada passou pelas anteriores
    const stages = [
        { label: "Formulários recebidos", count: forms.length },
        { label: "Aprovados no financeiro", count: forms.filter((form) => ![1, 7, 8].includes(form.form_status_id)).length },
        { label: "Aprovados na entrevista", count: inSet([4, 5, 6, 11, 12]) },
        { label: "Aprovados na gerência", count: inSet([5, 6]) },
        { label: "Cadastro finalizado", count: inSet([FINALIZED_ID]) },
    ];

    const top = stages[0].count || 1;
    const container = panel.querySelector("#ovFunnel");

    container.innerHTML = `<div class="funnel">${stages.map((stage, index) => {
        const width = Math.max((stage.count / top) * 100, stage.count > 0 ? 2 : 0);
        const previous = index > 0 ? stages[index - 1].count : null;
        const drop = previous !== null && previous > 0 ? previous - stage.count : 0;

        return `
            <div class="funnel-row">
                <div class="funnel-row-head">
                    <span class="funnel-stage">${escapeHtml(stage.label)}</span>
                    <span class="funnel-meta"><strong>${stage.count}</strong> · ${percentOf(stage.count, top)}</span>
                </div>
                <div class="funnel-track">
                    <div class="funnel-fill" style="width:${width}%"></div>
                </div>
                ${index > 0 && drop > 0 ? `<span class="funnel-drop">− ${drop} (${percentOf(drop, previous)} de queda)</span>` : ""}
            </div>
        `;
    }).join("")}</div>`;
}

/* ============================================================
   Consultores
   ============================================================ */

function renderConsultants(panel, forms) {
    const canvas = panel.querySelector("#ovConsultants");
    const counts = countBy(forms, (form) => form.consultant_name || "—");
    const entries = sortedEntries(counts, 8);

    if (setChartEmpty(panel, "ovConsultants", entries.length === 0)) return;

    makeChart(`${TAB}:consultants`, canvas, {
        type: "bar",
        data: {
            labels: entries.map(([name]) => name),
            datasets: [{
                label: "Formulários",
                data: entries.map(([, count]) => count),
                backgroundColor: GREEN,
                ...BAR_STYLE,
            }],
        },
        options: barOptions({ horizontal: true }),
    });
}
