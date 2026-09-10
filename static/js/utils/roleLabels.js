// Rótulo e cor de pill de cada cargo, a partir do role_name que vem do backend.
//
// Os nomes seguem os mesmos cinco cargos que o navbar já exibe no menu do usuário
// (static/js/navbar.js), aqui em caixa normal porque cabem numa .pill de tabela.
// O navbar mantém a própria cópia por ser script clássico, e não módulo.
export const ROLE_LABELS = {
    administrator: "Administrador",
    director: "Diretoria",
    finance_employee: "Colaborador Financeiro",
    sales_employee: "Colaborador de Vendas",
    interview_employee: "Colaborador de Entrevistas",
};

export const ROLE_PILL_CLASSES = {
    administrator: "pill--purple",
    director: "pill--amber",
    finance_employee: "pill--teal",
    sales_employee: "pill--blue",
    interview_employee: "pill--gray",
};

// um cargo criado pela tela de Configurações não está nos mapas acima, então o
// fallback mostra o nome técnico cru em vez de esconder o cargo
export function getRoleLabel(roleName) {
    return ROLE_LABELS[roleName] || (roleName || "—");
}

export function getRolePillClass(roleName) {
    return ROLE_PILL_CLASSES[roleName] || "pill--gray";
}
