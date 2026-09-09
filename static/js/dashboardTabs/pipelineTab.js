// Aba 3 — Pipeline & Formulários.
// A aba operacional: onde os formulários estão, quanto tempo cada etapa leva e
// onde eles morrem.
//
// É a aba que mais ganha com o cruzamento entre endpoints: sozinho,
// /application-forms não tem nenhuma data de revisão. Juntando aprovação, entrevista
// e gerência pelo application_form_id, o tempo real de cada etapa aparece.

import { escapeHtml } from "../utils/detailsView.js";
import { formatDateToBR } from "../utils/dateUtils.js";
import { getStatusPillClass } from "../utils/statusPill.js";
import {
    loadForms, loadApprovals, loadInterviews, loadManagement, loadDocuments,
    indexByLatest, groupByForm,
} from "./dashboardData.js";
import {
    filterByPeriod, isActive, diffInDays, ageInDays, ageBucket, AGE_BUCKETS,
    pct, percentOf, countBy, sortedEntries, mean, median, formatDays, parseDate,
} from "./aggregations.js";
import { makeChart, barOptions, statusColor, BAR_STYLE, PALETTE } from "./chartFactory.js";
import {
    blockTitle, grid, kpiCard, kpiGrid, chartCard, contentCard, tableCard,
    setText, setChartEmpty, fillTable, renderBarList, renderTiles,
} from "./widgets.js";

const TAB = "pipeline";

// as cinco transições com carimbo de data em ambas as pontas
const STAGES = [
    { key: "financeiro", label: "Aprovação financeira" },
    { key: "agendamento", label: "Agendamento" },
    { key: "espera", label: "Espera pela entrevista" },
    { key: "analise", label: "Análise da entrevista" },
    { key: "gerencia", label: "Aprovação da gerência" },
];

export function init(panel) {
    panel.innerHTML = `
        ${kpiGrid([
            kpiCard({ id: "plActive", label: "Em andamento", foot: "formulários no pipeline", accent: "active" }),
            kpiCard({ id: "plOldest", label: "Ativo mais antigo", foot: "tempo no sistema", accent: "lost" }),
            kpiCard({ id: "plBottleneck", label: "Etapa gargalo", foot: "maior tempo médio", accent: "total" }),
            kpiCard({ id: "plRejection", label: "Taxa de reprovação", foot: "decisões negativas / decisões", accent: "conv" }),
            kpiCard({ id: "plNoDocs", label: "Sem documento", foot: "formulários sem anexo", accent: "neutral" }),
        ])}

        ${blockTitle("Onde os formulários estão")}
        ${grid(`
            ${chartCard({ id: "plStatus", title: "Distribuição por status", desc: "Os 12 status do fluxo", span: 6, tall: true })}
            ${contentCard({ id: "plAging", title: "Idade dos formulários ativos", desc: "Tempo desde a criação — não é tempo parado na etapa", span: 6 })}
        `)}

        ${blockTitle("Tempo e decisões")}
        ${grid(`
            ${chartCard({ id: "plStages", title: "Tempo por etapa", desc: "Média e mediana, em dias", span: 6 })}
            ${chartCard({ id: "plRejections", title: "Reprovação por etapa", desc: "Percentual de decisões negativas", span: 6 })}
        `)}

        ${grid(`
            ${chartCard({ id: "plOutcome", title: "Desfecho das reprovações", desc: "Reprovado x negociação encerrada", span: 6 })}
            ${contentCard({ id: "plDocs", title: "Documentos", desc: "Anexos por formulário", span: 6 })}
        `)}

        ${blockTitle("Fila")}
        ${grid(tableCard({
            id: "plOldestBody",
            title: "Formulários ativos mais antigos",
            desc: "Os 15 com mais tempo no sistema",
            span: 12,
            link: { href: "/entrevista-adesao/fichas", label: "Ver todos" },
            columns: [
                { label: "Beneficiário" },
                { label: "Consultor" },
                { label: "Criado em" },
                { label: "Status" },
                { label: "No sistema", numeric: true },
            ],
        }))}
    `;
}

export async function render(panel, period) {
    const [allForms, approvals, interviews, managements, documents] = await Promise.all([
        loadForms(), loadApprovals(), loadInterviews(), loadManagement(), loadDocuments(),
    ]);

    const forms = filterByPeriod(allForms, "created_at", period);
    const formIds = new Set(forms.map((form) => form.id));

    // a coorte do período manda: aprovação, entrevista e gerência entram só se
    // pertencerem a um formulário criado dentro do filtro
    const inCohort = (list) => list.filter((item) => formIds.has(item.application_form_id));

    const cohort = {
        approvals: inCohort(approvals),
        interviews: inCohort(interviews),
        managements: inCohort(managements),
        documents: inCohort(documents),
    };

    const durations = stageDurations(forms, cohort);

    renderKpis(panel, forms, cohort, durations);
    renderStatus(panel, forms);
    renderAging(panel, forms);
    renderStages(panel, durations);
    renderRejections(panel, cohort);
    renderOutcome(panel, forms);
    renderDocuments(panel, forms, cohort.documents);
    renderOldest(panel, forms);
}

/* ============================================================
   Tempo por etapa
   ============================================================ */

function stageDurations(forms, cohort) {
    const approvalByForm = indexByLatest(cohort.approvals, "financial_reviewed_at");
    const interviewByForm = indexByLatest(cohort.interviews, "created_at");
    const managementByForm = indexByLatest(cohort.managements, "management_reviewed_at");

    const durations = { financeiro: [], agendamento: [], espera: [], analise: [], gerencia: [] };

    forms.forEach((form) => {
        const approval = approvalByForm.get(form.id);
        const interview = interviewByForm.get(form.id);
        const management = managementByForm.get(form.id);

        const push = (key, from, to) => {
            const days = diffInDays(from, to);
            if (days !== null && days >= 0) durations[key].push(days);
        };

        push("financeiro", form.created_at, approval?.financial_reviewed_at);
        push("agendamento", approval?.financial_reviewed_at, interview?.created_at);
        push("espera", interview?.created_at, interview?.interview_date);
        push("analise", interview?.interview_date, interview?.interview_reviewed_at);
        push("gerencia", interview?.interview_reviewed_at, management?.management_reviewed_at);
    });

    return durations;
}

/* ============================================================
   KPIs
   ============================================================ */

function renderKpis(panel, forms, cohort, durations) {
    const active = forms.filter(isActive);

    const oldest = active.reduce((worst, form) => {
        const age = ageInDays(form.created_at);
        return age !== null && (worst === null || age > worst) ? age : worst;
    }, null);

    const bottleneck = STAGES
        .map((stage) => ({ label: stage.label, average: mean(durations[stage.key]) }))
        .filter((stage) => stage.average !== null)
        .sort((a, b) => b.average - a.average)[0];

    const decisions = [
        ...cohort.approvals.map((item) => item.financial_approved),
        ...cohort.interviews.map((item) => item.interview_approved),
        ...cohort.managements.map((item) => item.management_approved),
    ].filter((value) => value === true || value === false);

    const negatives = decisions.filter((value) => value === false).length;

    const withDocs = new Set(cohort.documents.map((document) => document.application_form_id));
    const noDocs = forms.filter((form) => !withDocs.has(form.id)).length;

    setText(panel, "plActive", active.length);
    setText(panel, "plOldest", formatDays(oldest));
    setText(panel, "plBottleneck", bottleneck ? bottleneck.label : "—");
    setText(panel, "plBottleneckFoot", bottleneck ? `média de ${formatDays(bottleneck.average)}` : "sem dados de etapa");
    setText(panel, "plRejection", percentOf(negatives, decisions.length));
    setText(panel, "plRejectionFoot", `${negatives} de ${decisions.length} decisões`);
    setText(panel, "plNoDocs", noDocs);
    setText(panel, "plNoDocsFoot", `${percentOf(noDocs, forms.length)} do período`);
}

/* ============================================================
   Status e idade
   ============================================================ */

function renderStatus(panel, forms) {
    const canvas = panel.querySelector("#plStatus");
    const counts = countBy(forms, (form) => form.form_status_id);
    const entries = sortedEntries(counts);

    if (setChartEmpty(panel, "plStatus", entries.length === 0)) return;

    const nameOf = (statusId) =>
        forms.find((form) => form.form_status_id === statusId)?.form_status_name || `Status ${statusId}`;

    makeChart(`${TAB}:status`, canvas, {
        type: "bar",
        data: {
            labels: entries.map(([statusId]) => nameOf(statusId)),
            datasets: [{
                label: "Formulários",
                data: entries.map(([, count]) => count),
                backgroundColor: entries.map(([statusId]) => statusColor(statusId)),
                ...BAR_STYLE,
            }],
        },
        options: barOptions({ horizontal: true }),
    });
}

function renderAging(panel, forms) {
    const active = forms.filter(isActive);
    const counts = countBy(active, (form) => ageBucket(ageInDays(form.created_at)));

    renderBarList(
        panel,
        "plAging",
        AGE_BUCKETS.map((bucket) => ({ label: bucket, value: counts.get(bucket) || 0 })),
        { emptyMessage: "Nenhum formulário ativo no período." }
    );
}

/* ============================================================
   Etapas
   ============================================================ */

function renderStages(panel, durations) {
    const canvas = panel.querySelector("#plStages");
    const filled = STAGES.filter((stage) => durations[stage.key].length > 0);

    if (setChartEmpty(panel, "plStages", filled.length === 0)) {
        setText(panel, "plStagesDesc", "Nenhuma etapa concluída no período");
        return;
    }

    const total = filled.reduce((sum, stage) => sum + durations[stage.key].length, 0);
    setText(panel, "plStagesDesc", `Média e mediana em dias · ${total} transições medidas`);

    makeChart(`${TAB}:stages`, canvas, {
        type: "bar",
        data: {
            labels: filled.map((stage) => stage.label),
            datasets: [
                {
                    label: "Média",
                    data: filled.map((stage) => Number(mean(durations[stage.key]).toFixed(1))),
                    backgroundColor: PALETTE[0],
                    ...BAR_STYLE,
                },
                {
                    label: "Mediana",
                    data: filled.map((stage) => Number(median(durations[stage.key]).toFixed(1))),
                    backgroundColor: PALETTE[4],
                    ...BAR_STYLE,
                },
            ],
        },
        options: barOptions({ horizontal: true, suffix: " d", legend: true }),
    });
}

function renderRejections(panel, cohort) {
    const canvas = panel.querySelector("#plRejections");

    const rate = (list, field) => {
        const decided = list.filter((item) => item[field] === true || item[field] === false);
        const negatives = decided.filter((item) => item[field] === false).length;
        return { decided: decided.length, negatives, rate: pct(negatives, decided.length) };
    };

    const stages = [
        { label: "Financeiro", ...rate(cohort.approvals, "financial_approved") },
        { label: "Entrevista", ...rate(cohort.interviews, "interview_approved") },
        { label: "Gerência", ...rate(cohort.managements, "management_approved") },
    ];

    const withData = stages.filter((stage) => stage.decided > 0);

    if (setChartEmpty(panel, "plRejections", withData.length === 0)) {
        setText(panel, "plRejectionsDesc", "Nenhuma decisão registrada no período");
        return;
    }

    setText(panel, "plRejectionsDesc",
        withData.map((stage) => `${stage.label}: ${stage.negatives}/${stage.decided}`).join(" · "));

    makeChart(`${TAB}:rejections`, canvas, {
        type: "bar",
        data: {
            labels: withData.map((stage) => stage.label),
            datasets: [{
                label: "Reprovação",
                data: withData.map((stage) => stage.rate),
                backgroundColor: withData.map((stage) => (stage.rate >= 30 ? "#ef4444" : "#f59e0b")),
                ...BAR_STYLE,
            }],
        },
        options: barOptions({ suffix: "%" }),
    });
}

// para cada etapa que reprova, quantos ficaram parados como "reprovado" (ainda
// podem virar reanálise) e quantos o consultor encerrou de vez
function renderOutcome(panel, forms) {
    const canvas = panel.querySelector("#plOutcome");
    const count = (statusId) => forms.filter((form) => form.form_status_id === statusId).length;

    const rows = [
        { label: "Financeiro", rejected: count(7), closed: count(8) },
        { label: "Entrevista", rejected: count(9), closed: count(10) },
        { label: "Gerência", rejected: count(11), closed: count(12) },
    ];

    const isEmpty = rows.every((row) => row.rejected === 0 && row.closed === 0);
    if (setChartEmpty(panel, "plOutcome", isEmpty)) return;

    makeChart(`${TAB}:outcome`, canvas, {
        type: "bar",
        data: {
            labels: rows.map((row) => row.label),
            datasets: [
                { label: "Reprovado", data: rows.map((row) => row.rejected), backgroundColor: "#ef4444", ...BAR_STYLE },
                { label: "Negociação encerrada", data: rows.map((row) => row.closed), backgroundColor: "#9ca3af", ...BAR_STYLE },
            ],
        },
        options: barOptions({ stacked: true, legend: true }),
    });
}

/* ============================================================
   Documentos
   ============================================================ */

function renderDocuments(panel, forms, documents) {
    const container = panel.querySelector("#plDocs");
    container.innerHTML = `<div id="plDocTiles"></div><div id="plDocTypes" style="margin-top:0.75rem"></div>`;

    const byForm = groupByForm(documents);
    const withDocs = forms.filter((form) => byForm.has(form.id));
    const counts = withDocs.map((form) => byForm.get(form.id).length);

    renderTiles(panel, "plDocTiles", [
        { label: "Formulários com anexo", value: withDocs.length },
        { label: "Sem nenhum anexo", value: forms.length - withDocs.length },
        { label: "Média de anexos", value: counts.length ? (mean(counts)).toFixed(1).replace(".", ",") : "—" },
        { label: "Total de arquivos", value: documents.length },
    ]);

    const types = sortedEntries(countBy(documents, (document) => document.document_type || "—"), 6);
    renderBarList(panel, "plDocTypes", types.map(([label, value]) => ({ label, value })), {
        emptyMessage: "Nenhum documento anexado no período.",
    });
}

/* ============================================================
   Fila
   ============================================================ */

function renderOldest(panel, forms) {
    const rows = forms
        .filter(isActive)
        .filter((form) => parseDate(form.created_at))
        .sort((a, b) => parseDate(a.created_at) - parseDate(b.created_at))
        .slice(0, 15)
        .map((form) => {
            const age = ageInDays(form.created_at);
            return `
                <tr>
                    <td class="td-name">${escapeHtml(form.beneficiary_name || "—")}</td>
                    <td>${escapeHtml(form.consultant_name || "—")}</td>
                    <td>${formatDateToBR(form.created_at)}</td>
                    <td><span class="pill ${getStatusPillClass(form.form_status_name)}">${escapeHtml(form.form_status_name || "—")}</span></td>
                    <td class="num-cell">${formatDays(age)}</td>
                </tr>
            `;
        });

    fillTable(panel, "plOldestBody", rows, 5, "Nenhum formulário ativo no período.");
}
