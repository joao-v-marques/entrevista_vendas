form.addEventListener("submit", async (event) => {
    event.preventDefault(); // impede o envio padrão do form

    // pega os dados do formulario
    const formData = new FormData(form);

    // agrupa os campos de múltiplos responsáveis pela inclusão em uma lista de objetos
    const responsavelInclusaoFields = ["responsavel_inclusao", "cpf_responsavel_inclusao", "estado_civil_responsavel", "profissao_responsavel"];

    const responsaveisValores = Object.fromEntries(
        responsavelInclusaoFields.map((field) => [field, formData.getAll(`${field}[]`)])
    );

    const responsaveis_inclusao = responsaveisValores.responsavel_inclusao.map((_, index) => ({
        responsavel_inclusao: responsaveisValores.responsavel_inclusao[index],
        cpf_responsavel_inclusao: responsaveisValores.cpf_responsavel_inclusao[index],
        estado_civil_responsavel: responsaveisValores.estado_civil_responsavel[index],
        profissao_responsavel: responsaveisValores.profissao_responsavel[index],
    }));

    responsavelInclusaoFields.forEach((field) => formData.delete(`${field}[]`));

    // arquivos não podem ser serializados em JSON, então são extraídos separadamente
    const documentosAnexos = formData.getAll("documentos_anexos").filter((file) => file.size > 0);
    formData.delete("documentos_anexos");

    // transforma o restante em um objeto
    const data = Object.fromEntries(formData.entries());
    data.responsaveis_inclusao = responsaveis_inclusao;

    // transforma em json
    const jsonData = JSON.stringify(data);

    console.log(jsonData);
    console.log("Documentos anexados:", documentosAnexos);
});
