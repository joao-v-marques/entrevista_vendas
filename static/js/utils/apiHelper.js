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