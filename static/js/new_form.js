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

// ! ========== Helpers de envio: um POST JSON e um POST multipart (documentos) ==========
async function postJSON(url, payload) {
    const response = await fetch(url, {
        method: "POST",
        credentials: "same-origin",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
    });

    if (!response.ok) {
        const errorJSON = await response.json().catch(() => null);
        throw new Error(errorJSON?.message || `Erro ${response.status} ao enviar dados`);
    }

    return response.json();
}

async function postDocuments(applicationFormId, files) {
    const documentsFormData = new FormData();
    documentsFormData.append("application_form_id", applicationFormId);
    files.forEach((file) => documentsFormData.append("anexed_docs", file));

    const response = await fetch("/entrevista-adesao/application-form-documents", {
        method: "POST",
        credentials: "same-origin",
        body: documentsFormData,
    });

    if (!response.ok) {
        const errorJSON = await response.json().catch(() => null);
        throw new Error(errorJSON?.message || `Erro ${response.status} ao enviar documentos`);
    }

    return response.json();
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

// ! ========== Envio do formulário principal ==========
form.addEventListener("submit", async (event) => {
    event.preventDefault(); // impede o envio padrão do form

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

    try {
        // 1. cria o formulário principal e obtém o id gerado
        const createdApplicationForm = await postJSON("/entrevista-adesao/application-forms", applicationFormData);
        const applicationFormId = createdApplicationForm.id;

        // 2. cria cada responsável pela inclusão e os documentos, em paralelo
        await Promise.all([
            ...responsaveisInclusao.map((responsavel) =>
                postJSON("/entrevista-adesao/inclusion-responsibles", {
                    ...responsavel,
                    application_form_id: applicationFormId,
                })
            ),
            anexedDocs.length > 0 ? postDocuments(applicationFormId, anexedDocs) : Promise.resolve(),
        ]);

        notyf.success("Ficha cadastrada com sucesso");
        resetNewForm();
    } catch (error) {
        notyf.error(error.message || "Houve um erro ao cadastrar a ficha");
    }
});
