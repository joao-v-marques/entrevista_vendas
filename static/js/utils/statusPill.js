// Mapa compartilhado de status da ficha para o variant de .pill (ver static/css/global.css).
// Nasceu dentro de forms.js; foi extraído quando a listagem de entrevistas realizadas passou a
// exibir a etapa atual da ficha, para as duas telas não manterem cópias do mesmo mapa — se um
// status novo entrar em form_status, só este arquivo precisa saber.

export const STATUS_PILL_CLASSES = {
    "Aguardando aprovação financeira": "pill--gray",
    "Aguardando Agendamento de Entrevista": "pill--blue",
    "Aguardando Aprovação da Entrevista": "pill--purple",
    "Aguardando Aprovação da Gerência": "pill--amber",
    "Aguardando Cadastro no Backoffice": "pill--teal",
    "Finalizado": "pill--green",
    "Reprovado Pelo Financeiro": "pill--red",
    "Negociação Encerrada Financeiro": "pill--gray",
    // os quatro status de entrevista e gerência faltavam no mapa e caíam no cinza do
    // fallback, o que apagava a diferença entre "reprovado" e "negociação encerrada"
    "Reprovado na Entrevista": "pill--red",
    "Negociação Encerrada Entrevista": "pill--gray",
    "Reprovado pela Gerência": "pill--red",
    "Negociação Encerrada Gerência": "pill--gray",
};

export function getStatusPillClass(statusName) {
    return STATUS_PILL_CLASSES[statusName] || "pill--gray";
}
