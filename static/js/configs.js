import { initUsersSection } from "./configsSections/usersSection.js";

// Cada seção da página registra aqui o seu inicializador. A chave é o data-section
// usado tanto no botão da sidebar quanto no painel correspondente.
const SECTION_INITIALIZERS = {
    usuarios: initUsersSection,
};

document.addEventListener("DOMContentLoaded", () => {
    const links = [...document.querySelectorAll(".configs-nav-link[data-section]")];
    const panels = [...document.querySelectorAll(".configs-section[data-section]")];

    function showSection(name) {
        links.forEach(link => {
            const active = link.dataset.section === name;
            link.classList.toggle("is-active", active);
            if (active) link.setAttribute("aria-current", "page");
            else link.removeAttribute("aria-current");
        });

        panels.forEach(panel => {
            panel.hidden = panel.dataset.section !== name;
        });
    }

    links.forEach(link => {
        link.addEventListener("click", () => showSection(link.dataset.section));
    });

    // O markup de todas as seções já está no DOM, então dá para inicializar tudo
    // de uma vez — trocar de seção depois é só mostrar/esconder painel.
    Object.values(SECTION_INITIALIZERS).forEach(init => init());

    showSection(links[0]?.dataset.section);
});
