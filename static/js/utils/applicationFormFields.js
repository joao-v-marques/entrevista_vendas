// Definições de campo compartilhadas entre modais que exibem dados do contrato
// (formsModals/viewFormModal.js e rejectedFormsModals/requestReanalysisModal.js).
// Ficam num módulo à parte, sem nenhuma leitura de DOM, para que importar os arrays
// não arraste efeitos colaterais (querys de elementos que só existem no modal de origem).

export const FORM_FIELDS = [
    { label: "ID do Formulário", key: "id" },
    { label: "Status", key: "form_status_name" },
    { label: "Consultor", key: "consultant_name" },
    { label: "Data de Criação", key: "created_at", format: "datetime" },
    { label: "Tipo de Beneficiário", key: "beneficiary_type", format: "beneficiaryType" },
    { label: "Tipo de Inclusão", key: "inclusion_type" },
    { label: "Data de Inclusão", key: "inclusion_date", format: "date" },
    { label: "CNPJ", key: "cnpj", format: "cnpj" },
    { label: "Plano Anterior", key: "previous_plan" },
    { label: "Data de Cancelamento do Plano Anterior", key: "previous_plan_cancellation_date", format: "date" },
    { label: "Tipo de Contrato", key: "contract_type" },
    { label: "Tipo de Plano", key: "plan_type" },
    { label: "Modelo da Proposta", key: "model_proposal" },
    { label: "Mês de Vencimento", key: "expiration_month" },
    { label: "PA Digital", key: "is_pa_digital", format: "boolean" },
    { label: "Aeromédico", key: "is_aeromedic", format: "boolean" },
];

export const DISCOUNT_FIELDS = [
    { label: "Possui Desconto", key: "is_discount", format: "boolean" },
    { label: "Percentual do Desconto", key: "discount_percentage", format: "percentage" },
    { label: "Observação do Desconto", key: "discount_observation", full: true, pre: true },
];

export const BENEFICIARY_FIELDS = [
    { label: "Nome do Beneficiário", key: "beneficiary_name" },
    { label: "CPF", key: "beneficiary_cpf", format: "cpf" },
    { label: "Data de Nascimento", key: "beneficiary_birth_date", format: "date" },
    { label: "Telefone", key: "beneficiary_phone" },
    { label: "E-mail", key: "beneficiary_email" },
    { label: "E-mail de Cobrança", key: "billing_email" },
    { label: "Estado Civil", key: "beneficiary_marital_state" },
    { label: "Beneficiário Principal (titular)", key: "secondary_beneficiary_primary_name" },
    { label: "Parentesco", key: "secondary_beneficiary_kinship" },
];

export const PORTABILITY_FIELDS = [
    { label: "Possui Portabilidade", key: "is_portability", format: "boolean" },
    { label: "Portabilidade Aceita", key: "portability_accepted", format: "boolean" },
    { label: "Data de Aceite", key: "portability_accepted_date", format: "date" },
    { label: "Observação da Portabilidade", key: "portability_observation", full: true, pre: true },
];

export const OTHER_FIELDS = [
    { label: "Opção de Carência", key: "grace_option" },
    { label: "Observações Especiais", key: "especial_observations", full: true, pre: true },
];

// disponível só nas fichas que já passaram pela etapa de entrevista (join com application_form_interviews)
export const INTERVIEW_FIELDS = [
    { label: "Entrevistador", key: "interviewer_name" },
    { label: "Data da Entrevista", key: "interview_date", format: "datetime" },
    { label: "Observação do Agendamento", key: "schedule_observation", full: true, pre: true },
];
