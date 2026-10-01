// ! ========== Consultor: sempre o usuário logado, sem opção de edição ==========
const consultorDisplay = document.getElementById("consultor_display");
const consultantIdInput = document.getElementById("consultant_id");

let currentConsultant = null;

if (consultorDisplay && consultantIdInput) {
    fetch("/entrevista-adesao/me", {
        method: "GET",
        credentials: "same-origin",
    })
        .then((response) => {
            if (!response.ok) throw new Error("Não autenticado");
            return response.json();
        })
        .then((user) => {
            currentConsultant = user;
            consultorDisplay.value = user.name || user.username || "Usuário";
            consultantIdInput.value = user.id;
        })
        .catch(() => {
            consultorDisplay.value = "Não foi possível identificar o usuário";
        });
}

// ! ========== Helper de envio: um POST multipart (form + responsáveis + documentos) ==========
// Timeout do envio. Como o cadastro inclui upload de documentos, damos uma folga
// generosa para conexões lentas; o objetivo é só cancelar requisições realmente travadas.
const SUBMIT_TIMEOUT_MS = 60000;

// Limite total dos documentos (20 MB). Deve ficar abaixo do MAX_CONTENT_LENGTH do
// backend (21 MB), que ainda conta os demais campos do form + overhead do multipart.
const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;

async function postForm(url, formData, timeoutMs = SUBMIT_TIMEOUT_MS) {
    // fetch não tem timeout nativo: se o servidor aceita a conexão mas nunca responde,
    // a Promise fica pendente para sempre (nem resolve, nem rejeita, nem cai no catch).
    // O AbortController + setTimeout cancelam o fetch nesse caso, transformando o
    // "trava e não lança" em um erro tratável.
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
        const response = await fetch(url, {
            method: "POST",
            credentials: "same-origin",
            // sem header Content-Type: o browser define o boundary do multipart automaticamente
            body: formData,
            signal: controller.signal,
        });

        if (!response.ok) {
            const errorJSON = await response.json().catch(() => null);
            throw new Error(errorJSON?.message || `Erro ${response.status} ao enviar dados`);
        }

        // await para que o timeout também cubra a leitura do corpo da resposta
        return await response.json();
    } catch (error) {
        // quando o abort dispara por timeout, o fetch rejeita com AbortError
        if (error.name === "AbortError") {
            throw new Error("A conexão demorou demais e o envio foi cancelado. Verifique sua internet e tente novamente.");
        }
        throw error;
    } finally {
        // sempre limpa o timer, evitando um abort tardio numa requisição futura
        clearTimeout(timeoutId);
    }
}

// ! ========== Reset completo do formulário após o cadastro, evitando duplicidade ==========
function resetNewForm() {
    form.reset();

    // remove os cards extras de responsáveis e deixa só um em branco
    responsaveisInclusaoContainer.innerHTML = "";
    addResponsavelInclusaoCard();

    // realinha os campos condicionais com o estado padrão dos selects após o reset
    toggleDocumentoContratanteFields();
    togglePlanoAnteriorField();
    toggleDiscountField();
    togglePortabilidadeFields();

    // form.reset() limpa o hidden do consultor (sem value padrão no HTML), então restauramos
    if (currentConsultant) {
        consultorDisplay.value = currentConsultant.name || currentConsultant.username || "Usuário";
        consultantIdInput.value = currentConsultant.id;
    }
}

// ! ========== Estado "enviando" do botão de envio ==========
const btnSubmitForm = document.getElementById("btnSubmitForm");
// guarda o conteúdo original do botão para restaurar depois do envio
const btnSubmitFormOriginalHTML = btnSubmitForm.innerHTML;

function setSubmitting(isSubmitting) {
    btnSubmitForm.disabled = isSubmitting;
    btnSubmitForm.classList.toggle("is-loading", isSubmitting);

    if (isSubmitting) {
        btnSubmitForm.innerHTML = `<span class="btn-spinner" aria-hidden="true"></span>Enviando...`;
    } else {
        btnSubmitForm.innerHTML = btnSubmitFormOriginalHTML;
    }
}

// ! ========== Modal "Lançar dependente para este titular?" ==========
const addDependentModalOverlay = document.getElementById("addDependentModalOverlay");
const addDependentModalText = document.getElementById("addDependentModalText");
const btnAddDependentYes = document.getElementById("addDependentYes");
const btnAddDependentNo = document.getElementById("addDependentNo");
const btnAddDependentClose = document.getElementById("addDependentModalClose");

// guarda o resolve da pergunta em aberto; Sim resolve true e qualquer outro fechamento resolve false
let resolveAddDependent = null;

function closeAddDependentModal(answer) {
    if (!resolveAddDependent) return;

    addDependentModalOverlay.hidden = true;
    document.documentElement.classList.remove("modal-open");

    const resolve = resolveAddDependent;
    resolveAddDependent = null;
    resolve(answer);
}

function askAddDependent(message) {
    addDependentModalText.textContent = message;
    addDependentModalOverlay.hidden = false;
    document.documentElement.classList.add("modal-open");
    btnAddDependentYes.focus();

    return new Promise((resolve) => {
        resolveAddDependent = resolve;
    });
}

btnAddDependentYes.addEventListener("click", () => closeAddDependentModal(true));
btnAddDependentNo.addEventListener("click", () => closeAddDependentModal(false));
btnAddDependentClose.addEventListener("click", () => closeAddDependentModal(false));
addDependentModalOverlay.addEventListener("click", (event) => {
    if (event.target === addDependentModalOverlay) closeAddDependentModal(false);
});
document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !addDependentModalOverlay.hidden) closeAddDependentModal(false);
});

// ! ========== Pré-preenchimento do dependente com os dados do titular ==========
// O titular é gravado no sessionStorage antes de redirecionar para o formulário de dependente,
// que lê, aplica e remove a chave (um F5 não reaplica os dados).
const DEPENDENT_PREFILL_KEY = "newFormDependentPrefill";

// dados do titular aplicados nesta página; permitem lançar vários dependentes em sequência
let activeDependentPrefill = null;

function buildDependentPrefill(applicationFormData, responsaveisInclusao) {
    const prefillFields = [
        "inclusion_type", "previous_plan", "previous_plan_cancellation_date", "cnpj", "caepf",
        "inclusion_date", "contract_type", "model_proposal", "plan_type", "expiration_month",
        "is_pa_digital", "is_aeromedic", "is_discount", "discount_percentage", "discount_observation",
        "billing_email", "is_portability", "portability_accepted", "portability_accepted_date",
        "portability_observation", "grace_option",
    ];

    const prefill = Object.fromEntries(prefillFields.map((field) => [field, applicationFormData[field] ?? ""]));
    prefill.primary_name = applicationFormData.beneficiary_name;
    prefill.responsibles = responsaveisInclusao;
    return prefill;
}

function setFieldValue(id, value) {
    const field = document.getElementById(id);
    if (field && value != null) field.value = value;
}

function setSelectAndNotify(select, value) {
    if (value == null || value === "") return;
    select.value = value;
    select.dispatchEvent(new Event("change"));
}

function applyDependentPrefill(data) {
    // a ordem importa: cada "change" dispara toggles que limpam/resetam os campos dependentes,
    // então os selects vêm primeiro e os valores dos campos condicionais depois

    // 1. tipo de inclusão (roda todos os toggles ligados a ele, inclusive a trava de desconto)
    setSelectAndNotify(tipoInclusaoSelect, data.inclusion_type);

    // 2. documento do contratante: CNPJ ou CAEPF
    setSelectAndNotify(documentoContratanteSelect, data.caepf ? "CAEPF" : "CNPJ");
    if (data.cnpj) cnpjInput.value = maskCnpj(data.cnpj);
    if (data.caepf) caepfInput.value = maskCaepf(data.caepf);

    // 3. dados do plano
    setFieldValue("plano_anterior", data.previous_plan);
    setFieldValue("data_cancelamento_plano_anterior", data.previous_plan_cancellation_date);
    setFieldValue("modelo_proposta", data.model_proposal);
    setFieldValue("data_inclusao", data.inclusion_date);
    setFieldValue("contratacao_titular", data.contract_type);
    setFieldValue("plano_dependente", data.plan_type);
    setFieldValue("vencimento", data.expiration_month);
    setFieldValue("pa_digital", data.is_pa_digital);
    setFieldValue("aeromedico", data.is_aeromedic);

    // 4. desconto ("Existente" já fica travado em NÃO pelo toggle do tipo de inclusão)
    if (data.inclusion_type !== "Existente") {
        setSelectAndNotify(isDiscountSelect, data.is_discount);
        setFieldValue("discount_id", data.discount_percentage);
        setFieldValue("discount_observation_id", data.discount_observation);
    }

    // 5. portabilidade (o toggle força "Portabilidade aceita" para NÃO, então vem antes dos valores)
    setSelectAndNotify(analisePortabilidadeSelect, data.is_portability);
    setFieldValue("portabilidade_aceita", data.portability_accepted);
    setFieldValue("data_aceite", data.portability_accepted_date);
    setFieldValue("observacoes_portabilidade", data.portability_observation);

    // 6. opção de carência
    form.querySelectorAll('input[name="grace_option"]').forEach((radio) => {
        radio.checked = radio.value === data.grace_option;
    });

    // 7. e-mail de cobrança e nome do titular
    setFieldValue("email_cobranca_id", data.billing_email);
    setFieldValue("titular_dependente", data.primary_name);

    // 8. responsáveis pela inclusão
    responsaveisInclusaoContainer.innerHTML = "";
    (data.responsibles || []).forEach((responsible) => {
        addResponsavelInclusaoCard();

        const cards = responsaveisInclusaoContainer.querySelectorAll(".responsavel-inclusao-card");
        const card = cards[cards.length - 1];

        card.querySelector('input[name="name[]"]').value = responsible.name || "";
        card.querySelector('input[name="cpf[]"]').value = maskCpf(responsible.cpf || "");
        if (responsible.marital_state) {
            card.querySelector('select[name="marital_state[]"]').value = responsible.marital_state;
        }
        // "Existente" desabilita e limpa a profissão no card, então só preenche quando habilitada
        const professionInput = card.querySelector('input[name="profession[]"]');
        if (!professionInput.disabled) professionInput.value = responsible.profession || "";
    });

    if (!responsaveisInclusaoContainer.children.length) {
        addResponsavelInclusaoCard();
    }
}

// ! ========== Envio do formulário principal ==========
form.addEventListener("submit", async (event) => {
    event.preventDefault(); // impede o envio padrão do form

    // indica visualmente que o envio começou e evita cliques/envios duplicados
    setSubmitting(true);

    // pega os dados do formulario
    const formData = new FormData(form);

    // agrupa os campos de múltiplos responsáveis pela inclusão em uma lista de objetos
    const responsavelInclusaoFields = ["name", "cpf", "marital_state", "profession"];

    const responsaveisValores = Object.fromEntries(
        responsavelInclusaoFields.map((field) => [field, formData.getAll(`${field}[]`)])
    );

    const responsaveisInclusao = responsaveisValores.name.map((_, index) => ({
        name: responsaveisValores.name[index],
        // CPF mantém a máscara na tela, mas é enviado só com os dígitos
        cpf: responsaveisValores.cpf[index].replace(/\D/g, ""),
        marital_state: responsaveisValores.marital_state[index],
        profession: responsaveisValores.profession[index],
    }));

    responsavelInclusaoFields.forEach((field) => formData.delete(`${field}[]`));

    // arquivos não podem ser serializados em JSON, então são extraídos separadamente
    const anexedDocs = formData.getAll("anexed_docs").filter((file) => file.size > 0);
    formData.delete("anexed_docs");

    // o restante vira o payload do formulário principal
    const applicationFormData = Object.fromEntries(formData.entries());

    // CNPJ, CAEPF, telefone e CPF mantêm a máscara na tela, mas são enviados só com os dígitos
    if (applicationFormData.cnpj) {
        applicationFormData.cnpj = applicationFormData.cnpj.replace(/\D/g, "");
    }
    if (applicationFormData.caepf) {
        applicationFormData.caepf = applicationFormData.caepf.replace(/\D/g, "");
    }
    if (applicationFormData.beneficiary_phone) {
        applicationFormData.beneficiary_phone = applicationFormData.beneficiary_phone.replace(/\D/g, "");
    }
    if (applicationFormData.beneficiary_cpf) {
        applicationFormData.beneficiary_cpf = applicationFormData.beneficiary_cpf.replace(/\D/g, "");
    }

    // documento é obrigatório (mínimo 1); barra o envio antes de chamar o backend
    if (anexedDocs.length === 0) {
        notyf.error("Anexe ao menos um documento para cadastrar a ficha.");
        setSubmitting(false);
        return;
    }

    // barra uploads acima do limite já no navegador, evitando subir arquivos à toa
    // só para o servidor recusar com 413 (o limite aqui casa com o MAX_CONTENT_LENGTH do backend)
    const totalDocsBytes = anexedDocs.reduce((total, file) => total + file.size, 0);
    if (totalDocsBytes > MAX_UPLOAD_BYTES) {
        const totalMb = (totalDocsBytes / (1024 * 1024)).toFixed(1);
        notyf.error(`Os documentos somam ${totalMb} MB e excedem o limite de 20 MB. Reduza os arquivos e tente novamente.`);
        setSubmitting(false);
        return;
    }

    try {
        // cadastro ATÔMICO em uma única requisição: ficha + responsáveis + documentos.
        // Se qualquer parte falhar, o backend faz rollback do banco e remove os arquivos
        // já gravados, evitando o cadastro de um registro sem os demais obrigatórios.
        const payload = new FormData();
        payload.append("form", JSON.stringify(applicationFormData));
        payload.append("responsibles", JSON.stringify(responsaveisInclusao));
        anexedDocs.forEach((file) => payload.append("anexed_docs", file));

        await postForm("/entrevista-adesao/application-forms/complete", payload);

        notyf.success("Ficha cadastrada com sucesso");
        resetNewForm();
        // libera o botão antes da pergunta, já que o envio terminou
        setSubmitting(false);

        // após o titular, oferece lançar um dependente já com os dados do plano e do titular
        if (applicationFormData.beneficiary_type === "primary") {
            const prefill = buildDependentPrefill(applicationFormData, responsaveisInclusao);
            const wantsDependent = await askAddDependent(
                "Deseja realizar a inserção de um beneficiário dependente para este titular?"
            );

            if (wantsDependent) {
                try {
                    sessionStorage.setItem(DEPENDENT_PREFILL_KEY, JSON.stringify(prefill));
                } catch {
                    notyf.error("Não foi possível carregar os dados do titular no formulário de dependente.");
                }
                window.location.href = btnAddDependentYes.dataset.dependentUrl;
            }
        // dependente vindo do fluxo do titular: oferece lançar outro para o mesmo titular
        } else if (activeDependentPrefill) {
            const wantsAnotherDependent = await askAddDependent(
                "Deseja realizar a inserção de outro beneficiário dependente para este titular?"
            );

            if (wantsAnotherDependent) {
                applyDependentPrefill(activeDependentPrefill);
                window.scrollTo({ top: 0, behavior: "smooth" });
            } else {
                activeDependentPrefill = null;
            }
        }
    } catch (error) {
        notyf.error(error.message || "Houve um erro ao cadastrar a ficha");
        console.log(error.message || "Houve um erro ao cadastrar a ficha");
        console.log(error);
    } finally {
        // restaura o botão ao estado normal, tanto no sucesso quanto no erro
        setSubmitting(false);
    }
});

// ! ========== Formulário de dependente aberto a partir do titular: aplica os dados salvos ==========
if (form.elements.beneficiary_type.value === "secondary") {
    let storedPrefill = null;

    try {
        storedPrefill = sessionStorage.getItem(DEPENDENT_PREFILL_KEY);
        sessionStorage.removeItem(DEPENDENT_PREFILL_KEY);
    } catch {
        storedPrefill = null;
    }

    if (storedPrefill) {
        try {
            activeDependentPrefill = JSON.parse(storedPrefill);
            applyDependentPrefill(activeDependentPrefill);
            notyf.success("Dados do plano e do titular carregados no formulário");
        } catch {
            activeDependentPrefill = null;
        }
    }
}
