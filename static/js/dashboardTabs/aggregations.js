// Funções puras usadas pelas abas do dashboard: nada aqui toca no DOM nem faz fetch.
// Datas seguem a convenção do projeto (getters UTC), porque o Flask serializa
// timestamptz como GMT e usar getters locais desloca o dia.

/* ============================================================
   Status do formulário (database/migrations/V1__form_status.sql)
   ============================================================ */

export const STATUS_NAMES = {
    1: "Aguardando aprovação financeira",
    2: "Aguardando Agendamento de Entrevista",
    3: "Aguardando Aprovação da Entrevista",
    4: "Aguardando Aprovação da Gerência",
    5: "Aguardando Cadastro no Backoffice",
    6: "Finalizado",
    7: "Reprovado Pelo Financeiro",
    8: "Negociação Encerrada Financeiro",
    9: "Reprovado na Entrevista",
    10: "Negociação Encerrada Entrevista",
    11: "Reprovado pela Gerência",
    12: "Negociação Encerrada Gerência",
};

export const ACTIVE_IDS = [1, 2, 3, 4, 5];   // ainda no funil
export const FINALIZED_ID = 6;
export const REJECTED_IDS = [7, 9, 11];      // reprovado, ainda pode virar reanálise
export const CLOSED_IDS = [8, 10, 12];       // negociação encerrada pelo consultor

export const isActive = (form) => ACTIVE_IDS.includes(form?.form_status_id);
export const isFinalized = (form) => form?.form_status_id === FINALIZED_ID;
export const isRejected = (form) => REJECTED_IDS.includes(form?.form_status_id);
export const isClosed = (form) => CLOSED_IDS.includes(form?.form_status_id);

/* ============================================================
   Datas
   ============================================================ */

// created_at chega como "Mon, 21 Jul 2025 14:47:00 GMT" (padrão Flask)
export function parseDate(value) {
    if (!value) return null;
    const date = new Date(value);
    return isNaN(date.getTime()) ? null : date;
}

export function dayKey(date) {
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

export function monthKey(date) {
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

// converte um <input type="date"> (YYYY-MM-DD) para os limites UTC do dia
export function inputToUTCStart(value) {
    if (!value) return null;
    const [year, month, day] = value.split("-").map(Number);
    return Date.UTC(year, month - 1, day, 0, 0, 0);
}

export function inputToUTCEnd(value) {
    if (!value) return null;
    const [year, month, day] = value.split("-").map(Number);
    return Date.UTC(year, month - 1, day, 23, 59, 59, 999);
}

// diferença em dias entre dois campos de data; null quando qualquer ponta faltar
export function diffInDays(from, to) {
    const start = parseDate(from);
    const end = parseDate(to);
    if (!start || !end) return null;

    return (end.getTime() - start.getTime()) / 86400000;
}

export function ageInDays(value) {
    const start = parseDate(value);
    if (!start) return null;

    return (Date.now() - start.getTime()) / 86400000;
}

// period = { startMs, endMs } — qualquer uma das pontas pode ser null ("todo período").
// Sem nenhuma ponta a lista volta inteira, inclusive registros sem data: filtrar por
// período é um recorte opcional, não uma exigência de que o campo esteja preenchido.
export function filterByPeriod(list, field, period) {
    const startMs = period?.startMs ?? null;
    const endMs = period?.endMs ?? null;
    if (startMs === null && endMs === null) return list || [];

    return (list || []).filter((item) => {
        const date = parseDate(item?.[field]);
        if (!date) return false;

        const time = date.getTime();
        if (startMs !== null && time < startMs) return false;
        if (endMs !== null && time > endMs) return false;
        return true;
    });
}

// agrupa datas em dia ou mês (mês quando o intervalo passa de 92 dias) e preenche
// as lacunas, para a linha do tempo não "pular" períodos sem registro
export function bucketDates(dates) {
    const sorted = (dates || []).filter(Boolean).sort((a, b) => a - b);
    if (sorted.length === 0) return { keys: [], labels: [], byMonth: false };

    const first = sorted[0];
    const last = sorted[sorted.length - 1];
    const byMonth = (last - first) / 86400000 > 92;

    const keys = [];
    const cursor = new Date(Date.UTC(
        first.getUTCFullYear(),
        first.getUTCMonth(),
        byMonth ? 1 : first.getUTCDate()
    ));

    while (cursor <= last) {
        keys.push(byMonth ? monthKey(cursor) : dayKey(cursor));
        if (byMonth) cursor.setUTCMonth(cursor.getUTCMonth() + 1);
        else cursor.setUTCDate(cursor.getUTCDate() + 1);
    }

    const labels = keys.map((key) => {
        if (byMonth) {
            const [year, month] = key.split("-");
            return new Date(Date.UTC(Number(year), Number(month) - 1, 1))
                .toLocaleDateString("pt-BR", { month: "short", year: "2-digit", timeZone: "UTC" });
        }
        const [, month, day] = key.split("-");
        return `${day}/${month}`;
    });

    return { keys, labels, byMonth };
}

export function keyOfDate(date, byMonth) {
    return byMonth ? monthKey(date) : dayKey(date);
}

/* ============================================================
   Números
   ============================================================ */

// percentual com até duas casas decimais. Arredondar para inteiro escondia diferença
// real — 2 finalizados de 17 são 11,76%, não 12%.
export function pct(part, total) {
    if (!total) return 0;
    return Math.round((part / total) * 10000) / 100;
}

// formata um número já percentual no padrão pt-BR, sem zeros à direita: 11,76% / 50%
export function formatPercent(value) {
    if (value === null || value === undefined || !isFinite(value)) return "—";
    return `${value.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`;
}

// atalho para o caso mais comum: a razão entre duas contagens já formatada
export function percentOf(part, total) {
    return formatPercent(pct(part, total));
}

export function mean(values) {
    const clean = (values || []).filter((value) => typeof value === "number" && isFinite(value));
    if (clean.length === 0) return null;

    return clean.reduce((sum, value) => sum + value, 0) / clean.length;
}

export function median(values) {
    const clean = (values || [])
        .filter((value) => typeof value === "number" && isFinite(value))
        .sort((a, b) => a - b);
    if (clean.length === 0) return null;

    const middle = Math.floor(clean.length / 2);
    return clean.length % 2 ? clean[middle] : (clean[middle - 1] + clean[middle]) / 2;
}

export function formatDays(value) {
    if (value === null || value === undefined || !isFinite(value)) return "—";
    if (value < 1) return `${Math.round(value * 24)}h`;

    return `${value.toFixed(1).replace(".", ",")} d`;
}

export function formatNumber(value) {
    if (value === null || value === undefined || !isFinite(value)) return "—";
    return value.toLocaleString("pt-BR");
}

export function initials(name) {
    if (!name) return "?";

    const parts = String(name).trim().split(/\s+/);
    const first = parts[0]?.[0] || "";
    const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
    return (first + last).toUpperCase();
}

/* ============================================================
   Coleções
   ============================================================ */

export function countBy(list, keyFn) {
    const map = new Map();

    (list || []).forEach((item) => {
        const key = keyFn(item);
        if (key === null || key === undefined || key === "") return;
        map.set(key, (map.get(key) || 0) + 1);
    });

    return map;
}

export function groupBy(list, keyFn) {
    const map = new Map();

    (list || []).forEach((item) => {
        const key = keyFn(item);
        if (key === null || key === undefined || key === "") return;
        if (!map.has(key)) map.set(key, []);
        map.get(key).push(item);
    });

    return map;
}

// entradas de um Map ordenadas por valor decrescente, opcionalmente cortadas no topo
export function sortedEntries(map, limit) {
    const entries = [...map.entries()].sort((a, b) => b[1] - a[1]);
    return limit ? entries.slice(0, limit) : entries;
}

/* ============================================================
   Faixas
   ============================================================ */

export const AGE_BUCKETS = ["0-3 dias", "4-7 dias", "8-15 dias", "15+ dias"];

export function ageBucket(days) {
    if (days === null || days === undefined) return AGE_BUCKETS[0];
    if (days <= 3) return AGE_BUCKETS[0];
    if (days <= 7) return AGE_BUCKETS[1];
    if (days <= 15) return AGE_BUCKETS[2];
    return AGE_BUCKETS[3];
}

export const AGE_RANGES = ["0-17", "18-29", "30-39", "40-49", "50-59", "60+"];

export function ageRangeOf(birthDate) {
    const date = parseDate(birthDate);
    if (!date) return null;

    const years = (Date.now() - date.getTime()) / (365.25 * 86400000);
    if (years < 0 || years > 120) return null;
    if (years < 18) return AGE_RANGES[0];
    if (years < 30) return AGE_RANGES[1];
    if (years < 40) return AGE_RANGES[2];
    if (years < 50) return AGE_RANGES[3];
    if (years < 60) return AGE_RANGES[4];
    return AGE_RANGES[5];
}

export const MONTH_LABELS = [
    "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
    "Jul", "Ago", "Set", "Out", "Nov", "Dez",
];
