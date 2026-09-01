// Helpers compartilhados pelos modais de visualização montados sobre
// GET /application-forms/<id>/details (formsModals/viewFormModal.js e
// completedInterviewModals/viewInterviewModal.js).
// Foram extraídos daqui para que os dois modais não mantenham cópias dos mesmos formatadores.

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
    if (format === "percentage") return `${(Number(value) * 100).toFixed(0)}%`;
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
