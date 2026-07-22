const form = document.getElementById("newMainForm");

// ! ========== Validação: CNPJ só aparece para "Novo Contrato" ==========
const tipoInclusaoSelect = document.getElementById("tipo_inclusao");
const cnpjGroup = document.getElementById("cnpj_empresa_group");
const cnpjInput = document.getElementById("cnpj_empresa");

function toggleCnpjField() {
    const isNovoContrato = tipoInclusaoSelect.value === "Novo Contrato";

    cnpjGroup.hidden = !isNovoContrato;
    // campo desabilitado não é incluído no FormData, então não é enviado ao backend
    cnpjInput.disabled = !isNovoContrato;

    if (!isNovoContrato) {
        cnpjInput.value = "";
    }
}

tipoInclusaoSelect.addEventListener("change", toggleCnpjField);
toggleCnpjField();

// ! ========== Máscara: CNPJ no padrão 00.000.000/0000-00, sem permitir mais ou menos dígitos ==========
function maskCnpj(digits) {
    let masked = digits.slice(0, 2);
    if (digits.length > 2) masked += "." + digits.slice(2, 5);
    if (digits.length > 5) masked += "." + digits.slice(5, 8);
    if (digits.length > 8) masked += "/" + digits.slice(8, 12);
    if (digits.length > 12) masked += "-" + digits.slice(12, 14);
    return masked;
}

cnpjInput.addEventListener("input", () => {
    const digits = cnpjInput.value.replace(/\D/g, "").slice(0, 14);
    cnpjInput.value = maskCnpj(digits);
});

// ! ========== Validação: Plano anterior só aparece para "Troca de Plano" ==========
const planoAnteriorGroup = document.getElementById("plano_anterior_group");
const planoAnteriorInput = document.getElementById("plano_anterior");

function togglePlanoAnteriorField() {
    const isTrocaDePlano = tipoInclusaoSelect.value === "Troca de Plano";

    planoAnteriorGroup.hidden = !isTrocaDePlano;
    // campo desabilitado não é incluído no FormData, então não é enviado ao backend
    planoAnteriorInput.disabled = !isTrocaDePlano;

    if (!isTrocaDePlano) {
        planoAnteriorInput.value = "";
    }
}

tipoInclusaoSelect.addEventListener("change", togglePlanoAnteriorField);
togglePlanoAnteriorField();

// ! ========== Máscara: Plano anterior no padrão 00/0000, sem permitir mais ou menos dígitos ==========
function maskPlanoAnterior(digits) {
    let masked = digits.slice(0, 2);
    if (digits.length > 2) masked += "/" + digits.slice(2, 6);
    return masked;
}

planoAnteriorInput.addEventListener("input", () => {
    const digits = planoAnteriorInput.value.replace(/\D/g, "").slice(0, 6);
    planoAnteriorInput.value = maskPlanoAnterior(digits);
});

// ! ========== Máscara: Mod./Prop. no mesmo padrão 00/0000 ==========
const modeloPropostaInput = document.getElementById("modelo_proposta");

modeloPropostaInput.addEventListener("input", () => {
    const digits = modeloPropostaInput.value.replace(/\D/g, "").slice(0, 6);
    modeloPropostaInput.value = maskPlanoAnterior(digits);
});

// ! ========== Máscara: Fone / Celular no padrão (00) 00000-0000, sem permitir mais ou menos dígitos ==========
const telefoneInput = document.getElementById("telefone");

function maskTelefone(digits) {
    let masked = "";

    if (digits.length > 0) masked += "(" + digits.slice(0, 2);
    if (digits.length > 2) masked += ") ";

    if (digits.length > 10) {
        // celular: 5 dígitos antes do hífen
        masked += digits.slice(2, 7);
        if (digits.length > 7) masked += "-" + digits.slice(7, 11);
    } else if (digits.length > 2) {
        // fixo: 4 dígitos antes do hífen
        masked += digits.slice(2, 6);
        if (digits.length > 6) masked += "-" + digits.slice(6, 10);
    }

    return masked;
}

telefoneInput.addEventListener("input", () => {
    const digits = telefoneInput.value.replace(/\D/g, "").slice(0, 11);
    telefoneInput.value = maskTelefone(digits);
});

// ! ========== Validação: Valor e observações do desconto só aparecem se "Possui desconto?" for SIM ==========
const isDiscountSelect = document.getElementById("is_discount_id");
const discountGroup = document.getElementById("discount_group");
const discountInput = document.getElementById("discount_id");
const discountObservationGroup = document.getElementById("discount_observation_group");
const discountObservationInput = document.getElementById("discount_observation_id");

function toggleDiscountField() {
    const hasDiscount = isDiscountSelect.value === "true";

    discountGroup.hidden = !hasDiscount;
    discountObservationGroup.hidden = !hasDiscount;
    // campo desabilitado não é incluído no FormData, então não é enviado ao backend
    discountInput.disabled = !hasDiscount;
    discountObservationInput.disabled = !hasDiscount;

    if (!hasDiscount) {
        discountInput.value = "";
        discountObservationInput.value = "";
    }
}

isDiscountSelect.addEventListener("change", toggleDiscountField);
toggleDiscountField();

// ! ========== Regra: "Existente" não possui desconto, então trava "Possui desconto?" em NÃO ==========
// Um select desabilitado não é incluído no FormData, então usamos um input hidden com o mesmo
// name para continuar enviando is_discount=false enquanto o select fica travado.
let isDiscountHiddenInput = null;

function toggleDiscountLock() {
    const isExistente = tipoInclusaoSelect.value === "Existente";

    if (isExistente) {
        // força NÃO e reflete nos campos dependentes de desconto
        isDiscountSelect.value = "false";
        toggleDiscountField();

        // trava o select e garante o envio do valor via input hidden
        isDiscountSelect.disabled = true;
        if (!isDiscountHiddenInput) {
            isDiscountHiddenInput = document.createElement("input");
            isDiscountHiddenInput.type = "hidden";
            isDiscountHiddenInput.name = "is_discount";
            isDiscountSelect.insertAdjacentElement("afterend", isDiscountHiddenInput);
        }
        isDiscountHiddenInput.value = "false";
    } else {
        // reabilita a escolha do desconto
        isDiscountSelect.disabled = false;
        if (isDiscountHiddenInput) {
            isDiscountHiddenInput.remove();
            isDiscountHiddenInput = null;
        }
    }
}

tipoInclusaoSelect.addEventListener("change", toggleDiscountLock);
toggleDiscountLock();

// ! ========== Validação: campos de portabilidade só aparecem se "Realizar análise de portabilidade" for SIM ==========
const analisePortabilidadeSelect = document.getElementById("analise_portabilidade");
const portabilidadeAceitaGroup = document.getElementById("portabilidade_aceita_group");
const portabilidadeAceitaSelect = document.getElementById("portabilidade_aceita");
const dataAceiteGroup = document.getElementById("data_aceite_group");
const dataAceiteInput = document.getElementById("data_aceite");
const observacoesPortabilidadeGroup = document.getElementById("observacoes_portabilidade_group");
const observacoesPortabilidadeInput = document.getElementById("observacoes_portabilidade");

function togglePortabilidadeFields() {
    const realizarAnalise = analisePortabilidadeSelect.value === "true";

    portabilidadeAceitaGroup.hidden = !realizarAnalise;
    dataAceiteGroup.hidden = !realizarAnalise;
    observacoesPortabilidadeGroup.hidden = !realizarAnalise;

    // campo desabilitado não é incluído no FormData, então não é enviado ao backend
    portabilidadeAceitaSelect.disabled = !realizarAnalise;
    dataAceiteInput.disabled = !realizarAnalise;
    observacoesPortabilidadeInput.disabled = !realizarAnalise;

    // sempre reabre com "NÃO" selecionado por padrão, evitando o campo em branco
    portabilidadeAceitaSelect.value = "false";

    if (!realizarAnalise) {
        dataAceiteInput.value = "";
        observacoesPortabilidadeInput.value = "";
    }
}

analisePortabilidadeSelect.addEventListener("change", togglePortabilidadeFields);
togglePortabilidadeFields();

// ! ========== Múltiplos responsáveis pela inclusão ==========
const responsaveisInclusaoContainer = document.getElementById("responsaveisInclusaoContainer");
const responsavelInclusaoTemplate = document.getElementById("responsavelInclusaoTemplate");
const btnAddResponsavelInclusao = document.getElementById("btnAddResponsavelInclusao");

let responsavelInclusaoSeq = 0;

function renumberResponsaveisInclusao() {
    const cards = responsaveisInclusaoContainer.querySelectorAll(".responsavel-inclusao-card");

    cards.forEach((card, index) => {
        card.querySelector(".responsavel-index").textContent = index + 1;
        // não permite remover o único responsável restante
        card.querySelector(".btn-remove-responsavel").hidden = cards.length === 1;
    });
}

// ! ========== Máscara: CPF no padrão 000.000.000-00, sem permitir mais ou menos dígitos ==========
function maskCpf(digits) {
    let masked = digits.slice(0, 3);
    if (digits.length > 3) masked += "." + digits.slice(3, 6);
    if (digits.length > 6) masked += "." + digits.slice(6, 9);
    if (digits.length > 9) masked += "-" + digits.slice(9, 11);
    return masked;
}

// ! ========== Máscara: CPF do beneficiário (titular ou dependente, o campo é o mesmo) ==========
document.querySelectorAll('input[name="beneficiary_cpf"]').forEach((beneficiaryCpfInput) => {
    beneficiaryCpfInput.addEventListener("input", () => {
        const digits = beneficiaryCpfInput.value.replace(/\D/g, "").slice(0, 11);
        beneficiaryCpfInput.value = maskCpf(digits);
    });
});

// ! ========== Transformação: sempre em MAIÚSCULO e sem acento ==========
function toUpperNoAccent(value) {
    return value
        .normalize("NFD") // separa letras dos acentos
        .replace(/[̀-ͯ]/g, "") // remove os acentos
        .toUpperCase();
}

function bindUpperNoAccent(input) {
    input.addEventListener("input", () => {
        input.value = toUpperNoAccent(input.value);
    });
}

// Nome do beneficiário (titular ou dependente, o campo é o mesmo)
document.querySelectorAll('input[name="beneficiary_name"]').forEach(bindUpperNoAccent);

function addResponsavelInclusaoCard() {
    responsavelInclusaoSeq += 1;

    const fragment = responsavelInclusaoTemplate.content.cloneNode(true);
    const card = fragment.querySelector(".responsavel-inclusao-card");

    // gera ids únicos para cada campo clonado, mantendo o vínculo label/input
    card.querySelectorAll("[id], label[for]").forEach((el) => {
        if (el.id) el.id = el.id.replace("__INDEX__", responsavelInclusaoSeq);
        if (el.htmlFor) el.htmlFor = el.htmlFor.replace("__INDEX__", responsavelInclusaoSeq);
    });

    const cpfInput = card.querySelector('input[name="cpf[]"]');
    cpfInput.addEventListener("input", () => {
        const digits = cpfInput.value.replace(/\D/g, "").slice(0, 11);
        cpfInput.value = maskCpf(digits);
    });

    // Responsável pela inclusão e Profissão do responsável: sempre MAIÚSCULO e sem acento
    bindUpperNoAccent(card.querySelector('input[name="name[]"]'));
    bindUpperNoAccent(card.querySelector('input[name="profession[]"]'));

    card.querySelector(".btn-remove-responsavel").addEventListener("click", () => {
        card.remove();
        renumberResponsaveisInclusao();
    });

    responsaveisInclusaoContainer.appendChild(fragment);
    renumberResponsaveisInclusao();
}

btnAddResponsavelInclusao.addEventListener("click", addResponsavelInclusaoCard);

// garante que o formulário sempre comece com ao menos um responsável pela inclusão
addResponsavelInclusaoCard();