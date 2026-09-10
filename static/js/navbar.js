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

// navbar.js — dados do usuário logado (nome e cargo) e filtro de acesso por role
(function () {
  const nameEl = document.getElementById('navbarUserName');
  const roleEl = document.getElementById('navbarUserRole');
  const avatarEl = document.getElementById('navbarAvatar');
  const navbarRight = document.getElementById('navbarRight');

  // rótulo exibido no menu do usuário
  const ROLE_LABELS = {
    administrator: 'ADMINISTRADOR',
    director: 'DIRETORIA',
    finance_employee: 'COLABORADOR FINANCEIRO',
    sales_employee: 'COLABORADOR DE VENDAS',
    interview_employee: 'COLABORADOR DE ENTREVISTAS',
  };

  // quem enxerga cada tela — espelha os @role_required das rotas de render.
  // Vale para qualquer elemento com data-page, não só os itens da navbar
  // (os atalhos da home usam os mesmos valores).
  const PAGE_ROLES = {
    'home': ['administrator', 'director', 'finance_employee', 'sales_employee', 'interview_employee'],
    'nova': ['administrator', 'director', 'sales_employee'],
    'pendentes': ['administrator', 'director', 'finance_employee', 'sales_employee', 'interview_employee'],
    'dashboard': ['administrator', 'director', 'sales_employee'],
    'aprovar-ficha': ['administrator', 'director', 'finance_employee', 'sales_employee'],
    'fichas-reprovadas': ['administrator', 'director', 'finance_employee', 'sales_employee'],
    'agendar-entrevista': ['administrator', 'director', 'sales_employee', 'interview_employee'],
    'analisar-entrevista': ['administrator', 'director', 'sales_employee', 'interview_employee'],
    'entrevistas-realizadas': ['administrator', 'director', 'sales_employee', 'interview_employee'],
    'fichas-reprovadas-entrevista': ['administrator', 'director', 'sales_employee', 'interview_employee'],
    'aprovar-gerencia': ['administrator', 'director', 'sales_employee'],
    'fichas-reprovadas-gerencia': ['administrator', 'director', 'sales_employee'],
    'configuracoes': ['administrator'],
  };

  // esconde o que a role não acessa; um dropdown sem nenhum item visível some junto
  function applyPagePermissions(role) {
    document.querySelectorAll('[data-page]').forEach(function (element) {
      const allowed = PAGE_ROLES[element.dataset.page];
      if (allowed && allowed.includes(role)) return;

      // na navbar some o <li> inteiro para não deixar buraco na lista;
      // fora dela (atalhos da home) some o próprio elemento
      const target = element.closest('li') || element;
      target.hidden = true;
    });

    document.querySelectorAll('.nav-dropdown[data-dropdown]').forEach(function (dropdown) {
      const menu = dropdown.querySelector('[data-dropdown-menu]');
      if (!menu) return;

      const items = menu.querySelectorAll('li:not(.nav-dropdown-divider)');
      if (!items.length) return;

      const visivel = Array.prototype.some.call(items, function (item) {
        return !item.hidden;
      });

      if (!visivel) dropdown.hidden = true;
    });
  }

  function revealNavbar() {
    if (navbarRight) navbarRight.classList.add('is-ready');
  }

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
      roleName = ROLE_LABELS[user.role_name] || "INDEFINIDO";

      applyPagePermissions(user.role_name);

      const displayName = user.name || user.username || 'Usuário';
      nameEl.textContent = displayName;
      roleEl.textContent = roleName || '—';
      if (avatarEl) avatarEl.textContent = getInitials(displayName);

      revealNavbar();
    })
    .catch(function () {
      // sem saber a role não dá para filtrar o menu, então ele fica oculto;
      // o token_required já redireciona para o login quando não há sessão
      nameEl.textContent = 'Usuário';
      roleEl.textContent = '—';
      if (avatarEl) avatarEl.textContent = '?';
    });
})();
