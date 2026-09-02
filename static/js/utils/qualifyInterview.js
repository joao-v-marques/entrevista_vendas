// Helpers compartilhados da entrevista qualificada (Declaração de Saúde).
// Os rótulos e o cálculo do IMC viviam dentro dos modais — o classifyImc chegou a existir em
// duas cópias idênticas (analyzeInterviewModal.js e viewInterviewModal.js). Como a listagem da
// gerência precisa dos mesmos três, foram extraídos para cá em vez de virarem a terceira cópia.

import { QUALIFY_INTERVIEW_GROUPS } from "../analyzeInterviewModals/qualifyInterviewQuestions.js";

export const ESCOLHA_MEDICO_ORIENTADOR_LABELS = {
    medico_unimed: "Com o médico orientador indicado pela Unimed",
    medico_proprio: "Médico de livre escolha, com ônus do proponente",
    dispensou_orientador: "Dispensou o médico orientador da operadora",
};

export const PARECER_UNIMED_LABELS = {
    sem_preexistencias: "Declaração SEM preexistências",
    com_preexistencias_aceitou_cpt: "Declaração COM preexistências — aceitou cumprir a CPT",
    com_preexistencias_recusou_cpt: "Declaração COM preexistências — recusou a CPT (cancelamento)",
    recusou_pericia_exames: "Recusou a perícia médica e/ou os exames solicitados (cancelamento)",
};

// versões curtas dos mesmos rótulos, para caberem em uma pílula de célula de tabela.
// Os longos continuam sendo o que os modais exibem, onde há espaço para a frase inteira.
export const PARECER_UNIMED_SHORT_LABELS = {
    sem_preexistencias: "Sem preexistências",
    com_preexistencias_aceitou_cpt: "Aceitou CPT",
    com_preexistencias_recusou_cpt: "Recusou CPT",
    recusou_pericia_exames: "Recusou perícia",
};

// a cor expressa a consequência, não a gravidade clínica: os dois pareceres que levam a
// cancelamento ficam em vermelho, o de CPT aceita em âmbar (segue, mas com carência)
export const PARECER_UNIMED_PILL_CLASSES = {
    sem_preexistencias: "pill--green",
    com_preexistencias_aceitou_cpt: "pill--amber",
    com_preexistencias_recusou_cpt: "pill--red",
    recusou_pericia_exames: "pill--red",
};

// os dois pareceres em que o beneficiário recusou algo e a negociação caminha para cancelamento
export const PARECER_UNIMED_REFUSED = new Set([
    "com_preexistencias_recusou_cpt",
    "recusou_pericia_exames",
]);

// todas as perguntas booleanas do questionário, sem as medidas (peso/altura), achatadas
// em uma lista só. A "key" de cada item é 1:1 com a coluna da tabela qualify_interviews.
export const QUALIFY_QUESTIONS = QUALIFY_INTERVIEW_GROUPS.flatMap(
    group => group.items.filter(item => item.type !== "measure")
);

export function classifyImc(imc) {
    if (imc < 18.5) return "Abaixo do peso";
    if (imc < 25) return "Normal";
    if (imc < 30) return "Sobrepeso";
    if (imc < 35) return "Obesidade Grau I";
    if (imc < 40) return "Obesidade Grau II";
    return "Obesidade Grau III";
}

export function formatImc(pesoKg, alturaCm) {
    const peso = Number(pesoKg);
    const altura = Number(alturaCm);
    if (!peso || !altura) return "—";

    const alturaM = altura / 100;
    const imc = peso / (alturaM * alturaM);

    return `${imc.toFixed(1).replace(".", ",")} — ${classifyImc(imc)}`;
}

// as condições declaradas "Sim", já com o rótulo de cada uma — é o que a listagem da gerência
// conta na coluna de preexistência e lista no tooltip
export function getDeclaredConditions(qualifyInterview) {
    if (!qualifyInterview) return [];

    return QUALIFY_QUESTIONS.filter(item => qualifyInterview[item.key] === true);
}
