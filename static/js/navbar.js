// navbar.js — comportamento dos dropdowns da navbar (Vendas, Financeiro, etc.)
(function () {
  const dropdowns = document.querySelectorAll('[data-dropdown]');

  function closeDropdown(dropdown) {
    const toggle = dropdown.querySelector('[data-dropdown-toggle]');
    dropdown.classList.remove('open');
    if (toggle) toggle.setAttribute('aria-expanded', 'false');
  }

  function closeAll(except) {
    dropdowns.forEach(function (dropdown) {
      if (dropdown !== except) closeDropdown(dropdown);
    });
  }

  dropdowns.forEach(function (dropdown) {
    const toggle = dropdown.querySelector('[data-dropdown-toggle]');
    if (!toggle) return;

    toggle.addEventListener('click', function (event) {
      event.stopPropagation();
      const wasOpen = dropdown.classList.contains('open');
      closeAll(dropdown);
      if (wasOpen) {
        closeDropdown(dropdown);
      } else {
        dropdown.classList.add('open');
        toggle.setAttribute('aria-expanded', 'true');
      }
    });
  });

  document.addEventListener('click', function (event) {
    dropdowns.forEach(function (dropdown) {
      if (!dropdown.contains(event.target)) closeDropdown(dropdown);
    });
  });

  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape') closeAll();
  });
})();

// navbar.js — logout
(function () {
  const btnLogout = document.getElementById('btnLogout');
  if (!btnLogout) return;

  btnLogout.addEventListener('click', async function () {
    btnLogout.disabled = true;

    try {
      await fetch('/entrevista-adesao/logout', {
        method: 'POST',
        credentials: 'same-origin',
      });
    } finally {
      window.location.href = '/entrevista-adesao/login';
    }
  });
})();
