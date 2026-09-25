// Controle das abas dos modais de análise (gerência e financeiro).
// Espera a marcação usada nos dois templates: botões .mgmt-tab[data-tab] dentro do tablist
// e painéis .mgmt-panel[data-tab] dentro do corpo do modal.

export function createModalTabs(tabList, modalBody) {
    const tabButtons = [...tabList.querySelectorAll(".mgmt-tab")];

    function setActiveTab(tabName, { focus = false } = {}) {
        tabButtons.forEach(button => {
            const isActive = button.dataset.tab === tabName;
            button.classList.toggle("is-active", isActive);
            button.setAttribute("aria-selected", String(isActive));
            button.tabIndex = isActive ? 0 : -1;
            if (isActive && focus) button.focus();
        });

        modalBody.querySelectorAll(".mgmt-panel").forEach(panel => {
            panel.hidden = panel.dataset.tab !== tabName;
        });

        modalBody.scrollTop = 0;
    }

    function getActiveTab() {
        return tabButtons.find(button => button.classList.contains("is-active"))?.dataset.tab;
    }

    function setTabCount(tabName, count, isAlert = false) {
        const badge = tabList.querySelector(`[data-tab-count="${tabName}"]`);
        if (!badge) return;

        badge.hidden = !count;
        badge.textContent = count ? String(count) : "";
        badge.classList.toggle("mgmt-tab-count--alert", Boolean(count) && isAlert);
    }

    tabList.addEventListener("click", (event) => {
        const button = event.target.closest(".mgmt-tab");
        if (button) setActiveTab(button.dataset.tab);
    });

    // setas ←/→ (e Home/End) navegam entre as abas, como pede o padrão ARIA de tablist
    tabList.addEventListener("keydown", (event) => {
        const currentIndex = tabButtons.findIndex(button => button.dataset.tab === getActiveTab());
        let nextIndex = null;

        if (event.key === "ArrowRight") nextIndex = (currentIndex + 1) % tabButtons.length;
        if (event.key === "ArrowLeft") nextIndex = (currentIndex - 1 + tabButtons.length) % tabButtons.length;
        if (event.key === "Home") nextIndex = 0;
        if (event.key === "End") nextIndex = tabButtons.length - 1;
        if (nextIndex === null) return;

        event.preventDefault();
        setActiveTab(tabButtons[nextIndex].dataset.tab, { focus: true });
    });

    return { setActiveTab, getActiveTab, setTabCount };
}
