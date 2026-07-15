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
