// Renderização somente-leitura da entrevista qualificada (questionário de saúde + observações).
// Vivia dentro de completedInterviewModals/viewInterviewModal.js, mas aquele módulo lê o DOM do
// próprio modal ao ser importado. Como a análise da gerência precisa exibir exatamente o mesmo
// conteúdo, foi extraída para cá, sem nenhuma leitura de DOM (mesmo padrão de applicationFormFields.js).

import { escapeHtml, formatValue, renderInfoGrid, renderEmptySection } from "./detailsView.js";
import { QUALIFY_INTERVIEW_GROUPS } from "../analyzeInterviewModals/qualifyInterviewQuestions.js";
import {
    ESCOLHA_MEDICO_ORIENTADOR_LABELS,
    PARECER_UNIMED_LABELS,
    QUALIFY_QUESTIONS,
    formatImc,
} from "./qualifyInterview.js";

export function formatMeasure(value, unit) {
    if (value === null || value === undefined || value === "") return "—";
    return `${String(value).replace(".", ",")} ${unit}`;
}

// uma linha por pergunta; as respondidas "Sim" ganham destaque por serem o que importa numa consulta
function renderQualifyItem(item, qualifyInterview) {
    if (item.type === "measure") {
        return `
            <div class="view-qualify-item">
                <span class="view-qualify-item-label">${escapeHtml(item.label)}</span>
                <span class="view-qualify-item-answer">${escapeHtml(formatMeasure(qualifyInterview[item.key], item.unit))}</span>
            </div>
        `;
    }

    const answered = qualifyInterview[item.key] === true;

    return `
        <div class="view-qualify-item${answered ? " view-qualify-item--yes" : ""}">
            <span class="view-qualify-item-label">${escapeHtml(item.label)}</span>
            <span class="view-qualify-item-answer">${answered ? "Sim" : "Não"}</span>
        </div>
    `;
}

function renderQualifyGroup(group, qualifyInterview) {
    const declaredCount = group.items.filter(item => item.type !== "measure" && qualifyInterview[item.key] === true).length;

    const statusLabel = declaredCount > 0
        ? `<span class="view-qualify-group-status view-qualify-group-status--yes">${declaredCount} Sim</span>`
        : `<span class="view-qualify-group-status">Nenhuma</span>`;

    const rows = group.items.map(item => renderQualifyItem(item, qualifyInterview)).join("");

    // <details> nativo: o accordion abre e fecha sem nenhum JS de apoio
    return `
        <details class="view-qualify-group"${declaredCount > 0 ? " open" : ""}>
            <summary class="view-qualify-group-summary">
                <span class="view-qualify-group-number">${group.number}</span>
                <span class="view-qualify-group-title">${escapeHtml(group.title)}</span>
                ${statusLabel}
            </summary>
            <div class="view-qualify-group-body">${rows}</div>
        </details>
    `;
}

// resumo (parecer, orientador, medidas), contador de "Sim" e os grupos em accordion.
// Não embrulha em seção: quem chama decide o título
export function renderQualifyInterviewBody(qualifyInterview) {
    if (!qualifyInterview) {
        return renderEmptySection("Nenhuma entrevista qualificada registrada para esta entrevista.");
    }

    const summaryFields = [
        { label: "Parecer da Unimed", key: "parecer_unimed_label", full: true },
        { label: "Médico Orientador", key: "escolha_medico_orientador_label", full: true },
        { label: "Peso", key: "peso_label" },
        { label: "Altura", key: "altura_label" },
        { label: "IMC", key: "imc_label" },
        { label: "Registrado por", key: "inserted_by_name" },
        { label: "Registrado em", key: "created_at", format: "datetime" },
    ];

    // os rótulos legíveis são resolvidos antes para o grid genérico só ter que exibir texto
    const summarySource = {
        ...qualifyInterview,
        parecer_unimed_label: PARECER_UNIMED_LABELS[qualifyInterview.parecer_unimed] || qualifyInterview.parecer_unimed,
        escolha_medico_orientador_label: ESCOLHA_MEDICO_ORIENTADOR_LABELS[qualifyInterview.escolha_medico_orientador] || qualifyInterview.escolha_medico_orientador,
        peso_label: formatMeasure(qualifyInterview.peso_kg, "kg"),
        altura_label: formatMeasure(qualifyInterview.altura_cm, "cm"),
        imc_label: formatImc(qualifyInterview.peso_kg, qualifyInterview.altura_cm),
    };

    const declaredTotal = QUALIFY_QUESTIONS.filter(item => qualifyInterview[item.key] === true).length;

    const counter = `
        <p class="view-qualify-counter">
            <strong>${declaredTotal}</strong> de ${QUALIFY_QUESTIONS.length} perguntas respondidas com "Sim".
            Os grupos com alguma declaração já vêm abertos.
        </p>
    `;

    const groups = QUALIFY_INTERVIEW_GROUPS.map(group => renderQualifyGroup(group, qualifyInterview)).join("");

    return `
        ${renderInfoGrid(summarySource, summaryFields)}
        ${counter}
        <div class="view-qualify-groups">${groups}</div>
    `;
}

// as observações da entrevista, cada uma identificada pela etapa em que foi escrita
export function renderInterviewObservations(interview, qualifyInterview) {
    const observations = [
        {
            label: "Observação do agendamento",
            hint: "escrita pelo consultor ao agendar a entrevista",
            value: interview?.schedule_observation,
        },
        {
            label: "Observação do parecer Unimed",
            hint: "vai para o documento, na página do parecer reservado à Unimed",
            value: interview?.interview_observation,
        },
        {
            label: "Observação da entrevista qualificada",
            hint: "vai para o contrato: o beneficiário lê e confirma antes de assinar",
            value: qualifyInterview?.observation,
        },
        {
            label: "Comentários do beneficiário",
            hint: "vão para o documento, logo após o questionário de saúde",
            value: qualifyInterview?.beneficiary_comments,
        },
    ];

    const blocks = observations.map(observation => `
        <div class="view-observation">
            <p class="view-observation-label">${escapeHtml(observation.label)}</p>
            <p class="view-observation-hint">${escapeHtml(observation.hint)}</p>
            <p class="view-observation-text">${escapeHtml(formatValue(observation.value))}</p>
        </div>
    `).join("");

    return `<div class="view-observations">${blocks}</div>`;
}
