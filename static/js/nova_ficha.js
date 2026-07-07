const form = document.getElementById("novaFichaForm");

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