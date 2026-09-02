import { renderBeneficiaryInfo } from "../approveModals/beneficiaryInfoView.js";
import { fetchWithAuth, getLoggedUser } from "../utils/apiHelper.js";
import { formatDateTimeToBR } from "../utils/dateUtils.js";
import { populateAnalyzeInterviewTable } from "../analyze_interview.js";
import { QUALIFY_INTERVIEW_GROUPS, QUALIFY_INTERVIEW_TOTAL_ITEMS } from "./qualifyInterviewQuestions.js";
import { setSubmitLoading } from "../utils/submitLoading.js";
import { bindOverlayDismiss } from "../utils/modalOverlay.js";
import { classifyImc } from "../utils/qualifyInterview.js";

const overlay = document.getElementById("analyzeInterviewModalOverlay");
const formIdLabel = document.getElementById("analyzeInterviewModalFormId");
const beneficiaryInfoGrid = document.getElementById("analyzeInterviewBeneficiaryInfoGrid");
const scheduleInfoGrid = document.getElementById("analyzeInterviewScheduleObservations");
const interviewAnalysisForm = document.getElementById("interviewAnalysisForm");
const closeButton = document.getElementById("analyzeInterviewModalClose");
const cancelButton = document.getElementById("analyzeInterviewModalCancel");
const submitButton = document.getElementById("analyzeInterviewModalSubmit");
const decisionGroup = interviewAnalysisForm.querySelector(".decision-group");
const applicationFormIdInput = document.getElementById("analyze_interview_application_form_id");
const interviewerIdInput = document.getElementById("analyze_interview_interviewer_id");
const observationTextarea = document.getElementById("interviewObservation");
const observationPresets = document.getElementById("interviewObservationPresets");
const qualifyGroupsContainer = document.getElementById("qualifyInterviewGroups");
const qualifyProgressLabel = document.getElementById("qualifyInterviewProgress");
const orientadorGroup = document.getElementById("orientadorGroup");
const parecerGroup = document.getElementById("parecerGroup");
const parecerHint = document.getElementById("parecerHint");

// pareceres que só fazem sentido quando NÃO há preexistências declaradas, e vice-versa.
// "recusou_pericia_exames" fica sempre disponível: a perícia pode ser solicitada em qualquer caso.
const PARECER_SEM_PREEXISTENCIA = ["sem_preexistencias"];
const PARECER_COM_PREEXISTENCIA = ["com_preexistencias_aceitou_cpt", "com_preexistencias_recusou_cpt"];
// observação da entrevista qualificada (vai pro contrato); separada da observação interna acima
const qualifyObservationTextarea = document.getElementById("qualifyInterviewObservation");

// mapa key -> label, usado pra anexar/atualizar a linha de detalhe na observação da entrevista qualificada
const QUALIFY_ITEM_LABELS = new Map(
    QUALIFY_INTERVIEW_GROUPS.flatMap(group => group.items.map(item => [item.key, item.label]))
);

function closeModal() {
    overlay.hidden = true;
}

// anexa (ou remove) a frase pré-definida como uma linha própria das observações,
// preservando o que o usuário digitou manualmente
function toggleObservationPreset(presetText, isChecked) {
    // tira a linha da opção de onde ela estiver, evitando duplicidade ao remarcar
    const lines = observationTextarea.value.split("\n").filter(line => line.trim() !== presetText);

    if (isChecked) lines.push(presetText);

    // junta de volta e limpa linhas em branco sobrando no começo/fim
    observationTextarea.value = lines.join("\n").replace(/^\n+/, "").replace(/\n+$/, "");
}

// mantém os checkboxes coerentes com o texto: se o usuário apagar a frase na mão, a opção desmarca
function syncPresetsFromObservation() {
    const lines = observationTextarea.value.split("\n").map(line => line.trim());

    observationPresets.querySelectorAll("input[data-observation-text]").forEach(input => {
        input.checked = lines.includes(input.dataset.observationText);
    });
}

// renderiza a data agendada e a observação do agendamento da entrevista
function renderScheduleInfo(container, applicationForm) {
    const interviewDate = applicationForm.interview_date
        ? formatDateTimeToBR(applicationForm.interview_date)
        : "—";
    const scheduleObservation = applicationForm.schedule_observation || "—";

    container.innerHTML = `
        <div class="info-item">
            <span class="info-label">Data do agendamento da entrevista</span>
            <span class="info-value">${interviewDate}</span>
        </div>
        <div class="info-item info-item--wide">
            <span class="info-label">Observação do agendamento</span>
            <span class="info-value">${scheduleObservation}</span>
        </div>
    `;
}

// ---------- Questionário de saúde (qualify_interview) ----------

// anexa (ou atualiza/remove) uma linha de detalhe na observação da entrevista qualificada (a que vai pro contrato),
// identificada pelo label da pergunta
function updateObservationLine(label, detailText) {
    const prefix = `${label}:`;
    const lines = qualifyObservationTextarea.value.split("\n").filter(line => !line.startsWith(prefix));

    if (detailText && detailText.trim()) lines.push(`${prefix} ${detailText.trim()}`);

    qualifyObservationTextarea.value = lines.join("\n").replace(/^\n+/, "").replace(/\n+$/, "");
}

function buildQualifyItemRow(item) {
    const row = document.createElement("div");
    row.className = "qualify-item";
    row.dataset.itemKey = item.key;

    // peso/altura são numéricos (colunas peso_kg / altura_cm), não têm Sim/Não nem campo de detalhe
    if (item.type === "measure") {
        row.classList.add("qualify-item--measure");
        row.innerHTML = `
            <div class="qualify-item-main">
                <span class="qualify-item-label">${item.label}</span>
                <div class="qualify-measure-field">
                    <input type="number" class="input qualify-measure-input" name="${item.key}"
                        inputmode="decimal" step="${item.step}" min="${item.min}" max="${item.max}"
                        placeholder="${item.placeholder}" aria-label="${item.label} em ${item.unit}">
                    <span class="qualify-measure-unit">${item.unit}</span>
                </div>
            </div>
        `;
        return row;
    }

    row.innerHTML = `
        <div class="qualify-item-main">
            <span class="qualify-item-label">${item.label}</span>
            <div class="qualify-item-toggle" role="radiogroup" aria-label="${item.label}">
                <label class="qualify-toggle-option qualify-toggle-option--yes">
                    <input type="radio" name="${item.key}" value="true">
                    <span>Sim</span>
                </label>
                <label class="qualify-toggle-option qualify-toggle-option--no">
                    <input type="radio" name="${item.key}" value="false">
                    <span>Não</span>
                </label>
            </div>
        </div>
        <input type="text" class="input qualify-item-specification" data-specification-for="${item.key}" placeholder="Detalhes (opcional)..." hidden>
    `;

    return row;
}

function buildQualifyGroup(group) {
    const details = document.createElement("details");
    details.className = "qualify-group";
    details.dataset.groupNumber = group.number;

    const summary = document.createElement("summary");
    summary.className = "qualify-group-summary";
    summary.innerHTML = `
        <span class="qualify-group-number">${group.number}</span>
        <span class="qualify-group-title">${group.title}</span>
        <span class="qualify-group-status" data-group-status>0/${group.items.length}</span>
    `;

    const body = document.createElement("div");
    body.className = "qualify-group-body";
    group.items.forEach(item => body.appendChild(buildQualifyItemRow(item)));

    // o grupo com peso/altura ganha a linha do IMC (item H do formulário original), só exibição
    if (group.items.some(item => item.key === "peso_kg")) body.appendChild(buildImcRow());

    details.append(summary, body);
    return details;
}

// linha somente-leitura: não tem data-item-key, então não conta como pergunta nem vai pro payload
function buildImcRow() {
    const row = document.createElement("div");
    row.className = "qualify-item qualify-item--imc";
    row.innerHTML = `
        <div class="qualify-item-main">
            <span class="qualify-item-label">IMC (calculado a partir do peso e da altura)</span>
            <span class="qualify-imc-value" id="qualifyImcValue">—</span>
        </div>
    `;
    return row;
}

function updateImcDisplay() {
    const imcLabel = document.getElementById("qualifyImcValue");
    if (!imcLabel) return;

    const pesoKg = Number(qualifyGroupsContainer.querySelector('input[name="peso_kg"]')?.value);
    const alturaCm = Number(qualifyGroupsContainer.querySelector('input[name="altura_cm"]')?.value);

    if (!pesoKg || !alturaCm) {
        imcLabel.textContent = "—";
        return;
    }

    const alturaM = alturaCm / 100;
    const imc = pesoKg / (alturaM * alturaM);

    imcLabel.textContent = `${imc.toFixed(1).replace(".", ",")} — ${classifyImc(imc)}`;
}

function renderQualifyInterviewGroups() {
    const fragment = document.createDocumentFragment();
    QUALIFY_INTERVIEW_GROUPS.forEach(group => fragment.appendChild(buildQualifyGroup(group)));
    qualifyGroupsContainer.appendChild(fragment);
}

// conta itens preenchidos: radios marcados + medidas com valor (a linha do IMC não entra, não tem data-item-key)
function countAnswered(scope) {
    const checkedRadios = scope.querySelectorAll('.qualify-item-toggle input[type="radio"]:checked').length;
    const filledMeasures = [...scope.querySelectorAll(".qualify-measure-input")]
        .filter(input => input.value.trim() !== "").length;

    return checkedRadios + filledMeasures;
}

function updateGroupProgress(groupEl) {
    const total = groupEl.querySelectorAll(".qualify-item[data-item-key]").length;
    const answered = countAnswered(groupEl);

    groupEl.querySelector("[data-group-status]").textContent = `${answered}/${total}`;
    groupEl.classList.toggle("qualify-group--complete", answered === total);
}

function updateOverallProgress() {
    qualifyProgressLabel.textContent = `${countAnswered(qualifyGroupsContainer)}/${QUALIFY_INTERVIEW_TOTAL_ITEMS} perguntas respondidas`;
}

// ---------- Parecer da Unimed ----------

function countDeclaredConditions() {
    return qualifyGroupsContainer.querySelectorAll('.qualify-item-toggle input[value="true"]:checked').length;
}

// libera só os pareceres coerentes com o questionário: sem nenhuma doença marcada "Sim" não faz
// sentido um parecer "COM Preexistências", e com alguma marcada não faz sentido o "SEM Preexistências"
function updateParecerOptions() {
    const declaredCount = countDeclaredConditions();
    const blocked = declaredCount > 0 ? PARECER_SEM_PREEXISTENCIA : PARECER_COM_PREEXISTENCIA;

    parecerGroup.querySelectorAll('input[name="parecer_unimed"]').forEach(radio => {
        const isBlocked = blocked.includes(radio.value);

        radio.disabled = isBlocked;
        // se o questionário mudou depois da escolha, a opção que virou inválida é desmarcada
        if (isBlocked && radio.checked) radio.checked = false;
    });

    parecerHint.textContent = declaredCount > 0
        ? `${declaredCount} preexistência${declaredCount > 1 ? "s" : ""} declarada${declaredCount > 1 ? "s" : ""} no questionário — o parecer "SEM Preexistências" fica indisponível.`
        : `Nenhuma preexistência declarada no questionário — os pareceres "COM Preexistências" ficam indisponíveis.`;
}

// desmarca tudo, esconde/limpa campos de detalhe e medidas e zera contadores (chamado toda vez que o modal abre)
function resetQualifyInterviewUI() {
    qualifyGroupsContainer.querySelectorAll('input[type="radio"]').forEach(radio => { radio.checked = false; });
    qualifyGroupsContainer.querySelectorAll(".qualify-item-specification").forEach(input => {
        input.hidden = true;
        input.value = "";
    });
    qualifyGroupsContainer.querySelectorAll(".qualify-measure-input").forEach(input => { input.value = ""; });
    qualifyGroupsContainer.querySelectorAll(".qualify-item--invalid").forEach(row => row.classList.remove("qualify-item--invalid"));
    qualifyGroupsContainer.querySelectorAll(".qualify-group").forEach(groupEl => {
        groupEl.open = false;
        groupEl.classList.remove("qualify-group--missing");
        updateGroupProgress(groupEl);
    });
    updateImcDisplay();
    updateOverallProgress();
    updateParecerOptions();
}

// lê o estado atual dos toggles/medidas; retorna as respostas e a lista de itens pendentes ou inválidos
function collectQualifyInterviewAnswers() {
    const answers = {};
    const missing = [];

    QUALIFY_INTERVIEW_GROUPS.forEach(group => {
        group.items.forEach(item => {
            if (item.type === "measure") {
                const input = qualifyGroupsContainer.querySelector(`input[name="${item.key}"]`);
                const value = Number(input.value.trim());

                // vazio, não numérico ou fora da faixa esperada conta como pendente
                if (!input.value.trim() || Number.isNaN(value) || value < item.min || value > item.max) {
                    missing.push(item);
                } else {
                    answers[item.key] = value;
                }
                return;
            }

            const checked = qualifyGroupsContainer.querySelector(`input[name="${item.key}"]:checked`);
            if (!checked) {
                missing.push(item);
            } else {
                answers[item.key] = checked.value === "true";
            }
        });
    });

    return { answers, missing };
}

qualifyGroupsContainer.addEventListener("change", (event) => {
    const radio = event.target.closest('input[type="radio"]');
    if (!radio) return;

    const row = radio.closest(".qualify-item");
    const specInput = row.querySelector(".qualify-item-specification");
    const isYes = radio.value === "true";

    specInput.hidden = !isYes;
    if (!isYes) {
        specInput.value = "";
        updateObservationLine(QUALIFY_ITEM_LABELS.get(radio.name), "");
    }

    const groupEl = row.closest(".qualify-group");
    groupEl.classList.remove("qualify-group--missing");
    updateGroupProgress(groupEl);
    updateOverallProgress();
    updateParecerOptions();
});

qualifyGroupsContainer.addEventListener("input", (event) => {
    const measureInput = event.target.closest(".qualify-measure-input");
    if (measureInput) {
        const row = measureInput.closest(".qualify-item");
        row.classList.remove("qualify-item--invalid");
        row.closest(".qualify-group").classList.remove("qualify-group--missing");

        updateImcDisplay();
        updateGroupProgress(row.closest(".qualify-group"));
        updateOverallProgress();
        return;
    }

    const specInput = event.target.closest(".qualify-item-specification");
    if (!specInput) return;

    updateObservationLine(QUALIFY_ITEM_LABELS.get(specInput.dataset.specificationFor), specInput.value);
});

orientadorGroup.addEventListener("change", () => {
    orientadorGroup.classList.remove("choice-group--missing");
});

parecerGroup.addEventListener("change", () => {
    parecerGroup.classList.remove("choice-group--missing");
});

decisionGroup.addEventListener("change", () => {
    decisionGroup.classList.remove("decision-group--missing");
});

renderQualifyInterviewGroups();
updateParecerOptions();

export function openAnalyzeInterviewModal(applicationForm) {
    formIdLabel.textContent = applicationForm.id;
    renderBeneficiaryInfo(beneficiaryInfoGrid, applicationForm);
    renderScheduleInfo(scheduleInfoGrid, applicationForm);
    interviewAnalysisForm.reset();
    resetQualifyInterviewUI();
    orientadorGroup.classList.remove("choice-group--missing");
    parecerGroup.classList.remove("choice-group--missing");
    decisionGroup.classList.remove("decision-group--missing");

    // preenche os campos ocultos que vão junto no envio pro backend
    applicationFormIdInput.value = applicationForm.id;
    interviewerIdInput.value = "";

    // o interviewer_id alimenta os DOIS registros que o backend grava na mesma transação
    // (a análise e o inserted_by da entrevista qualificada), então o envio fica travado até ele
    // chegar. O finally garante que o botão volte mesmo se o /me falhar — nesse caso quem
    // recusa o envio é a checagem no submit
    submitButton.disabled = true;
    getLoggedUser()
        .then(user => { interviewerIdInput.value = user?.id ?? ""; })
        .finally(() => { submitButton.disabled = false; });

    overlay.hidden = false;
}

function submitForm() {
    interviewAnalysisForm.addEventListener("submit", async (e) => {
        e.preventDefault();

        // o backend usa o interviewer_id também como inserted_by da entrevista qualificada.
        // Vazio aqui viraria usuário 0 e estouraria violação de chave estrangeira já dentro da
        // transação, depois das 146 perguntas preenchidas
        const interviewerId = Number(interviewerIdInput.value);
        if (!Number.isInteger(interviewerId) || interviewerId <= 0) {
            notyf.error("Não foi possível identificar o usuário logado. Recarregue a página e tente novamente.");
            return;
        }

        // exige que todas as perguntas do questionário de saúde tenham sido respondidas
        const { answers: qualifyInterviewAnswers, missing } = collectQualifyInterviewAnswers();
        if (missing.length > 0) {
            notyf.error(`Responda todas as perguntas do questionário de saúde (${missing.length} pendente${missing.length > 1 ? "s" : ""}).`);

            // destaca as medidas pendentes/inválidas, que não têm o par Sim/Não pra sinalizar sozinhas
            missing.filter(item => item.type === "measure").forEach(item => {
                qualifyGroupsContainer.querySelector(`[data-item-key="${item.key}"]`)?.classList.add("qualify-item--invalid");
            });

            const firstMissingRow = qualifyGroupsContainer.querySelector(`[data-item-key="${missing[0].key}"]`);
            const firstMissingGroup = firstMissingRow?.closest(".qualify-group");
            if (firstMissingGroup) {
                firstMissingGroup.open = true;
                firstMissingGroup.classList.add("qualify-group--missing");
            }
            firstMissingRow?.scrollIntoView({ behavior: "smooth", block: "center" });
            return;
        }

        // exige a escolha do médico orientador
        const orientadorChecked = orientadorGroup.querySelector('input[name="escolha_medico_orientador"]:checked');
        if (!orientadorChecked) {
            notyf.error("Selecione uma opção em Escolha do Médico Orientador.");
            orientadorGroup.classList.add("choice-group--missing");
            orientadorGroup.scrollIntoView({ behavior: "smooth", block: "center" });
            return;
        }

        // exige o parecer da Unimed (as opções incompatíveis com o questionário já vêm desabilitadas)
        const parecerChecked = parecerGroup.querySelector('input[name="parecer_unimed"]:checked');
        if (!parecerChecked) {
            notyf.error("Selecione uma opção em Parecer.");
            parecerGroup.classList.add("choice-group--missing");
            parecerGroup.scrollIntoView({ behavior: "smooth", block: "center" });
            return;
        }

        // exige a decisão da análise. Sem isso o formData não traz interview_approved, a
        // comparação com "true" daria false e a ficha seria reprovada silenciosamente — agora
        // num commit atômico junto com o questionário
        const decisionChecked = decisionGroup.querySelector('input[name="interview_approved"]:checked');
        if (!decisionChecked) {
            notyf.error("Informe se a entrevista foi aprovada ou reprovada.");
            decisionGroup.classList.add("decision-group--missing");
            decisionGroup.scrollIntoView({ behavior: "smooth", block: "center" });
            return;
        }

        // pega os dados do formulário
        const formData = new FormData(interviewAnalysisForm);

        // validação para remover espaços no inicio e final da string
        for (let [key, value] of formData.entries()) {
            if (typeof value === "string") {
                formData.set(key, value.trim());
            }
        }

        // monta o payload (remove as entradas soltas dos radios do questionário, da escolha do médico orientador
        // e do parecer, já consolidadas acima, e a observação da entrevista qualificada — vai tudo aninhado
        // dentro de qualify_interview)
        QUALIFY_ITEM_LABELS.forEach((_, key) => formData.delete(key));
        formData.delete("qualify_interview_observation");
        formData.delete("escolha_medico_orientador");
        formData.delete("parecer_unimed");

        const data = Object.fromEntries(formData.entries());
        data.application_form_id = Number(data.application_form_id);
        data.interviewer_id = Number(data.interviewer_id);
        data.interview_approved = decisionChecked.value === "true";
        data.interview_reviewed_at = new Date().toISOString();
        data.qualify_interview = {
            ...qualifyInterviewAnswers,
            escolha_medico_orientador: orientadorChecked.value,
            parecer_unimed: parecerChecked.value,
            observation: qualifyObservationTextarea.value.trim(),
        };

        // trava o botão durante o envio: a constraint UNIQUE já barra a duplicata no banco,
        // isso só evita que um duplo clique vire um 409 desnecessário na cara do usuário
        setSubmitLoading(submitButton, true);

        try {
            const response = await fetchWithAuth("/entrevista-adesao/application-form-interviews", {
                method: "PUT",
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            });

            if (!response.ok) {
                const errorJSON = await response.json().catch(() => null);
                const backendMessage = errorJSON?.message;

                // 409: a entrevista já foi analisada. O backend fez rollback, então nada foi
                // gravado em duplicidade — mas insistir aqui não leva a lugar nenhum, então
                // fechamos o modal e recarregamos a tabela pra linha sair da lista
                if (response.status === 409) {
                    notyf.error(backendMessage || "Esta entrevista já foi analisada.");
                    closeModal();
                    await populateAnalyzeInterviewTable();
                    return;
                }

                // 400: mensagem de validação do backend, já escrita para o usuário. Mostra como
                // veio e mantém o modal aberto, preservando tudo o que foi preenchido
                if (response.status === 400) {
                    notyf.error(backendMessage || "Dados inválidos na análise da entrevista.");
                    return;
                }

                // 500 e afins: a mensagem é texto cru de Python/Postgres, não vai para a tela
                console.error("Erro ao enviar a análise da entrevista:", response.status, backendMessage);
                notyf.error("Houve um erro ao enviar a análise. Tente novamente.");
                return;
            }

            closeModal();
            notyf.success("Análise da entrevista enviada com sucesso!");
            await populateAnalyzeInterviewTable();
        } catch (error) {
            // falha de rede ou erro ao processar a resposta
            console.error("Erro ao enviar a análise da entrevista:", error);
            notyf.error("Houve um erro ao enviar a análise. Tente novamente.");
        } finally {
            // reabilita sempre, para que o usuário consiga tentar de novo depois de um erro
            setSubmitLoading(submitButton, false);
        }
    });
}

observationPresets.addEventListener("change", (event) => {
    const presetInput = event.target.closest("input[data-observation-text]");
    if (presetInput) toggleObservationPreset(presetInput.dataset.observationText, presetInput.checked);
});

observationTextarea.addEventListener("input", syncPresetsFromObservation);

closeButton.addEventListener("click", closeModal);
cancelButton.addEventListener("click", closeModal);
bindOverlayDismiss(overlay, closeModal);
document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !overlay.hidden) closeModal();
});

document.addEventListener("DOMContentLoaded", () => {
    submitForm();
})
