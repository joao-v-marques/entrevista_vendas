// converte uma data no formato "Mon, 01 Jan 2001 00:00:00 GMT" (padrão do Flask/werkzeug) para "01/01/2001"
// Uso: colunas `date` (inclusion_date, birth_date...), que chegam como meia-noite GMT
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
// Uso: colunas `timestamptz` (interview_date, created_at, *_reviewed_at...)
export function formatDateTimeToBR(dateString) {
    if (!dateString) return "";

    const date = new Date(dateString);

    // usa getters locais: o Flask converte o timestamptz para GMT ao serializar,
    // então só o fuso de quem vê a tela devolve o horário em que foi cadastrado
    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const year = date.getFullYear();
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");

    return `${day}/${month}/${year} ${hours}:${minutes}`;
}

// só a data ("01/01/2001") de uma coluna `timestamptz`, no fuso local pelo mesmo motivo
// do formatDateTimeToBR — com getters UTC um registro feito após as 21h cairia no dia seguinte
export function formatTimestampDateToBR(dateString) {
    if (!dateString) return "";

    const date = new Date(dateString);

    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const year = date.getFullYear();

    return `${day}/${month}/${year}`;
}
