import { formatDateToBR } from "../utils/dateUtils.js";

const BENEFICIARY_FIELDS = [
    { label: "Nome do Beneficiário", key: "beneficiary_name" },
    { label: "CPF", key: "beneficiary_cpf" },
    { label: "Data de Nascimento", key: "beneficiary_birth_date", format: "date" },
    { label: "Telefone", key: "beneficiary_phone" },
    { label: "E-mail", key: "beneficiary_email" },
    { label: "E-mail de Cobrança", key: "billing_email" },
    { label: "CNPJ", key: "cnpj" },
    { label: "Consultor do Formulário", key: "consultant_name" },
];

function formatValue(value, format) {
    if (value === null || value === undefined || value === "") return "—";

    if (format === "date") return formatDateToBR(value);
    if (format === "boolean") return value ? "Sim" : "Não";
    if (format === "percentage") return `${(Number(value) * 100).toFixed(0)}%`;

    return value;
}

export function renderBeneficiaryInfo(container, applicationForm) {
    container.innerHTML = BENEFICIARY_FIELDS.map(field => `
        <div class="info-item">
            <span class="info-label">${field.label}</span>
            <span class="info-value">${formatValue(applicationForm[field.key], field.format)}</span>
        </div>
    `).join("");
}
