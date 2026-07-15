// ! ========== Consultor: sempre o usuário logado, sem opção de edição ==========
(function () {
  const consultorDisplay = document.getElementById("consultor_display");
  const consultantIdInput = document.getElementById("consultant_id");

  if (!consultorDisplay || !consultantIdInput) return;

  fetch("/entrevista-adesao/me", {
    method: "GET",
    credentials: "same-origin",
  })
    .then((response) => {
      if (!response.ok) throw new Error("Não autenticado");
      return response.json();
    })
    .then((user) => {
      consultorDisplay.value = user.name || user.username || "Usuário";
      consultantIdInput.value = user.id;
    })
    .catch(() => {
      consultorDisplay.value = "Não foi possível identificar o usuário";
    });
})();

form.addEventListener("submit", async (event) => {
  event.preventDefault(); // impede o envio padrão do form

  // pega os dados do formulario
  const formData = new FormData(form);

  // agrupa os campos de múltiplos responsáveis pela inclusão em uma lista de objetos
  const responsavelInclusaoFields = [
    "name",
    "cpf",
    "marital_state",
    "profession",
  ];

  const responsaveisValores = Object.fromEntries(
    responsavelInclusaoFields.map((field) => [
      field,
      formData.getAll(`${field}[]`),
    ]),
  );

  const responsaveis_inclusao = responsaveisValores.name.map((_, index) => ({
    name: responsaveisValores.name[index],
    cpf: responsaveisValores.cpf[index],
    marital_state: responsaveisValores.marital_state[index],
    profession: responsaveisValores.profession[index],
  }));

  responsavelInclusaoFields.forEach((field) => formData.delete(`${field}[]`));

  // arquivos não podem ser serializados em JSON, então são extraídos separadamente
  const anexedDocs = formData
    .getAll("anexed_docs")
    .filter((file) => file.size > 0);
  formData.delete("anexed_docs");

  // transforma o restante em um objeto
  const data = Object.fromEntries(formData.entries());
  data.responsaveis_inclusao = responsaveis_inclusao;

  // transforma em json
  const jsonData = JSON.stringify(data);

  console.log(jsonData);
  console.log("Documentos anexados:", anexedDocs);
});
