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
    'pendentes': ['administrator', 'director', 'finance_employee', 'sales_employee'],
    'dashboard': ['administrator', 'director'],
    'aprovar-ficha': ['administrator', 'director', 'finance_employee', 'sales_employee'],
    'fichas-reprovadas': ['administrator', 'director', 'finance_employee', 'sales_employee'],
    'agendar-entrevista': ['administrator', 'director', 'sales_employee'],
    'analisar-entrevista': ['administrator', 'director', 'sales_employee', 'interview_employee'],
    'entrevistas-realizadas': ['administrator', 'director', 'sales_employee'],
    'fichas-reprovadas-entrevista': ['administrator', 'director', 'sales_employee'],
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

// navbar.js — alterar a própria senha (item "Alterar senha" do menu do usuário)
// O modal é montado aqui, uma vez só, para não repetir o markup em todos os templates.
(function () {
  const btnOpen = document.getElementById('btnOpenOwnPassword');
  if (!btnOpen) return;

  const SENHA_TAMANHO_MINIMO = 8; // mesmo valor do backend (users_services.py)

  const EYE_ICON = '<svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M1.5 9S4.2 3.5 9 3.5 16.5 9 16.5 9 13.8 14.5 9 14.5 1.5 9 1.5 9z" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" /><circle cx="9" cy="9" r="2.4" stroke="currentColor" stroke-width="1.4" /></svg>';

  const overlay = document.createElement('div');
  overlay.className = 'pwd-modal-overlay';
  overlay.id = 'ownPasswordModalOverlay';
  overlay.hidden = true;
  overlay.innerHTML =
    '<div class="pwd-modal" role="dialog" aria-modal="true" aria-labelledby="ownPasswordModalTitle">' +
      '<div class="pwd-modal-header">' +
        '<div>' +
          '<h2 class="pwd-modal-title" id="ownPasswordModalTitle">Alterar minha senha</h2>' +
          '<span class="pwd-modal-subtitle" id="ownPasswordUserLabel"></span>' +
        '</div>' +
        '<button type="button" class="pwd-modal-close" data-close aria-label="Fechar">' +
          '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 3l10 10M13 3L3 13" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" /></svg>' +
        '</button>' +
      '</div>' +
      '<form id="ownPasswordForm" novalidate>' +
        '<div class="pwd-modal-body">' +
          '<p class="pwd-modal-notice">' +
            '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6.3" stroke="currentColor" stroke-width="1.4"/><path d="M8 7.2v3.8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><circle cx="8" cy="5" r="0.9" fill="currentColor"/></svg>' +
            '<span>Depois de salvar, você será desconectado e precisará entrar novamente com a nova senha.</span>' +
          '</p>' +
          '<div class="form-group">' +
            '<label class="form-label required" for="ownPassword">Nova senha</label>' +
            '<div class="password-field">' +
              '<input type="password" id="ownPassword" name="password" class="input" placeholder="Digite a nova senha" autocomplete="new-password" />' +
              '<button type="button" class="password-toggle" data-target="ownPassword" aria-label="Mostrar senha" aria-pressed="false">' + EYE_ICON + '</button>' +
            '</div>' +
          '</div>' +
          '<div class="form-group">' +
            '<label class="form-label required" for="ownPasswordConfirm">Confirmar nova senha</label>' +
            '<div class="password-field">' +
              '<input type="password" id="ownPasswordConfirm" name="password_confirm" class="input" placeholder="Repita a nova senha" autocomplete="new-password" />' +
              '<button type="button" class="password-toggle" data-target="ownPasswordConfirm" aria-label="Mostrar senha" aria-pressed="false">' + EYE_ICON + '</button>' +
            '</div>' +
          '</div>' +
          '<ul class="password-checklist" aria-live="polite">' +
            '<li data-rule="length"><span class="password-checklist-icon" aria-hidden="true"></span>Mínimo de 8 caracteres</li>' +
            '<li data-rule="match"><span class="password-checklist-icon" aria-hidden="true"></span>As senhas coincidem</li>' +
          '</ul>' +
        '</div>' +
        '<div class="pwd-modal-footer">' +
          '<button type="button" class="btn btn--ghost" data-close>Cancelar</button>' +
          '<button type="submit" class="btn btn--primary" disabled>Salvar e sair</button>' +
        '</div>' +
      '</form>' +
    '</div>';

  document.body.appendChild(overlay);

  const form = overlay.querySelector('#ownPasswordForm');
  const passwordInput = overlay.querySelector('#ownPassword');
  const confirmInput = overlay.querySelector('#ownPasswordConfirm');
  const submitButton = form.querySelector('[type="submit"]');
  const submitLabel = submitButton.innerHTML;
  let isSaving = false;

  // trava a rolagem do fundo; em Configurações o modalControl.js também usa essa classe,
  // então só destrava se nenhum outro modal da página continuar aberto
  function setScrollLock(locked) {
    const root = document.documentElement;
    if (locked) {
      const scrollbarWidth = window.innerWidth - root.clientWidth;
      root.classList.add('modal-open');
      if (scrollbarWidth > 0) root.style.paddingRight = scrollbarWidth + 'px';
      return;
    }
    if (document.querySelector('.modal-overlay:not([hidden])')) return;
    root.classList.remove('modal-open');
    root.style.paddingRight = '';
  }

  function resetToggles() {
    overlay.querySelectorAll('.password-toggle').forEach(function (button) {
      document.getElementById(button.dataset.target).type = 'password';
      button.setAttribute('aria-pressed', 'false');
      button.setAttribute('aria-label', 'Mostrar senha');
    });
  }

  // marca as regras atendidas e só libera o botão quando as duas estão ok
  function updateChecklist() {
    const rules = {
      length: passwordInput.value.length >= SENHA_TAMANHO_MINIMO,
      match: confirmInput.value !== '' && passwordInput.value === confirmInput.value,
    };

    overlay.querySelectorAll('.password-checklist li').forEach(function (li) {
      li.classList.toggle('is-met', rules[li.dataset.rule]);
    });

    if (!isSaving) submitButton.disabled = !(rules.length && rules.match);

    return rules.length && rules.match;
  }

  function setSaving(saving) {
    isSaving = saving;
    submitButton.classList.toggle('is-loading', saving);
    submitButton.innerHTML = saving
      ? '<span class="btn-spinner" aria-hidden="true"></span>Salvando...'
      : submitLabel;

    if (saving) {
      submitButton.disabled = true;
      submitButton.setAttribute('aria-busy', 'true');
    } else {
      submitButton.removeAttribute('aria-busy');
      updateChecklist();
    }
  }

  function openModal() {
    // fecha o dropdown do usuário e, no celular, o painel do menu
    const userDropdown = document.getElementById('navbarUser');
    if (userDropdown) {
      userDropdown.classList.remove('open');
      const toggle = userDropdown.querySelector('[data-dropdown-toggle]');
      if (toggle) toggle.setAttribute('aria-expanded', 'false');
    }
    const navbarToggle = document.getElementById('navbarToggle');
    const navbarRight = document.getElementById('navbarRight');
    if (navbarToggle && navbarRight && navbarRight.classList.contains('open')) navbarToggle.click();

    const userName = document.getElementById('navbarUserName');
    overlay.querySelector('#ownPasswordUserLabel').textContent = userName ? userName.textContent : '';

    form.reset();
    resetToggles();
    updateChecklist();

    overlay.hidden = false;
    setScrollLock(true);
    passwordInput.focus();
  }

  function closeModal() {
    if (isSaving) return;

    // senha não fica guardada no DOM depois que o modal fecha
    form.reset();
    resetToggles();
    updateChecklist();

    overlay.hidden = true;
    setScrollLock(false);
  }

  btnOpen.addEventListener('click', openModal);

  overlay.querySelectorAll('[data-close]').forEach(function (button) {
    button.addEventListener('click', closeModal);
  });

  // clique fora fecha, mas só se o clique começou e terminou no fundo
  // (mesma regra de utils/modalOverlay.js: arrastar a seleção de texto para fora não fecha)
  let startedOnOverlay = false;
  overlay.addEventListener('pointerdown', function (event) {
    startedOnOverlay = event.target === overlay;
  });
  overlay.addEventListener('click', function (event) {
    if (startedOnOverlay && event.target === overlay) closeModal();
    startedOnOverlay = false;
  });

  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape' && !overlay.hidden) closeModal();
  });

  passwordInput.addEventListener('input', updateChecklist);
  confirmInput.addEventListener('input', updateChecklist);

  overlay.querySelectorAll('.password-toggle').forEach(function (button) {
    button.addEventListener('click', function () {
      const input = document.getElementById(button.dataset.target);
      const isVisible = input.type === 'text';

      input.type = isVisible ? 'password' : 'text';
      button.setAttribute('aria-pressed', String(!isVisible));
      button.setAttribute('aria-label', isVisible ? 'Mostrar senha' : 'Ocultar senha');
    });
  });

  form.addEventListener('submit', async function (event) {
    event.preventDefault();

    // o botão já fica desabilitado, mas o Enter ainda dispara o submit
    if (isSaving || !updateChecklist()) return;

    setSaving(true);

    try {
      // sem trim: espaço pode fazer parte da senha
      const response = await fetch('/entrevista-adesao/me/change-password', {
        method: 'PATCH',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          password: passwordInput.value,
          password_confirm: confirmInput.value,
        }),
      });

      if (!response.ok) {
        const errorJSON = await response.json().catch(function () { return null; });
        throw new Error((errorJSON && errorJSON.message) || 'Houve um erro ao tentar alterar a senha');
      }

      // o backend já limpou o cookie da sessão; o login mostra o aviso de senha alterada
      window.location.href = '/entrevista-adesao/login?senha-alterada=1';
    } catch (error) {
      setSaving(false);
      notyf.error(error.message);
    }
  });
})();
