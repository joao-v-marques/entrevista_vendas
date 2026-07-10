const form = document.getElementById("novaFichaForm");

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

form.addEventListener("submit", async (event) => {
    event.preventDefault(); // impede o envio padrão do form

    // pega os dados do formulario
    const formData = new FormData(form);

    // transforma em um objeto
    const data = Object.fromEntries(formData.entries());

    // transforma em json
    const jsonData = JSON.stringify(data);

    console.log(jsonData);
});