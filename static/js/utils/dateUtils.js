// converte uma data no formato "Mon, 01 Jan 2001 00:00:00 GMT" (padrão do Flask/werkzeug) para "01/01/2001"
export function formatDateToBR(dateString) {
    if (!dateString) return "";

    const date = new Date(dateString);

    // usa getters UTC porque a string já vem em GMT, evitando a data mudar
    // de acordo com o fuso horário local de quem está vendo a tela
    const day = String(date.getUTCDate()).padStart(2, "0");
    const month = String(date.getUTCMonth() + 1).padStart(2, "0");
    const year = date.getUTCFullYear();

    return `${day}/${month}/${year}`;
}

// converte uma data/hora no padrão do Flask/werkzeug para "01/01/2001 14:30"
export function formatDateTimeToBR(dateString) {
    if (!dateString) return "";

    const date = new Date(dateString);

    // usa getters UTC pelo mesmo motivo do formatDateToBR: manter a data/hora
    // exatamente como foi cadastrada, sem deslocamento de fuso horário
    const day = String(date.getUTCDate()).padStart(2, "0");
    const month = String(date.getUTCMonth() + 1).padStart(2, "0");
    const year = date.getUTCFullYear();
    const hours = String(date.getUTCHours()).padStart(2, "0");
    const minutes = String(date.getUTCMinutes()).padStart(2, "0");

    return `${day}/${month}/${year} ${hours}:${minutes}`;
}
