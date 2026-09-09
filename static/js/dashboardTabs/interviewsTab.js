// Aba 4 — Entrevistas & Saúde.
// Duas metades: a operação da entrevista e o perfil de risco declarado.
//
// Privacidade: esta aba lê a declaração de saúde, então trabalha só com agregados.
// Nenhum nome de beneficiário é renderizado aqui — por isso ela usa
// /application-form-interviews e não /completed, que traz nome e CPF junto.

import { loadForms, loadInterviews, loadQualifyInterviews, indexByLatest } from "./dashboardData.js";
import {
    filterByPeriod, parseDate, diffInDays, pct, percentOf, countBy, sortedEntries,
    mean, formatDays, groupBy,
} from "./aggregations.js";
import {
    PARECER_UNIMED_SHORT_LABELS, PARECER_UNIMED_REFUSED,
    ESCOLHA_MEDICO_ORIENTADOR_LABELS, classifyImc, getDeclaredConditions,
} from "../utils/qualifyInterview.js";
import { QUALIFY_INTERVIEW_GROUPS } from "../analyzeInterviewModals/qualifyInterviewQuestions.js";
import { makeChart, barOptions, doughnutOptions, colorAt, BAR_STYLE, PALETTE, GREEN } from "./chartFactory.js";
import {
    blockTitle, grid, kpiCard, kpiGrid, chartCard, contentCard,
    setText, setChartEmpty, renderBarList, renderTiles,
} from "./widgets.js";

const TAB = "entrevistas";

const IMC_ORDER = [
    "Abaixo do peso", "Normal", "Sobrepeso",
    "Obesidade Grau I", "Obesidade Grau II", "Obesidade Grau III",
];

const PARECER_COLORS = {
    sem_preexistencias: "#22a04e",
    com_preexistencias_aceitou_cpt: "#f59e0b",
    com_preexistencias_recusou_cpt: "#ef4444",
    recusou_pericia_exames: "#b91c1c",
};

export function init(panel) {
    panel.innerHTML = `
        ${kpiGrid([
            kpiCard({ id: "ivDone", label: "Entrevistas realizadas", foot: "com análise concluída", accent: "total" }),
            kpiCard({ id: "ivApproval", label: "Taxa de aprovação", foot: "aprovadas / analisadas", accent: "done" }),
            kpiCard({ id: "ivBacklog", label: "Aguardando agendamento", foot: "situação atual", accent: "active" }),
            kpiCard({ id: "ivUpcoming", label: "Agendadas à frente", foot: "situação atual", accent: "conv" }),
            kpiCard({ id: "ivRefused", label: "Pareceres de recusa", foot: "CPT recusada ou perícia recusada", accent: "lost" }),
        ])}

        ${blockTitle("Operação")}
        ${grid(`
            ${contentCard({ id: "ivTimes", title: "Tempos da entrevista", desc: "Do agendamento à análise", span: 4 })}
            ${chartCard({ id: "ivInterviewers", title: "Volume por entrevistador", desc: "Entrevistas analisadas no período", span: 4 })}
            ${chartCard({ id: "ivApprovalBy", title: "Aprovação por entrevistador", desc: "Percentual de entrevistas aprovadas", span: 4 })}
        `)}

        ${blockTitle("Perfil de saúde declarado (dados agregados)")}
        ${grid(`
            ${chartCard({ id: "ivParecer", title: "Parecer da Unimed", desc: "Resultado da declaração de saúde", span: 4, legend: false })}
            ${chartCard({ id: "ivImc", title: "Faixas de IMC", desc: "Calculado do peso e altura declarados", span: 4 })}
            ${chartCard({ id: "ivDoctor", title: "Médico orientador", desc: "Escolha do proponente", span: 4, legend: false })}
        `)}

        ${grid(`
            ${contentCard({ id: "ivConditions", title: "Preexistências por grupo", desc: "Declarações com ao menos um Sim em cada grupo do questionário", span: 6 })}
            ${chartCard({ id: "ivRisk", title: "Condições declaradas x reprovação", desc: "Reprovação na entrevista por quantidade de condições", span: 6 })}
        `)}
    `;
}

export async function render(panel, period) {
    const [forms, allInterviews, qualifyInterviews] = await Promise.all([
        loadForms(), loadInterviews(), loadQualifyInterviews(),
    ]);

    // a entrevista entra pelo período em que ela acontece, não pela criação do formulário
    const interviews = filterByPeriod(allInterviews, "interview_date", period);
    const interviewIds = new Set(interviews.map((interview) => interview.id));

    const qualifyByInterview = indexByLatest(qualifyInterviews, "created_at", "application_form_interview_id");
    const qualify = qualifyInterviews.filter((item) => interviewIds.has(item.application_form_interview_id));

    renderKpis(panel, forms, allInterviews, interviews, qualify);
    renderTimes(panel, interviews);
    renderInterviewers(panel, interviews);
    renderParecer(panel, qualify);
    renderImc(panel, qualify);
    renderDoctor(panel, qualify);
    renderConditions(panel, qualify);
    renderRisk(panel, interviews, qualifyByInterview);
}

/* ============================================================
   KPIs
   ============================================================ */

function renderKpis(panel, forms, allInterviews, interviews, qualify) {
    const analyzed = interviews.filter((interview) => interview.interview_approved !== null && interview.interview_approved !== undefined);
    const approved = analyzed.filter((interview) => interview.interview_approved === true).length;

    const backlog = forms.filter((form) => form.form_status_id === 2).length;

    const now = Date.now();
    const upcoming = allInterviews.filter((interview) => {
        const date = parseDate(interview.interview_date);
        return date && date.getTime() >= now;
    }).length;

    const refused = qualify.filter((item) => PARECER_UNIMED_REFUSED.has(item.parecer_unimed)).length;

    setText(panel, "ivDone", analyzed.length);
    setText(panel, "ivApproval", percentOf(approved, analyzed.length));
    setText(panel, "ivApprovalFoot", `${approved} de ${analyzed.length} analisadas`);
    setText(panel, "ivBacklog", backlog);
    setText(panel, "ivUpcoming", upcoming);
    setText(panel, "ivRefused", refused);
    setText(panel, "ivRefusedFoot", `${percentOf(refused, qualify.length)} das declarações do período`);
}

/* ============================================================
   Operação
   ============================================================ */

function renderTimes(panel, interviews) {
    const waiting = [];
    const analysis = [];

    interviews.forEach((interview) => {
        const wait = diffInDays(interview.created_at, interview.interview_date);
        if (wait !== null && wait >= 0) waiting.push(wait);

        const review = diffInDays(interview.interview_date, interview.interview_reviewed_at);
        if (review !== null && review >= 0) analysis.push(review);
    });

    renderTiles(panel, "ivTimes", [
        { label: "Do agendamento à entrevista", value: formatDays(mean(waiting)) },
        { label: "Da entrevista à análise", value: formatDays(mean(analysis)) },
        { label: "Entrevistas no período", value: interviews.length },
        { label: "Já analisadas", value: analysis.length },
    ]);
}

function renderInterviewers(panel, interviews) {
    const analyzed = interviews.filter((interview) => interview.interview_approved === true || interview.interview_approved === false);
    const byInterviewer = groupBy(analyzed, (interview) => interview.interviewer_name || "—");
    const entries = [...byInterviewer.entries()].sort((a, b) => b[1].length - a[1].length).slice(0, 8);

    if (!setChartEmpty(panel, "ivInterviewers", entries.length === 0)) {
        makeChart(`${TAB}:interviewers`, panel.querySelector("#ivInterviewers"), {
            type: "bar",
            data: {
                labels: entries.map(([name]) => name),
                datasets: [{
                    label: "Entrevistas",
                    data: entries.map(([, list]) => list.length),
                    backgroundColor: GREEN,
                    ...BAR_STYLE,
                }],
            },
            options: barOptions({ horizontal: true }),
        });
    }

    if (setChartEmpty(panel, "ivApprovalBy", entries.length === 0)) return;

    makeChart(`${TAB}:approvalBy`, panel.querySelector("#ivApprovalBy"), {
        type: "bar",
        data: {
            labels: entries.map(([name]) => name),
            datasets: [{
                label: "Aprovação",
                data: entries.map(([, list]) =>
                    pct(list.filter((interview) => interview.interview_approved === true).length, list.length)),
                backgroundColor: PALETTE[0],
                ...BAR_STYLE,
            }],
        },
        options: barOptions({ horizontal: true, suffix: "%" }),
    });
}

/* ============================================================
   Saúde — sempre agregado
   ============================================================ */

function renderParecer(panel, qualify) {
    const counts = countBy(qualify, (item) => item.parecer_unimed);
    const entries = sortedEntries(counts);

    if (setChartEmpty(panel, "ivParecer", entries.length === 0)) return;

    makeChart(`${TAB}:parecer`, panel.querySelector("#ivParecer"), {
        type: "doughnut",
        data: {
            labels: entries.map(([key]) => PARECER_UNIMED_SHORT_LABELS[key] || key),
            datasets: [{
                data: entries.map(([, count]) => count),
                backgroundColor: entries.map(([key]) => PARECER_COLORS[key] || "#9ca3af"),
                borderColor: "#fff",
                borderWidth: 2,
                hoverOffset: 5,
            }],
        },
        options: doughnutOptions({ legend: true, cutout: "58%" }),
    });
}

function renderImc(panel, qualify) {
    const counts = countBy(qualify, (item) => {
        const peso = Number(item.peso_kg);
        const altura = Number(item.altura_cm);
        if (!peso || !altura) return null;

        return classifyImc(peso / ((altura / 100) ** 2));
    });

    const values = IMC_ORDER.map((label) => counts.get(label) || 0);

    if (setChartEmpty(panel, "ivImc", values.every((value) => value === 0))) return;

    makeChart(`${TAB}:imc`, panel.querySelector("#ivImc"), {
        type: "bar",
        data: {
            labels: IMC_ORDER,
            datasets: [{
                label: "Declarações",
                data: values,
                backgroundColor: ["#3b82f6", "#22a04e", "#f59e0b", "#f97316", "#ef4444", "#b91c1c"],
                ...BAR_STYLE,
            }],
        },
        options: barOptions({ horizontal: true }),
    });
}

function renderDoctor(panel, qualify) {
    const counts = countBy(qualify, (item) => item.escolha_medico_orientador);
    const entries = sortedEntries(counts);

    if (setChartEmpty(panel, "ivDoctor", entries.length === 0)) return;

    makeChart(`${TAB}:doctor`, panel.querySelector("#ivDoctor"), {
        type: "doughnut",
        data: {
            labels: entries.map(([key]) => ESCOLHA_MEDICO_ORIENTADOR_LABELS[key] || key),
            datasets: [{
                data: entries.map(([, count]) => count),
                backgroundColor: entries.map((_, index) => colorAt(index)),
                borderColor: "#fff",
                borderWidth: 2,
                hoverOffset: 5,
            }],
        },
        options: doughnutOptions({ legend: true, cutout: "58%" }),
    });
}

// Agrega pelos 27 grupos do questionário em vez dos ~140 campos: a pergunta útil é
// "quantas declarações têm alguma coisa em cardiologia", não qual campo exato.
function renderConditions(panel, qualify) {
    const total = qualify.length;

    setText(panel, "ivConditionsDesc", total
        ? `${total} declarações no período · % com ao menos um Sim no grupo`
        : "Nenhuma declaração no período");

    const rows = QUALIFY_INTERVIEW_GROUPS
        .map((group) => ({
            label: `${group.number}. ${group.title.replace(/^Sofre ou sofreu,? de /i, "").replace(/\?$/, "")}`,
            value: qualify.filter((item) => group.items.some((question) => item[question.key] === true)).length,
        }))
        .filter((row) => row.value > 0)
        .sort((a, b) => b.value - a.value);

    renderBarList(panel, "ivConditions", rows, {
        emptyMessage: "Nenhuma preexistência declarada no período.",
    });
}

function renderRisk(panel, interviews, qualifyByInterview) {
    const analyzed = interviews.filter((interview) =>
        interview.interview_approved === true || interview.interview_approved === false);

    const buckets = [
        { label: "Nenhuma", test: (count) => count === 0, total: 0, rejected: 0 },
        { label: "1 a 2", test: (count) => count >= 1 && count <= 2, total: 0, rejected: 0 },
        { label: "3 a 5", test: (count) => count >= 3 && count <= 5, total: 0, rejected: 0 },
        { label: "6 ou mais", test: (count) => count >= 6, total: 0, rejected: 0 },
    ];

    analyzed.forEach((interview) => {
        const qualify = qualifyByInterview.get(interview.id);
        if (!qualify) return;

        const declared = getDeclaredConditions(qualify).length;
        const bucket = buckets.find((item) => item.test(declared));
        if (!bucket) return;

        bucket.total++;
        if (interview.interview_approved === false) bucket.rejected++;
    });

    const withData = buckets.filter((bucket) => bucket.total > 0);

    if (setChartEmpty(panel, "ivRisk", withData.length === 0)) {
        setText(panel, "ivRiskDesc", "Sem declarações analisadas no período");
        return;
    }

    setText(panel, "ivRiskDesc",
        withData.map((bucket) => `${bucket.label}: ${bucket.total}`).join(" · "));

    makeChart(`${TAB}:risk`, panel.querySelector("#ivRisk"), {
        type: "bar",
        data: {
            labels: withData.map((bucket) => bucket.label),
            datasets: [{
                label: "Reprovação",
                data: withData.map((bucket) => pct(bucket.rejected, bucket.total)),
                backgroundColor: PALETTE[5],
                ...BAR_STYLE,
            }],
        },
        options: barOptions({ suffix: "%" }),
    });
}
