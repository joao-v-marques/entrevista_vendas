// Aba 2 — Vendas.
// Perfil comercial do que entra: mix de produto, origem do cliente, disciplina de
// desconto e perfil do beneficiário. Tudo sai de /application-forms.
//
// Não há valor monetário no schema, então "vendas" aqui é volume e composição,
// nunca faturamento.

import { loadForms } from "./dashboardData.js";
import {
    filterByPeriod, parseDate, diffInDays, percentOf, formatPercent, countBy, sortedEntries,
    ageRangeOf, AGE_RANGES, MONTH_LABELS, mean,
} from "./aggregations.js";
import { makeChart, barOptions, doughnutOptions, colorAt, BAR_STYLE, GREEN, PALETTE } from "./chartFactory.js";
import {
    blockTitle, grid, kpiCard, kpiGrid, chartCard, contentCard,
    setText, setChartEmpty, renderBarList, renderTiles,
} from "./widgets.js";

const TAB = "vendas";

export function init(panel) {
    panel.innerHTML = `
        ${kpiGrid([
            kpiCard({ id: "slTotal", label: "Formulários no período", foot: "todas as etapas", accent: "total" }),
            kpiCard({ id: "slDiscount", label: "Com desconto", foot: "sobre o total do período", accent: "active" }),
            kpiCard({ id: "slPortability", label: "Com portabilidade", foot: "sobre o total do período", accent: "conv" }),
            kpiCard({ id: "slPa", label: "Via PA Digital", foot: "sobre o total do período", accent: "done" }),
            kpiCard({ id: "slPj", label: "Pessoa jurídica", foot: "formulários com CNPJ", accent: "neutral" }),
        ])}

        ${blockTitle("Mix comercial")}
        ${grid(`
            ${chartCard({ id: "slPlans", title: "Mix de planos", desc: "Distribuição por tipo de plano", span: 4, legend: false })}
            ${chartCard({ id: "slContract", title: "Tipo de contrato", desc: "Composição das adesões", span: 4 })}
            ${chartCard({ id: "slInclusion", title: "Tipo de inclusão", desc: "Como o beneficiário entra", span: 4 })}
        `)}

        ${blockTitle("Origem e descontos")}
        ${grid(`
            ${contentCard({ id: "slPortabilityBox", title: "Portabilidade", desc: "Volume e planos de origem", span: 6 })}
            ${chartCard({ id: "slDiscountChart", title: "Faixas de desconto", desc: "Distribuição dos descontos concedidos", span: 6 })}
        `)}

        ${blockTitle("Perfil do beneficiário")}
        ${grid(`
            ${chartCard({ id: "slAge", title: "Faixa etária", desc: "A partir da data de nascimento", span: 4 })}
            ${chartCard({ id: "slMarital", title: "Estado civil", desc: "Declarado no formulário", span: 4, legend: false })}
            ${chartCard({ id: "slBeneficiary", title: "Titular x dependente", desc: "Tipo de beneficiário", span: 4, legend: false })}
        `)}

        ${blockTitle("Calendário")}
        ${grid(`
            ${chartCard({ id: "slSeason", title: "Sazonalidade", desc: "Formulários criados por mês do ano", span: 6 })}
            ${chartCard({ id: "slExpiration", title: "Mês de vencimento", desc: "Distribuição das datas de vencimento", span: 6 })}
        `)}

        ${grid(contentCard({ id: "slLead", title: "Antecedência da venda", desc: "Dias entre a criação do formulário e a data de inclusão", span: 12 }))}
    `;
}

export async function render(panel, period) {
    const allForms = await loadForms();
    const forms = filterByPeriod(allForms, "created_at", period);

    renderKpis(panel, forms);
    renderCategory(panel, "slPlans", forms, (form) => form.plan_type, "doughnut");
    renderCategory(panel, "slContract", forms, (form) => form.contract_type, "bar");
    renderCategory(panel, "slInclusion", forms, (form) => form.inclusion_type, "bar");
    renderPortability(panel, forms);
    renderDiscounts(panel, forms);
    renderAgeRanges(panel, forms);
    renderCategory(panel, "slMarital", forms, (form) => form.beneficiary_marital_state, "doughnut");
    renderBeneficiaryType(panel, forms);
    renderSeason(panel, forms);
    renderExpiration(panel, forms);
    renderLeadTime(panel, forms);
}

/* ============================================================
   KPIs
   ============================================================ */

function renderKpis(panel, forms) {
    const total = forms.length;
    const share = (count) => percentOf(count, total);

    const discount = forms.filter((form) => form.is_discount).length;
    const portability = forms.filter((form) => form.is_portability).length;
    const paDigital = forms.filter((form) => form.is_pa_digital).length;
    const pj = forms.filter((form) => form.cnpj).length;

    setText(panel, "slTotal", total);
    setText(panel, "slDiscount", share(discount));
    setText(panel, "slDiscountFoot", `${discount} de ${total} formulários`);
    setText(panel, "slPortability", share(portability));
    setText(panel, "slPortabilityFoot", `${portability} de ${total} formulários`);
    setText(panel, "slPa", share(paDigital));
    setText(panel, "slPaFoot", `${paDigital} de ${total} formulários`);
    setText(panel, "slPj", pj);
    setText(panel, "slPjFoot", `${share(pj)} do período`);
}

/* ============================================================
   Categorias genéricas
   ============================================================ */

function renderCategory(panel, id, forms, keyFn, type) {
    const canvas = panel.querySelector(`#${id}`);
    const entries = sortedEntries(countBy(forms, (form) => keyFn(form) || null), 10);

    if (setChartEmpty(panel, id, entries.length === 0)) return;

    const labels = entries.map(([label]) => label);
    const values = entries.map(([, count]) => count);

    if (type === "doughnut") {
        makeChart(`${TAB}:${id}`, canvas, {
            type: "doughnut",
            data: {
                labels,
                datasets: [{
                    data: values,
                    backgroundColor: labels.map((_, index) => colorAt(index)),
                    borderColor: "#fff",
                    borderWidth: 2,
                    hoverOffset: 5,
                }],
            },
            options: doughnutOptions({ legend: true, cutout: "58%" }),
        });
        return;
    }

    makeChart(`${TAB}:${id}`, canvas, {
        type: "bar",
        data: {
            labels,
            datasets: [{ label: "Formulários", data: values, backgroundColor: PALETTE[0], ...BAR_STYLE }],
        },
        options: barOptions({ horizontal: labels.length > 4 }),
    });
}

function renderBeneficiaryType(panel, forms) {
    const canvas = panel.querySelector("#slBeneficiary");
    const counts = countBy(forms, (form) => {
        if (form.beneficiary_type === "primary") return "Titular";
        if (form.beneficiary_type === "secondary") return "Dependente";
        return form.beneficiary_type || null;
    });
    const entries = sortedEntries(counts);

    if (setChartEmpty(panel, "slBeneficiary", entries.length === 0)) return;

    makeChart(`${TAB}:beneficiary`, canvas, {
        type: "doughnut",
        data: {
            labels: entries.map(([label]) => label),
            datasets: [{
                data: entries.map(([, count]) => count),
                backgroundColor: [PALETTE[2], PALETTE[0], PALETTE[3]],
                borderColor: "#fff",
                borderWidth: 2,
                hoverOffset: 5,
            }],
        },
        options: doughnutOptions({ legend: true, cutout: "58%" }),
    });
}

/* ============================================================
   Portabilidade — de onde o cliente vem
   ============================================================ */

function renderPortability(panel, forms) {
    const requested = forms.filter((form) => form.is_portability);
    const accepted = requested.filter((form) => form.portability_accepted === true).length;
    const refused = requested.filter((form) => form.portability_accepted === false).length;

    const container = panel.querySelector("#slPortabilityBox");
    container.innerHTML = `<div id="slPortTiles"></div><div id="slPortPlans" style="margin-top:0.75rem"></div>`;

    renderTiles(panel, "slPortTiles", [
        { label: "Solicitaram portabilidade", value: requested.length },
        { label: "Aceitas", value: accepted },
        { label: "Recusadas", value: refused },
        { label: "Sem análise", value: requested.length - accepted - refused },
    ]);

    const plans = sortedEntries(countBy(requested, (form) => form.previous_plan || null), 8);
    renderBarList(panel, "slPortPlans", plans.map(([label, value]) => ({ label, value })), {
        emptyMessage: "Nenhum plano de origem informado no período.",
    });
}

/* ============================================================
   Descontos
   ============================================================ */

// discount_percentage é numeric(3,2) — teto 9.99. Isso comporta a fração (0.15 = 15%),
// mas não 15 como pontos percentuais. Como o dado pode ter sido gravado das duas formas,
// normalizamos: valor até 1 é fração, acima disso já são pontos percentuais.
function discountPercent(form) {
    const raw = Number(form.discount_percentage);
    if (!isFinite(raw) || raw <= 0) return null;

    return raw <= 1 ? raw * 100 : raw;
}

function renderDiscounts(panel, forms) {
    const canvas = panel.querySelector("#slDiscountChart");
    const values = forms.map(discountPercent).filter((value) => value !== null);

    if (setChartEmpty(panel, "slDiscountChart", values.length === 0)) {
        setText(panel, "slDiscountChartDesc", "Nenhum desconto concedido no período");
        return;
    }

    const average = mean(values);
    setText(panel, "slDiscountChartDesc",
        `${values.length} com desconto · média de ${formatPercent(average)}`);

    const buckets = [
        { label: "até 5%", test: (value) => value <= 5 },
        { label: "5,1 a 10%", test: (value) => value > 5 && value <= 10 },
        { label: "10,1 a 15%", test: (value) => value > 10 && value <= 15 },
        { label: "15,1 a 20%", test: (value) => value > 15 && value <= 20 },
        { label: "acima de 20%", test: (value) => value > 20 },
    ];

    makeChart(`${TAB}:discount`, canvas, {
        type: "bar",
        data: {
            labels: buckets.map((bucket) => bucket.label),
            datasets: [{
                label: "Formulários",
                data: buckets.map((bucket) => values.filter(bucket.test).length),
                backgroundColor: PALETTE[1],
                ...BAR_STYLE,
            }],
        },
        options: barOptions({}),
    });
}

/* ============================================================
   Perfil
   ============================================================ */

function renderAgeRanges(panel, forms) {
    const canvas = panel.querySelector("#slAge");
    const counts = countBy(forms, (form) => ageRangeOf(form.beneficiary_birth_date));
    const values = AGE_RANGES.map((range) => counts.get(range) || 0);

    if (setChartEmpty(panel, "slAge", values.every((value) => value === 0))) return;

    makeChart(`${TAB}:age`, canvas, {
        type: "bar",
        data: {
            labels: AGE_RANGES,
            datasets: [{ label: "Beneficiários", data: values, backgroundColor: PALETTE[4], ...BAR_STYLE }],
        },
        options: barOptions({}),
    });
}

/* ============================================================
   Calendário
   ============================================================ */

function renderSeason(panel, forms) {
    const canvas = panel.querySelector("#slSeason");
    const counts = new Array(12).fill(0);

    forms.forEach((form) => {
        const date = parseDate(form.created_at);
        if (date) counts[date.getUTCMonth()]++;
    });

    if (setChartEmpty(panel, "slSeason", counts.every((value) => value === 0))) return;

    makeChart(`${TAB}:season`, canvas, {
        type: "bar",
        data: {
            labels: MONTH_LABELS,
            datasets: [{ label: "Formulários", data: counts, backgroundColor: GREEN, ...BAR_STYLE }],
        },
        options: barOptions({}),
    });
}

function renderExpiration(panel, forms) {
    const canvas = panel.querySelector("#slExpiration");
    const counts = new Array(12).fill(0);

    forms.forEach((form) => {
        const month = Number(form.expiration_month);
        if (month >= 1 && month <= 12) counts[month - 1]++;
    });

    if (setChartEmpty(panel, "slExpiration", counts.every((value) => value === 0))) return;

    makeChart(`${TAB}:expiration`, canvas, {
        type: "bar",
        data: {
            labels: MONTH_LABELS,
            datasets: [{ label: "Formulários", data: counts, backgroundColor: PALETTE[3], ...BAR_STYLE }],
        },
        options: barOptions({}),
    });
}

// dias entre criar o formulário e a data de inclusão do beneficiário: mede com quanta
// antecedência a venda é fechada (e quantas são retroativas)
function renderLeadTime(panel, forms) {
    const buckets = [
        { label: "Retroativa", value: 0 },
        { label: "0 a 7 dias", value: 0 },
        { label: "8 a 15 dias", value: 0 },
        { label: "16 a 30 dias", value: 0 },
        { label: "mais de 30 dias", value: 0 },
    ];

    forms.forEach((form) => {
        const days = diffInDays(form.created_at, form.inclusion_date);
        if (days === null) return;

        if (days < 0) buckets[0].value++;
        else if (days <= 7) buckets[1].value++;
        else if (days <= 15) buckets[2].value++;
        else if (days <= 30) buckets[3].value++;
        else buckets[4].value++;
    });

    const filled = buckets.filter((bucket) => bucket.value > 0);
    renderBarList(panel, "slLead", filled, {
        emptyMessage: "Sem datas de inclusão preenchidas no período.",
    });
}
