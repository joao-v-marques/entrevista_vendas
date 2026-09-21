const form = document.getElementById("loginForm");
const messageLogin = document.getElementById("messageLogin");
const submitButton = form.querySelector('[type="submit"]');
const submitButtonOriginalHTML = submitButton.innerHTML;

// quem acabou de trocar a própria senha chega aqui já desconectado (navbar.js);
// o parâmetro sai da URL para o aviso não repetir num F5
const loginParams = new URLSearchParams(window.location.search);
if (loginParams.has("senha-alterada")) {
    notyf.success("Senha alterada. Entre novamente com a nova senha.");
    loginParams.delete("senha-alterada");
    const query = loginParams.toString();
    history.replaceState(null, "", window.location.pathname + (query ? `?${query}` : "") + window.location.hash);
}

function setLoginSubmitting(isSubmitting) {
    submitButton.disabled = isSubmitting;
    submitButton.classList.toggle("is-loading", isSubmitting);
    submitButton.setAttribute("aria-busy", String(isSubmitting));
    submitButton.innerHTML = isSubmitting
        ? `<span class="btn-spinner" aria-hidden="true"></span>Entrando...`
        : submitButtonOriginalHTML;
}

// ! ========== Mostrar/ocultar senha ==========
const passwordInput = document.getElementById("password_id");
const btnToggleSenha = document.getElementById("btnToggleSenha");

btnToggleSenha.addEventListener("click", () => {
    const isVisible = passwordInput.type === "text";

    passwordInput.type = isVisible ? "password" : "text";
    btnToggleSenha.setAttribute("aria-pressed", String(!isVisible));
    btnToggleSenha.setAttribute("aria-label", isVisible ? "Mostrar senha" : "Ocultar senha");
});

form.addEventListener("submit", async (event) => {
    event.preventDefault(); // impede o envio padrão do form

    messageLogin.textContent = "";
    messageLogin.className = "";

    // pega os dados do formulario
    const formData = new FormData(form);
    let data = Object.fromEntries(formData.entries());

    // validação para remover todos os espaços em branco dos campos antes de enviar para o backend
    for (let key in data) {
        if (typeof data[key] === "string") {
            data[key] = data[key].trim();
        }
    }

    setLoginSubmitting(true);
    try {
        const response = await fetch("/entrevista-adesao/login", {
            method: "POST",
            credentials: "same-origin",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(data),
        });

        if (!response.ok) {
            let errorMessage = "Houve um erro ao tentar fazer login";

            try {
                const errorJSON = await response.json();

                if (errorJSON?.message) {
                    errorMessage = errorJSON.message;
                }

                throw new Error(errorMessage);
            } catch (error) {
                if (error instanceof SyntaxError) {
                    // resposta não é JSON, tenta ler como texto
                    errorMessage = `Erro ${response.status}: Falha ao fazer login`;
                } else {
                    errorMessage = error.message;
                }
            }

            throw new Error(errorMessage);
        }

        const tokenData = await response.json();
        localStorage.setItem("token", tokenData.token || "");
        window.location.href = "/entrevista-adesao/home";
        notyf.success("Login realizado com sucesso");
    } catch (error) {
        messageLogin.textContent = error.message || error;
        messageLogin.className = "error";
    } finally {
        setLoginSubmitting(false);
    }
});
