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

// navbar.js — menu mobile (hambúrguer)
(function () {
  const toggle = document.getElementById('navbarToggle');
  const panel = document.getElementById('navbarRight');
  if (!toggle || !panel) return;

  function setOpen(isOpen) {
    toggle.classList.toggle('open', isOpen);
    panel.classList.toggle('open', isOpen);
    toggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
  }

  toggle.addEventListener('click', function (event) {
    event.stopPropagation();
    setOpen(!panel.classList.contains('open'));
  });

  window.addEventListener('resize', function () {
    if (window.innerWidth > 768 && panel.classList.contains('open')) {
      setOpen(false);
    }
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

// navbar.js — dados do usuário logado (nome e cargo)
(function () {
  const nameEl = document.getElementById('navbarUserName');
  const roleEl = document.getElementById('navbarUserRole');
  const avatarEl = document.getElementById('navbarAvatar');

  let roleName = "INDEFINIDO"

  if (!nameEl || !roleEl) return;

  function getInitials(fullName) {
    const parts = String(fullName || '').trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return '?';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  fetch('/entrevista-adesao/me', {
    method: 'GET',
    credentials: 'same-origin',
  })
    .then(function (response) {
      if (!response.ok) throw new Error('Não autenticado');
      return response.json();
    })
    .then(function (user) {
      if (user.role_name === "administrator") {
        roleName = "ADMINISTRADOR";
      } else if (user.role_name === "employee") {
        roleName = "FUNCIONÁRIO";
      } else {
        roleName = "INDEFINIDO";
      }

      const displayName = user.name || user.username || 'Usuário';
      nameEl.textContent = displayName;
      roleEl.textContent = roleName || '—';
      if (avatarEl) avatarEl.textContent = getInitials(displayName);
    })
    .catch(function () {
      nameEl.textContent = 'Usuário';
      roleEl.textContent = '—';
      if (avatarEl) avatarEl.textContent = '?';
    });
})();
