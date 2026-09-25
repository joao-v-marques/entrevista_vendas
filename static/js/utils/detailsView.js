// Helpers compartilhados pelos modais de visualização montados sobre
// GET /application-forms/<id>/details (formsModals/viewFormModal.js e
// completedInterviewModals/viewInterviewModal.js).
// Foram extraídos daqui para que os dois modais não mantenham cópias dos mesmos formatadores.
// Também usados pelos modais de análise da gerência e do financeiro (KPIs, idade, callouts).

export function escapeHtml(value) {
    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

export function formatCPF(value) {
    const digits = String(value).replace(/\D/g, "");
    if (digits.length !== 11) return value;
    return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
}

export function formatCNPJ(value) {
    const digits = String(value).replace(/\D/g, "");
    if (digits.length !== 14) return value;
    return digits.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
}

// o telefone é gravado só com dígitos (new_form.js tira a máscara antes do POST),
// então quem exibe precisa remontá-la — com e sem o nono dígito
export function formatPhone(value) {
    const digits = String(value).replace(/\D/g, "");
    if (digits.length === 11) return digits.replace(/(\d{2})(\d{5})(\d{4})/, "($1) $2-$3");
    if (digits.length === 10) return digits.replace(/(\d{2})(\d{4})(\d{4})/, "($1) $2-$3");
    return value;
}

// usa getters UTC porque as datas chegam em GMT (padrão do Flask), evitando shift de fuso
export function formatDate(value) {
    const date = new Date(value);
    if (isNaN(date.getTime())) return value;

    const day = String(date.getUTCDate()).padStart(2, "0");
    const month = String(date.getUTCMonth() + 1).padStart(2, "0");
    const year = date.getUTCFullYear();

    return `${day}/${month}/${year}`;
}

export function formatDateTime(value) {
    const date = new Date(value);
    if (isNaN(date.getTime())) return value;

    const hours = String(date.getUTCHours()).padStart(2, "0");
    const minutes = String(date.getUTCMinutes()).padStart(2, "0");

    return `${formatDate(value)} ${hours}:${minutes}`;
}

export function formatBytes(value) {
    if (value === null || value === undefined || value === "") return "";
    const bytes = Number(value);
    if (isNaN(bytes)) return "";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// traduz o tipo de beneficiário armazenado no banco para o rótulo exibido
export function formatBeneficiaryType(value) {
    const normalized = String(value).trim().toLowerCase();
    if (normalized === "primary") return "Titular";
    if (normalized === "secondary") return "Dependente";
    return value;
}

export function formatValue(value, format) {
    if (value === null || value === undefined || value === "") return "—";

    if (format === "beneficiaryType") return formatBeneficiaryType(value);
    if (format === "date") return formatDate(value);
    if (format === "datetime") return formatDateTime(value);
    if (format === "boolean") return value ? "Sim" : "Não";
    if (format === "percentage") return `${(Number(value) * 100).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`;
    if (format === "cpf") return formatCPF(value);
    if (format === "cnpj") return formatCNPJ(value);
    if (format === "phone") return formatPhone(value);

    return value;
}

export function renderInfoItem(source, field) {
    const rawValue = source ? source[field.key] : null;
    const value = formatValue(rawValue, field.format);

    const itemClass = field.full ? "info-item info-item--full" : "info-item";
    const valueClass = field.pre ? "info-value info-value--pre" : "info-value";

    return `
        <div class="${itemClass}">
            <span class="info-label">${escapeHtml(field.label)}</span>
            <span class="${valueClass}">${escapeHtml(value)}</span>
        </div>
    `;
}

export function renderInfoGrid(source, fields) {
    return `<div class="info-grid">${fields.map(field => renderInfoItem(source, field)).join("")}</div>`;
}

export function renderSection(title, innerHtml) {
    return `
        <section class="modal-section">
            <h3 class="form-section-title">${escapeHtml(title)}</h3>
            ${innerHtml}
        </section>
    `;
}

// pílula de decisão para as etapas de aprovação
export function renderDecisionPill(approved) {
    if (approved === true) return `<span class="pill pill--green">Aprovado</span>`;
    if (approved === false) return `<span class="pill pill--red">Reprovado</span>`;
    return `<span class="pill pill--gray">Pendente</span>`;
}

export function renderEmptySection(message) {
    return `<p class="empty-section">${escapeHtml(message)}</p>`;
}

// idade em anos completos; usa getters UTC pelo mesmo motivo do formatDate (datas chegam em GMT)
export function calculateAge(birthDate) {
    if (!birthDate) return null;

    const birth = new Date(birthDate);
    if (isNaN(birth.getTime())) return null;

    const today = new Date();
    let age = today.getUTCFullYear() - birth.getUTCFullYear();

    const hadBirthdayThisYear =
        today.getUTCMonth() > birth.getUTCMonth() ||
        (today.getUTCMonth() === birth.getUTCMonth() && today.getUTCDate() >= birth.getUTCDate());

    if (!hadBirthdayThisYear) age -= 1;
    return age;
}

export function formatAge(birthDate) {
    const age = calculateAge(birthDate);
    if (age === null) return "—";
    return `${age} ${age === 1 ? "ano" : "anos"}`;
}

// destaca um texto longo em um bloco próprio, mais legível do que espremido em um item da grade
export function renderObservationCallout(label, text, isHighlighted = false) {
    const trimmedText = (text || "").trim();

    const body = trimmedText
        ? `<p class="observation-callout-text">${escapeHtml(trimmedText)}</p>`
        : `<p class="observation-callout-text observation-callout-text--empty">Nenhuma observação registrada.</p>`;

    return `
        <div class="observation-callout${isHighlighted ? " observation-callout--highlight" : ""}">
            <span class="observation-callout-label">${escapeHtml(label)}</span>
            ${body}
        </div>
    `;
}

// as mesmas etiquetas comerciais da tabela (desconto, portabilidade, PA digital, aeromédico)
export function renderCommercialTags(form) {
    const tags = [];

    if (form.is_discount) {
        const discount = formatValue(form.discount_percentage, "percentage");
        tags.push(`<span class="forms-tag forms-tag--discount">${discount !== "—" ? `${escapeHtml(discount)} desc.` : "Desconto"}</span>`);
    }
    if (form.is_portability) tags.push(`<span class="forms-tag forms-tag--portability">Portabilidade</span>`);
    if (form.is_pa_digital) tags.push(`<span class="forms-tag forms-tag--digital">PA Digital</span>`);
    if (form.is_aeromedic) tags.push(`<span class="forms-tag forms-tag--aero">Aeromédico</span>`);

    return tags.join("");
}

// cartão de indicador dos resumos dos modais de análise; value e foot já chegam em HTML (escapados por quem chama)
export function renderKpi({ label, value, foot = "", wide = false, full = false, alert = false, highlight = false, extra = "" }) {
    const classes = [
        "mgmt-kpi",
        wide ? "mgmt-kpi--wide" : "",
        full ? "mgmt-kpi--full" : "",
        alert ? "mgmt-kpi--alert" : "",
        highlight ? "mgmt-kpi--highlight" : "",
    ].filter(Boolean).join(" ");

    return `
        <div class="${classes}">
            <span class="mgmt-kpi-label">${escapeHtml(label)}</span>
            <span class="mgmt-kpi-value">${value}</span>
            ${foot ? `<span class="mgmt-kpi-foot">${foot}</span>` : ""}
            ${extra}
        </div>
    `;
}
