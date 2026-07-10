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