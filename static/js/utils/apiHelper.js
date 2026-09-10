// a autenticação é feita via cookie httpOnly (setado no login), então o fetch só
// precisa garantir credentials: 'same-origin' para o cookie ser enviado junto
export function fetchWithAuth(url, options = {}) {
    return fetch(url, {
        ...options,
        credentials: 'same-origin',
    });
}

// função que retorna informações do usuário logado
export async function getLoggedUser() {
    try {
        const response = await fetchWithAuth("/entrevista-adesao/me");
    
        if (!response.ok) {
            throw new Error(await response.text());
        }

        const data = await response.json();

        return data;
    } catch (error) {
        console.log(error);
    }
}

// Extrai a mensagem de erro de uma resposta: o backend responde {"message": "..."}
// nos erros tratados, mas um 500 não tratado devolve HTML — daí o fallback.
export async function getErrorMessage(response, fallback) {
    const rawBody = await response.text();
    try {
        const json = JSON.parse(rawBody);
        return json?.message || fallback;
    } catch {
        return rawBody || fallback;
    }
}
