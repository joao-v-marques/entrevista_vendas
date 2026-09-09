// Aba 5 — Colaboradores.
// Quem produz, quem analisa e onde está a fila de cada etapa.
//
// /users já devolve role_name e sector_name resolvidos, então os gráficos de cadastro
// não precisam de /roles nem /sectors — são duas requisições a menos.

import { escapeHtml } from "../utils/detailsView.js";
import {
    loadForms, loadUsers, loadApprovals, loadInterviews, loadManagement, indexByLatest,
} from "./dashboardData.js";
import {
    filterByPeriod, isActive, isFinalized, isRejected, isClosed,
    diffInDays, pct, percentOf, formatPercent, countBy, sortedEntries, mean, formatDays, initials,
} from "./aggregations.js";
import { makeChart, barOptions, doughnutOptions, colorAt, BAR_STYLE, PALETTE } from "./chartFactory.js";
import {
    blockTitle, grid, kpiCard, kpiGrid, chartCard, contentCard, tableCard,
    setText, setChartEmpty, fillTable, renderBarList,
} from "./widgets.js";

const TAB = "colaboradores";

// cada etapa ativa do fluxo pertence a um time — é assim que a fila vira carga de trabalho
const QUEUE_BY_STATUS = [
    { statusId: 1, label: "Financeiro — aprovar formulário" },
    { statusId: 2, label: "Vendas — agendar entrevista" },
    { statusId: 3, label: "Entrevista — analisar" },
    { statusId: 4, label: "Gerência — aprovar" },
    { statusId: 5, label: "Backoffice — cadastrar" },
];

export function init(panel) {
    panel.innerHTML = `
        ${kpiGrid([
            kpiCard({ id: "tmConsultants", label: "Consultores ativos", foot: "com formulário no período", accent: "total" }),
            kpiCard({ id: "tmAverage", label: "Média por consultor", foot: "formulários no período", accent: "done" }),
            kpiCard({ id: "tmReviewers", label: "Revisores atuantes", foot: "decidiram no período", accent: "conv" }),
            kpiCard({ id: "tmActiveUsers", label: "Usuários ativos", foot: "cadastro do sistema", accent: "active" }),
            kpiCard({ id: "tmInactiveUsers", label: "Usuários inativos", foot: "cadastro do sistema", accent: "neutral" }),
        ])}

        ${blockTitle("Comercial")}
        ${grid(tableCard({
            id: "tmRankBody",
            title: "Ranking de consultores",
            desc: "Volume, conversão e uso de desconto no período",
            span: 12,
            columns: [
                { label: "Consultor" },
                { label: "Total", numeric: true },
                { label: "Finalizados", numeric: true },
                { label: "Andamento", numeric: true },
                { label: "Perdidos", numeric: true },
                { label: "Com desconto", numeric: true },
                { label: "Conversão", numeric: true },
            ],
        }))}

        ${blockTitle("Análise e fila")}
        ${grid(`
            ${tableCard({
                id: "tmReviewerBody",
                title: "Produtividade dos revisores",
                desc: "Decisões tomadas e tempo médio de resposta",
                span: 7,
                columns: [
                    { label: "Revisor" },
                    { label: "Etapa" },
                    { label: "Decisões", numeric: true },
                    { label: "Reprovação", numeric: true },
                    { label: "Tempo médio", numeric: true },
                ],
            })}
            ${contentCard({ id: "tmQueue", title: "Fila atual por etapa", desc: "Situação de hoje — não acompanha o filtro", span: 5 })}
        `)}

        ${blockTitle("Cadastro do sistema")}
        ${grid(`
            ${chartCard({ id: "tmSectors", title: "Usuários por setor", desc: "Somente usuários ativos", span: 6 })}
            ${chartCard({ id: "tmRoles", title: "Usuários por cargo", desc: "Somente usuários ativos", span: 6, legend: false })}
        `)}
    `;
}

export async function render(panel, period) {
    const [allForms, users, approvals, interviews, managements] = await Promise.all([
        loadForms(), loadUsers(), loadApprovals(), loadInterviews(), loadManagement(),
    ]);

    const forms = filterByPeriod(allForms, "created_at", period);
    const formIds = new Set(forms.map((form) => form.id));
    const formById = new Map(forms.map((form) => [form.id, form]));

    const inCohort = (list) => list.filter((item) => formIds.has(item.application_form_id));
    const userById = new Map(users.map((user) => [user.id, user]));

    const reviewers = buildReviewerStats(
        formById,
        userById,
        inCohort(approvals),
        inCohort(interviews),
        inCohort(managements)
    );

    renderKpis(panel, forms, users, reviewers);
    renderRanking(panel, forms);
    renderReviewers(panel, reviewers);
    renderQueue(panel, allForms);
    renderUsers(panel, users);
}

/* ============================================================
   Revisores
   ============================================================ */

// GET /application_form_approval e /application_form_management não fazem join com users:
// os campos financial_reviewer_name e manager_name existem no to_dict mas voltam sempre
// nulos (só a query de entrevistas junta o usuário). Como o escopo aqui é frontend,
// o nome é resolvido pelo id contra /users, que esta aba já carrega.
function buildReviewerStats(formById, userById, approvals, interviews, managements) {
    const nameOf = (name, userId) => name || userById.get(userId)?.name || "—";

    const stats = new Map(); // "nome|etapa" -> { name, stage, decisions, negatives, times[] }

    const add = (name, stage, approved, from, to) => {
        if (approved !== true && approved !== false) return;

        const key = `${name || "—"}|${stage}`;
        if (!stats.has(key)) stats.set(key, { name: name || "—", stage, decisions: 0, negatives: 0, times: [] });

        const entry = stats.get(key);
        entry.decisions++;
        if (approved === false) entry.negatives++;

        const days = diffInDays(from, to);
        if (days !== null && days >= 0) entry.times.push(days);
    };

    approvals.forEach((approval) => {
        const form = formById.get(approval.application_form_id);
        add(nameOf(approval.financial_reviewer_name, approval.financial_reviewer_id), "Financeiro", approval.financial_approved,
            form?.created_at, approval.financial_reviewed_at);
    });

    interviews.forEach((interview) => {
        add(nameOf(interview.interviewer_name, interview.interviewer_id), "Entrevista", interview.interview_approved,
            interview.interview_date, interview.interview_reviewed_at);
    });

    // a gerência decide depois que a entrevista foi analisada
    const interviewByForm = indexByLatest(interviews, "interview_reviewed_at");
    managements.forEach((management) => {
        const interview = interviewByForm.get(management.application_form_id);
        add(nameOf(management.manager_name, management.manager_id), "Gerência", management.management_approved,
            interview?.interview_reviewed_at, management.management_reviewed_at);
    });

    return [...stats.values()].sort((a, b) => b.decisions - a.decisions);
}

/* ============================================================
   KPIs
   ============================================================ */

function renderKpis(panel, forms, users, reviewers) {
    const consultants = new Set(forms.map((form) => form.consultant_name).filter(Boolean));
    const activeUsers = users.filter((user) => user.is_active).length;

    setText(panel, "tmConsultants", consultants.size);
    setText(panel, "tmAverage", consultants.size ? (forms.length / consultants.size).toFixed(1).replace(".", ",") : "—");
    setText(panel, "tmReviewers", new Set(reviewers.map((reviewer) => reviewer.name)).size);
    setText(panel, "tmActiveUsers", activeUsers);
    setText(panel, "tmInactiveUsers", users.length - activeUsers);
}

/* ============================================================
   Ranking de consultores
   ============================================================ */

function renderRanking(panel, forms) {
    const byConsultant = new Map();

    forms.forEach((form) => {
        const name = form.consultant_name || "—";
        if (!byConsultant.has(name)) {
            byConsultant.set(name, { total: 0, done: 0, active: 0, lost: 0, discount: 0 });
        }

        const entry = byConsultant.get(name);
        entry.total++;
        if (isFinalized(form)) entry.done++;
        else if (isActive(form)) entry.active++;
        else if (isRejected(form) || isClosed(form)) entry.lost++;
        if (form.is_discount) entry.discount++;
    });

    const rows = [...byConsultant.entries()]
        .sort((a, b) => b[1].total - a[1].total)
        .map(([name, entry]) => {
            const conversion = pct(entry.done, entry.total);
            const tone = conversion >= 60 ? "text-green" : conversion >= 30 ? "text-amber" : "text-red";

            return `
                <tr>
                    <td>
                        <div class="rank-name">
                            <span class="rank-avatar">${escapeHtml(initials(name))}</span>
                            <span>${escapeHtml(name)}</span>
                        </div>
                    </td>
                    <td class="num-cell">${entry.total}</td>
                    <td class="num-cell">${entry.done}</td>
                    <td class="num-cell">${entry.active}</td>
                    <td class="num-cell">${entry.lost}</td>
                    <td class="num-cell">${percentOf(entry.discount, entry.total)}</td>
                    <td class="num-cell"><span class="conv-tag ${tone}">${formatPercent(conversion)}</span></td>
                </tr>
            `;
        });

    fillTable(panel, "tmRankBody", rows, 7, "Nenhum formulário no período.");
}

/* ============================================================
   Revisores
   ============================================================ */

function renderReviewers(panel, reviewers) {
    const rows = reviewers.map((reviewer) => {
        const rejection = pct(reviewer.negatives, reviewer.decisions);
        const tone = rejection >= 30 ? "text-red" : rejection >= 15 ? "text-amber" : "text-green";

        return `
            <tr>
                <td>
                    <div class="rank-name">
                        <span class="rank-avatar">${escapeHtml(initials(reviewer.name))}</span>
                        <span>${escapeHtml(reviewer.name)}</span>
                    </div>
                </td>
                <td>${escapeHtml(reviewer.stage)}</td>
                <td class="num-cell">${reviewer.decisions}</td>
                <td class="num-cell"><span class="conv-tag ${tone}">${formatPercent(rejection)}</span></td>
                <td class="num-cell">${formatDays(mean(reviewer.times))}</td>
            </tr>
        `;
    });

    fillTable(panel, "tmReviewerBody", rows, 5, "Nenhuma decisão registrada no período.");
}

/* ============================================================
   Fila
   ============================================================ */

function renderQueue(panel, allForms) {
    const counts = countBy(allForms, (form) => form.form_status_id);

    renderBarList(
        panel,
        "tmQueue",
        QUEUE_BY_STATUS.map((queue) => ({ label: queue.label, value: counts.get(queue.statusId) || 0 })),
        { emptyMessage: "Nenhum formulário em andamento." }
    );
}

/* ============================================================
   Cadastro
   ============================================================ */

function renderUsers(panel, users) {
    const active = users.filter((user) => user.is_active);

    const sectors = sortedEntries(countBy(active, (user) => user.sector_name || "Sem setor"));
    if (!setChartEmpty(panel, "tmSectors", sectors.length === 0)) {
        makeChart(`${TAB}:sectors`, panel.querySelector("#tmSectors"), {
            type: "bar",
            data: {
                labels: sectors.map(([name]) => name),
                datasets: [{
                    label: "Usuários",
                    data: sectors.map(([, count]) => count),
                    backgroundColor: PALETTE[0],
                    ...BAR_STYLE,
                }],
            },
            options: barOptions({ horizontal: true }),
        });
    }

    const roles = sortedEntries(countBy(active, (user) => user.role_name || "Sem cargo"));
    if (setChartEmpty(panel, "tmRoles", roles.length === 0)) return;

    makeChart(`${TAB}:roles`, panel.querySelector("#tmRoles"), {
        type: "doughnut",
        data: {
            labels: roles.map(([name]) => name),
            datasets: [{
                data: roles.map(([, count]) => count),
                backgroundColor: roles.map((_, index) => colorAt(index)),
                borderColor: "#fff",
                borderWidth: 2,
                hoverOffset: 5,
            }],
        },
        options: doughnutOptions({ legend: true, cutout: "58%" }),
    });
}
