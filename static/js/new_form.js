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
    toggleCnpjField();
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

    // CNPJ, telefone e CPF mantêm a máscara na tela, mas são enviados só com os dígitos
    if (applicationFormData.cnpj) {
        applicationFormData.cnpj = applicationFormData.cnpj.replace(/\D/g, "");
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
    } catch (error) {
        notyf.error(error.message || "Houve um erro ao cadastrar a ficha");
        console.log(error.message || "Houve um erro ao cadastrar a ficha");
        console.log(error);
    } finally {
        // restaura o botão ao estado normal, tanto no sucesso quanto no erro
        setSubmitting(false);
    }
});
