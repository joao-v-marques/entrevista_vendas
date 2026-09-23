import { formatDateToBR } from "../utils/dateUtils.js";

const BENEFICIARY_FIELDS = [
    { label: "Nome do Beneficiário", key: "beneficiary_name" },
    { label: "CPF", key: "beneficiary_cpf", format: "cpf" },
    { label: "Data de Nascimento", key: "beneficiary_birth_date", format: "date" },
    { label: "Telefone", key: "beneficiary_phone" },
    { label: "E-mail", key: "beneficiary_email" },
    { label: "E-mail de Cobrança", key: "billing_email" },
    { label: "CNPJ", key: "cnpj", format: "cnpj" },
    { label: "Consultor do Formulário", key: "consultant_name" },
];

function formatCPF(value) {
    const digits = String(value).replace(/\D/g, "");
    if (digits.length !== 11) return value;
    return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
}

function formatCNPJ(value) {
    const digits = String(value).replace(/\D/g, "");
    if (digits.length !== 14) return value;
    return digits.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
}

function formatValue(value, format) {
    if (value === null || value === undefined || value === "") return "—";

    if (format === "date") return formatDateToBR(value);
    if (format === "boolean") return value ? "Sim" : "Não";
    if (format === "percentage") return `${(Number(value) * 100).toFixed(0)}%`;
    if (format === "cpf") return formatCPF(value);
    if (format === "cnpj") return formatCNPJ(value);

    return value;
}

export function renderBeneficiaryInfo(container, applicationForm, extraFields = []) {
    container.innerHTML = [...BENEFICIARY_FIELDS, ...extraFields].map(field => `
        <div class="info-item">
            <span class="info-label">${field.label}</span>
            <span class="info-value">${formatValue(applicationForm[field.key], field.format)}</span>
        </div>
    `).join("");
}
