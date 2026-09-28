// theme.js — tema claro/escuro. Carregado sem defer no <head> de todas as páginas
// para aplicar o tema salvo antes do primeiro paint (sem "piscar" branco).
(function () {
  const STORAGE_KEY = 'theme';
  const root = document.documentElement;

  function readSaved() {
    try {
      return localStorage.getItem(STORAGE_KEY);
    } catch (error) {
      return null; // storage bloqueado: fica no padrão (claro)
    }
  }

  function apply(theme) {
    if (theme === 'dark') {
      root.dataset.theme = 'dark';
    } else {
      delete root.dataset.theme;
    }
  }

  apply(readSaved());

  let transitionTimer = null;

  window.appTheme = {
    get: function () {
      return root.dataset.theme === 'dark' ? 'dark' : 'light';
    },

    set: function (theme) {
      // anima só a troca, não o carregamento da página
      root.classList.add('theme-transition');
      clearTimeout(transitionTimer);
      transitionTimer = setTimeout(function () {
        root.classList.remove('theme-transition');
      }, 300);

      apply(theme);

      try {
        localStorage.setItem(STORAGE_KEY, theme === 'dark' ? 'dark' : 'light');
      } catch (error) {
        // sem storage o tema vale só até sair da página
      }

      document.dispatchEvent(new CustomEvent('themechange', { detail: { theme: this.get() } }));
    },
  };
})();
