const form = document.getElementById("loginForm");
const loginError = document.getElementById("loginError");

// ! ========== Mostrar/ocultar senha ==========
const senhaInput = document.getElementById("login_senha");
const btnToggleSenha = document.getElementById("btnToggleSenha");

btnToggleSenha.addEventListener("click", () => {
    const isVisible = senhaInput.type === "text";

    senhaInput.type = isVisible ? "password" : "text";
    btnToggleSenha.setAttribute("aria-pressed", String(!isVisible));
    btnToggleSenha.setAttribute("aria-label", isVisible ? "Mostrar senha" : "Ocultar senha");
});

form.addEventListener("submit", async (event) => {
    event.preventDefault(); // impede o envio padrão do form

    loginError.classList.remove("visible");

    // pega os dados do formulario
    const formData = new FormData(form);
    const data = Object.fromEntries(formData.entries());

    // transforma em json
    const jsonData = JSON.stringify(data);

    // ! endpoint de autenticação ainda não existe no backend, lógica a ser implementada futuramente
    console.log(jsonData);
});
