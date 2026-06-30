/**
 * Auditoría Interna OEA 2026 - C.I. Colombian Mint
 * Single Page Application - Fase 2 (Auth + Admin + Preguntas + Listados)
 */
const App = {
  currentView: 'dashboard',
  plan: null,
  requisitos: null,
  preguntas: null,
  listados: null,
  pendingAccounts: null,
  pendingLoginPassword: null,
  eventsBound: false,
  userMenuOpen: false,
  passwordChangeMode: 'required',

  async init() {
    Preferences.init();
    this.plan = Storage.getPlan();
    this.requisitos = Storage.getRequisitos();
    this.preguntas = Storage.getPreguntas();
    this.listados = Storage.getListados();
    this.hallazgos = Storage.getHallazgos();
    this.bindLoginEvents();

    await Auth.init();

    if (Auth.isLoggedIn()) {
      if (Auth.getUser()?.mustChangePassword) {
        this.showChangePassword('required');
      } else {
        this.showApp(!sessionStorage.getItem('oea_welcome_shown'));
      }
    } else {
      this.showLogin();
    }
  },

  showLogin() {
    document.getElementById('loginScreen').classList.remove('hidden');
    document.getElementById('changePasswordScreen').classList.add('hidden');
    document.getElementById('appShell').classList.add('hidden');
  },

  showChangePassword(mode = 'required') {
    this.passwordChangeMode = mode;
    document.getElementById('loginScreen').classList.add('hidden');
    document.getElementById('appShell').classList.add('hidden');
    document.getElementById('changePasswordScreen').classList.remove('hidden');

    const msg = document.getElementById('changePassMessage');
    const title = document.querySelector('#changePasswordScreen h2');
    const cancelBtn = document.getElementById('changePassCancelBtn');
    const submitBtn = document.getElementById('changePassSubmitBtn');

    if (mode === 'voluntary') {
      title.textContent = 'Cambiar mi contraseña';
      msg.textContent = 'Ingrese su contraseña actual y defina una nueva contraseña segura (mínimo 6 caracteres).';
      cancelBtn.classList.remove('hidden');
      submitBtn.textContent = 'Guardar contraseña';
    } else {
      title.textContent = 'Cambio de contraseña requerido';
      msg.textContent = Auth.getUserById(Auth.getUser()?.userId)?.password_temp
        ? 'Ingresó con una contraseña temporal. Defina su contraseña personal para continuar.'
        : 'Es su primer ingreso. Debe cambiar la contraseña inicial por una personal.';
      cancelBtn.classList.add('hidden');
      submitBtn.textContent = 'Guardar y continuar';
    }
    document.getElementById('changePassError').classList.add('hidden');
    document.getElementById('changePasswordForm').reset();

    const currentGroup = document.getElementById('currentPassGroup');
    const currentInput = document.getElementById('changeCurrentPass');
    if (mode === 'required' && this.pendingLoginPassword) {
      currentGroup.classList.add('hidden');
      currentInput.removeAttribute('required');
    } else {
      currentGroup.classList.remove('hidden');
      currentInput.setAttribute('required', '');
    }
  },

  showApp(showWelcome = true) {
    document.getElementById('loginScreen').classList.add('hidden');
    document.getElementById('changePasswordScreen').classList.add('hidden');
    document.getElementById('appShell').classList.remove('hidden');
    this.updateUserHeader();
    this.renderSidebarUserCard();
    this.renderIdentityBar();
    this.renderAppFooter();
    this.renderSidebar();
    this.bindEvents();
    this.navigate('dashboard');
    if (showWelcome && !sessionStorage.getItem('oea_welcome_shown')) {
      sessionStorage.setItem('oea_welcome_shown', '1');
      setTimeout(() => this.showWelcomeModal(), 400);
    }
  },

  bindLoginEvents() {
    document.getElementById('loginForm').addEventListener('submit', e => {
      e.preventDefault();
      this.handleLogin();
    });
    document.getElementById('changePasswordForm').addEventListener('submit', e => {
      e.preventDefault();
      this.handleChangePassword();
    });
    document.getElementById('changePassCancelBtn').addEventListener('click', () => {
      if (this.passwordChangeMode === 'voluntary') this.showApp(false);
    });
    document.getElementById('changeNewPass').addEventListener('input', e => {
      this.updatePasswordStrengthHint(e.target.value);
    });
    document.getElementById('changePasswordBtn').addEventListener('click', () => {
      this.closeUserMenu();
      this.showChangePassword('voluntary');
    });
    document.getElementById('userMenuBtn').addEventListener('click', e => {
      e.stopPropagation();
      this.toggleUserMenu();
    });
    document.getElementById('logoutBtn').addEventListener('click', () => {
      this.closeUserMenu();
      this.handleLogout();
    });
    document.addEventListener('click', () => this.closeUserMenu());
  },

  async handleLogin() {
    const user = document.getElementById('loginUser').value;
    const pass = document.getElementById('loginPass').value;
    const errEl = document.getElementById('loginError');
    errEl.classList.add('hidden');

    const result = await Auth.login(user, pass);
    if (!result.ok) {
      errEl.textContent = result.error;
      errEl.classList.remove('hidden');
      return;
    }

    this.pendingLoginPassword = pass;

    if (result.needsRoleSelection) {
      this.pendingAccounts = result.accounts;
      this.showRoleSelection(result.accounts);
      return;
    }

    if (result.needsPasswordChange) {
      this.showChangePassword('required');
      return;
    }

    this.showApp();
  },

  async handleChangePassword() {
    const current = document.getElementById('changeCurrentPass').value;
    const newPass = document.getElementById('changeNewPass').value;
    const confirm = document.getElementById('changeConfirmPass').value;
    const errEl = document.getElementById('changePassError');

    if (newPass !== confirm) {
      errEl.textContent = 'Las contraseñas nuevas no coinciden.';
      errEl.classList.remove('hidden');
      return;
    }

    const userId = Auth.getUser()?.userId;
    const usePending = this.passwordChangeMode === 'required' && this.pendingLoginPassword;
    const currentForCheck = usePending ? this.pendingLoginPassword : current;
    const result = await Auth.changePassword(userId, currentForCheck, newPass, {
      skipCurrentCheck: usePending
    });
    if (!result.ok) {
      errEl.textContent = result.error;
      errEl.classList.remove('hidden');
      return;
    }

    this.pendingLoginPassword = null;
    this.showToast('Contraseña actualizada correctamente');
    if (this.passwordChangeMode === 'voluntary') {
      this.showApp(false);
    } else {
      this.showApp();
    }
  },

  showRoleSelection(accounts) {
    document.getElementById('roleSelection').classList.remove('hidden');
    const container = document.getElementById('roleOptions');
    container.innerHTML = accounts.map(a => `
      <button type="button" class="role-option-btn" data-user-id="${a.id}">
        <span class="font-semibold text-navy-900">${this.esc(a.rol)}</span>
        <span class="block text-sm text-slate-500 mt-0.5">${this.esc(a.proceso)}</span>
      </button>
    `).join('');

    container.querySelectorAll('.role-option-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const result = await Auth.selectRole(parseInt(btn.dataset.userId), this.pendingLoginPassword);
        if (!result.ok) {
          document.getElementById('loginError').textContent = result.error;
          document.getElementById('loginError').classList.remove('hidden');
          return;
        }
        document.getElementById('roleSelection').classList.add('hidden');
        if (result.needsPasswordChange) {
          this.showChangePassword('required');
        } else {
          this.showApp();
        }
      });
    });
  },

  handleLogout() {
    Auth.logout();
    this.pendingLoginPassword = null;
    sessionStorage.removeItem('oea_welcome_shown');
    document.getElementById('loginUser').value = '';
    document.getElementById('loginPass').value = '';
    document.getElementById('roleSelection').classList.add('hidden');
    this.closeUserMenu();
    this.showLogin();
  },

  toggleUserMenu() {
    this.userMenuOpen = !this.userMenuOpen;
    document.getElementById('userMenuDropdown').classList.toggle('hidden', !this.userMenuOpen);
  },

  closeUserMenu() {
    this.userMenuOpen = false;
    document.getElementById('userMenuDropdown')?.classList.add('hidden');
  },

  updatePasswordStrengthHint(value) {
    const el = document.getElementById('changePassStrength');
    if (!el) return;
    if (!value) {
      el.textContent = 'Mínimo 6 caracteres. Use letras y números para mayor seguridad.';
      el.className = 'text-xs text-slate-400 mt-1';
      return;
    }
    let score = 0;
    if (value.length >= 6) score++;
    if (value.length >= 10) score++;
    if (/[A-Z]/.test(value) && /[a-z]/.test(value)) score++;
    if (/\d/.test(value)) score++;
    if (/[^A-Za-z0-9]/.test(value)) score++;

    const levels = [
      { text: 'Muy débil — agregue más caracteres', cls: 'text-red-500' },
      { text: 'Débil — use al menos 6 caracteres', cls: 'text-orange-500' },
      { text: 'Aceptable', cls: 'text-amber-600' },
      { text: 'Buena', cls: 'text-mint-700' },
      { text: 'Fuerte', cls: 'text-mint-700 font-medium' }
    ];
    const level = levels[Math.min(score, levels.length - 1)];
    el.textContent = `Fortaleza: ${level.text}`;
    el.className = `text-xs mt-1 ${level.cls}`;
  },

  updateUserHeader() {
    const user = Auth.getUser();
    if (!user) return;
    const fullName = Auth.getFullName(user);
    const initials = (user.nombres[0] + (user.apellidos.split(' ')[0]?.[0] || '')).toUpperCase();

    document.getElementById('userAvatar').textContent = initials;
    document.getElementById('userName').textContent = fullName;
    document.getElementById('userRole').textContent = user.cargo || user.rol;

    document.getElementById('menuUserName').textContent = fullName;
    document.getElementById('menuUserCargo').textContent = user.cargo || '—';
    const rolTag = document.getElementById('menuUserRol');
    rolTag.textContent = user.rol;
    rolTag.className = `tag ${Auth.getRoleBadgeClass(user.rol)} mt-2`;
  },

  renderSidebarUserCard() {
    const user = Auth.getUser();
    const el = document.getElementById('sidebarUserCard');
    if (!user || !el) return;

    el.innerHTML = `
      <div class="sidebar-user-card">
        <div class="flex items-center gap-3">
          <div class="sidebar-avatar">${this.esc(user.nombres[0] + (user.apellidos[0] || ''))}</div>
          <div class="min-w-0 flex-1">
            <p class="font-semibold text-navy-900 text-sm truncate">${this.esc(Auth.getFullName(user))}</p>
            <p class="text-xs text-slate-500 truncate">${this.esc(user.cargo)}</p>
          </div>
        </div>
        <div class="mt-3 flex flex-wrap gap-1">
          <span class="tag ${Auth.getRoleBadgeClass(user.rol)}">${this.esc(user.rol)}</span>
        </div>
        <p class="text-xs text-slate-400 mt-2 truncate" title="${this.esc(user.proceso)}">${this.esc(user.proceso.split(' ').slice(0, 4).join(' '))}</p>
        <button type="button" onclick="App.showChangePassword('voluntary')" class="mt-3 w-full text-xs text-mint-700 hover:text-mint-800 font-medium text-left flex items-center gap-1.5">
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121.75 9"/></svg>
          Cambiar contraseña
        </button>
      </div>
    `;
  },

  renderIdentityBar() {
    const user = Auth.getUser();
    const el = document.getElementById('userIdentityBar');
    if (!user || !el) return;

    el.innerHTML = `
      <div class="identity-bar mb-6">
        <div class="identity-bar-inner">
          <div class="flex items-center gap-2 flex-shrink-0">
            <span class="iso-badge">ISO 9001:2015</span>
            <span class="text-xs text-slate-400 hidden sm:inline">Trazabilidad de sesión</span>
          </div>
          <div class="identity-grid">
            <div class="identity-field">
              <span class="identity-label">Usuario</span>
              <span class="identity-value">${this.esc(Auth.getFullName(user))}</span>
            </div>
            <div class="identity-field">
              <span class="identity-label">Cargo</span>
              <span class="identity-value">${this.esc(user.cargo)}</span>
            </div>
            <div class="identity-field">
              <span class="identity-label">Rol aplicación</span>
              <span class="identity-value"><span class="tag ${Auth.getRoleBadgeClass(user.rol)}">${this.esc(user.rol)}</span></span>
            </div>
            <div class="identity-field hidden md:block">
              <span class="identity-label">Proceso</span>
              <span class="identity-value text-xs">${this.esc(user.proceso.split(' ').slice(0, 3).join(' '))}</span>
            </div>
          </div>
          <div class="identity-meta hidden lg:flex flex-col items-end text-right">
            <span class="text-xs text-slate-400">Sesión: ${this.esc(user.sessionId || '—')}</span>
            <span class="text-xs text-slate-400">${this.esc(Auth.formatLoginDate(user.loginAt))}</span>
          </div>
        </div>
      </div>
    `;
  },

  renderAppFooter() {
    const user = Auth.getUser();
    const el = document.getElementById('appFooter');
    if (!el) return;
    el.innerHTML = `
      <div>
        <span class="font-medium text-slate-600">C.I. Colombian Mint S.A.S.</span>
        · Sistema de Gestión de Calidad ISO 9001:2015
        · Auditoría Interna OEA Res. 015/2016
      </div>
      <div class="text-right">
        ${user ? `Usuario: ${this.esc(user.usuario || user.correo)} · Ingreso #${user.loginCount || 1}` : ''}
      </div>
    `;
  },

  showWelcomeModal() {
    const user = Auth.getUser();
    if (!user) return;

    document.getElementById('modalHeader').innerHTML = `
      <div>
        <span class="iso-badge">ISO 9001:2015 · Identificación</span>
        <h3 class="text-lg font-bold text-navy-900 mt-2">Bienvenido(a) a la Auditoría Interna OEA 2026</h3>
      </div>
      <button onclick="App.closeModal()" class="p-2 hover:bg-slate-100 rounded-lg">
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
      </button>
    `;

    document.getElementById('modalBody').innerHTML = `
      <p class="text-sm text-slate-600 mb-5">Conforme al Sistema de Gestión de Calidad, se registra la identificación del usuario autenticado para trazabilidad de la consulta y gestión en esta sesión.</p>
      <div class="welcome-identity-card">
        <div class="grid sm:grid-cols-2 gap-4">
          <div>
            <p class="welcome-label">Nombre completo</p>
            <p class="welcome-value">${this.esc(Auth.getFullName(user))}</p>
          </div>
          <div>
            <p class="welcome-label">Cargo</p>
            <p class="welcome-value">${this.esc(user.cargo)}</p>
          </div>
          <div>
            <p class="welcome-label">Rol en la aplicación</p>
            <p class="welcome-value"><span class="tag ${Auth.getRoleBadgeClass(user.rol)}">${this.esc(user.rol)}</span></p>
          </div>
          <div>
            <p class="welcome-label">Proceso / Área</p>
            <p class="welcome-value text-sm">${this.esc(user.proceso)}</p>
          </div>
          <div>
            <p class="welcome-label">Usuario de acceso</p>
            <p class="welcome-value font-mono text-sm">${this.esc(user.usuario || user.correo)}</p>
          </div>
          <div>
            <p class="welcome-label">Fecha y hora de ingreso</p>
            <p class="welcome-value text-sm">${this.esc(Auth.formatLoginDate(user.loginAt))}</p>
          </div>
        </div>
        <div class="mt-4 pt-4 border-t border-slate-200 flex flex-col sm:flex-row sm:justify-between gap-2 text-xs text-slate-500">
          <span>ID Sesión: <strong class="font-mono text-slate-700">${this.esc(user.sessionId)}</strong></span>
          <span>Ingreso acumulado: <strong>${user.loginCount || 1}</strong></span>
        </div>
      </div>
      <div class="mt-5 p-3 bg-mint-50 rounded-xl text-sm text-mint-800">
        ${Auth.isAdmin() ? 'Como Administrador puede gestionar usuarios, plan de auditoría y requisitos OEA.' :
          Auth.isAuditor() ? 'Como Auditor Interno puede registrar hallazgos, consultar el banco de preguntas y listados GMC-FR08.' :
          'Como Auditado puede consultar requisitos asignados y ver hallazgos de su proceso.'}
      </div>
    `;
    this.openModal();
  },

  renderSidebar() {
    const nav = document.getElementById('sidebarNav');
    const items = Auth.getVisibleNavItems();
    const icons = {
      dashboard: 'M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z',
      plan: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z',
      requisitos: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
      responsable: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z',
      capitulos: 'M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10',
      preguntas: 'M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
      listados: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4',
      hallazgos: 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z',
      usuarios: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z',
      'admin-plan': 'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z',
      'admin-requisitos': 'M4 6h16M4 10h16M4 14h16M4 18h16'
    };

    let html = '';
    let lastSection = 'main';
    items.forEach(item => {
      const isAdmin = ['usuarios', 'admin-plan', 'admin-requisitos'].includes(item.view);
      if (isAdmin && lastSection !== 'admin') {
        html += '<div class="nav-divider"></div><p class="nav-section-label">Administración</p>';
        lastSection = 'admin';
      }
      html += `
        <button data-view="${item.view}" class="nav-item w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="${icons[item.view] || icons.dashboard}"/></svg>
          <span class="font-medium">${item.label}</span>
        </button>`;
    });
    nav.innerHTML = html;
  },

  bindEvents() {
    if (this.eventsBound) return;
    this.eventsBound = true;

    document.getElementById('sidebarNav').addEventListener('click', e => {
      const btn = e.target.closest('.nav-item');
      if (btn?.dataset.view) {
        this.navigate(btn.dataset.view);
        this.closeSidebar();
      }
    });

    document.getElementById('menuToggle').addEventListener('click', () => this.toggleSidebar());
    document.getElementById('sidebarOverlay').addEventListener('click', () => this.closeSidebar());

    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') this.closeModal();
    });
  },

  toggleSidebar() {
    document.getElementById('sidebar').classList.toggle('-translate-x-full');
    document.getElementById('sidebarOverlay').classList.toggle('hidden');
  },

  closeSidebar() {
    document.getElementById('sidebar').classList.add('-translate-x-full');
    document.getElementById('sidebarOverlay').classList.add('hidden');
  },

  navigate(view) {
    if (!Auth.canAccessView(view)) {
      this.showToast('No tiene permisos para acceder a esta sección');
      return;
    }

    this.currentView = view;
    document.querySelectorAll('.nav-item').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.view === view);
    });

    const renderers = {
      dashboard: () => this.renderDashboard(),
      plan: () => this.renderPlan(),
      requisitos: () => this.renderRequisitos(),
      responsable: () => this.renderPorResponsable(),
      capitulos: () => this.renderCapitulos(),
      preguntas: () => this.renderPreguntas(),
      listados: () => this.renderListados(),
      hallazgos: () => Hallazgos.renderHallazgos(),
      usuarios: () => Admin.renderUsuarios(),
      'admin-plan': () => Admin.renderAdminPlan(),
      'admin-requisitos': () => Admin.renderAdminRequisitos()
    };

    const content = document.getElementById('appContent');
    content.innerHTML = renderers[view]();
    content.classList.remove('fade-in');
    void content.offsetWidth;
    content.classList.add('fade-in');
    this.bindViewEvents(view);
  },

  bindViewEvents(view) {
    if (view === 'admin-requisitos') Admin.bindAdminRequisitosEvents();
    if (view === 'hallazgos') Hallazgos.bindEvents();

    if (view === 'preguntas') {
      const select = document.getElementById('filtroSesionPreguntas');
      if (select) select.addEventListener('change', () => this.filterPreguntas(select.value));
    }

    if (view === 'responsable') {
      const select = document.getElementById('filtroResponsable');
      if (select) {
        select.addEventListener('change', () => this.filterByResponsable(select.value));
      }
      const search = document.getElementById('searchResponsable');
      if (search) {
        search.addEventListener('input', () => this.filterByResponsable(select?.value || '', search.value));
      }
    }

    if (view === 'requisitos' || view === 'capitulos') {
      const search = document.getElementById('searchGlobal');
      if (search) {
        search.addEventListener('input', () => this.filterRequisitos(search.value));
      }
    }

    document.querySelectorAll('[data-req-id]').forEach(el => {
      el.addEventListener('click', () => {
        const req = this.requisitos.requisitos.find(r => r.id === el.dataset.reqId);
        if (req) this.showRequisitoModal(req);
      });
    });

    document.querySelectorAll('[data-capitulo]').forEach(el => {
      el.addEventListener('click', () => {
        const capNum = parseInt(el.dataset.capitulo);
        this.renderCapituloDetalle(capNum);
      });
    });

    document.querySelectorAll('[data-crono-index]').forEach(el => {
      el.addEventListener('click', () => {
        const idx = parseInt(el.dataset.cronoIndex);
        this.showCronoModal(this.plan.cronograma[idx]);
      });
    });
  },

  esc(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  },

  formatDate(dateStr) {
    if (!dateStr || dateStr.startsWith('DIA')) return dateStr;
    try {
      const d = new Date(dateStr + 'T12:00:00');
      return d.toLocaleDateString('es-CO', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    } catch { return dateStr; }
  },

  countAuditorias() {
    return this.plan.cronograma.filter(c => c.tipo === 'auditoria').length;
  },

  /* ===== DASHBOARD ===== */
  renderDashboard() {
    const auditCount = this.countAuditorias();
    const dias = this.plan.cronograma.filter(c => c.tipo === 'dia').length;
    const hStats = typeof Hallazgos !== 'undefined' ? Hallazgos.getStats() : { total: 0, abiertos: 0 };
    const fechas = [...new Set(this.plan.cronograma.filter(c => c.fecha && !c.fecha.startsWith('DIA')).map(c => c.fecha))];

    return `
      <div class="space-y-6">
        <div class="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <h2 class="text-2xl lg:text-3xl font-bold text-navy-900">Dashboard de Auditoría</h2>
            <p class="text-slate-500 mt-1">Plan de Auditoría Interna OEA · Julio 2026</p>
          </div>
          <div class="flex gap-2 md:hidden">
            <span class="badge-oea">OEA Exportador</span>
            <span class="badge-reval">Revalidado 2025</span>
          </div>
        </div>

        <!-- Stats -->
        <div class="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <div class="stat-card">
            <p class="text-sm text-slate-500 font-medium">Requisitos OEA</p>
            <p class="text-3xl font-bold text-mint-700 mt-1">${this.requisitos.total_requisitos}</p>
            <p class="text-xs text-slate-400 mt-1">9 capítulos normativos</p>
          </div>
          <div class="stat-card">
            <p class="text-sm text-slate-500 font-medium">Sesiones Auditoría</p>
            <p class="text-3xl font-bold text-navy-800 mt-1">${auditCount}</p>
            <p class="text-xs text-slate-400 mt-1">${dias} días programados</p>
          </div>
          <div class="stat-card cursor-pointer hover:border-mint-300 transition" onclick="App.navigate('hallazgos')">
            <p class="text-sm text-slate-500 font-medium">Hallazgos 2026</p>
            <p class="text-3xl font-bold text-red-600 mt-1">${hStats.total}</p>
            <p class="text-xs text-slate-400 mt-1">${hStats.abiertos} abiertos · Ver registro →</p>
          </div>
          <div class="stat-card">
            <p class="text-sm text-slate-500 font-medium">Auditores Internos</p>
            <p class="text-3xl font-bold text-gold-600 mt-1">${this.plan.auditores_lista.length}</p>
            <p class="text-xs text-slate-400 mt-1">Equipo interdisciplinario</p>
          </div>
          <div class="stat-card">
            <p class="text-sm text-slate-500 font-medium">Responsables</p>
            <p class="text-3xl font-bold text-purple-600 mt-1">${this.requisitos.responsables.length}</p>
            <p class="text-xs text-slate-400 mt-1">Líderes de proceso</p>
          </div>
        </div>

        <!-- Info cards -->
        <div class="grid lg:grid-cols-2 gap-6">
          <div class="info-card">
            <div class="info-card-header flex items-center justify-between">
              <span>Objetivo de la Auditoría</span>
              <span class="text-xs text-slate-400">${this.plan.codigo}</span>
            </div>
            <div class="info-card-body">
              <p class="text-slate-700 leading-relaxed">${this.esc(this.plan.objetivo)}</p>
            </div>
          </div>
          <div class="info-card">
            <div class="info-card-header">Alcance</div>
            <div class="info-card-body">
              <p class="text-slate-700 leading-relaxed">${this.esc(this.plan.alcance)}</p>
            </div>
          </div>
        </div>

        <!-- Riesgos y Controles -->
        <div class="grid lg:grid-cols-2 gap-6">
          <div class="info-card">
            <div class="info-card-header flex items-center gap-2">
              Riesgos Asociados
              <span class="risk-alto">${this.esc(this.plan.valoracion)}</span>
            </div>
            <div class="info-card-body">
              <div class="text-sm text-slate-600 leading-relaxed whitespace-pre-line">${this.esc(this.plan.riesgos)}</div>
            </div>
          </div>
          <div class="info-card">
            <div class="info-card-header">Controles</div>
            <div class="info-card-body">
              <div class="text-sm text-slate-600 leading-relaxed whitespace-pre-line">${this.esc(this.plan.controles)}</div>
            </div>
          </div>
        </div>

        <!-- Cronograma resumen -->
        <div class="info-card">
          <div class="info-card-header flex items-center justify-between">
            <span>Cronograma de Auditoría</span>
            <button onclick="App.navigate('plan')" class="text-sm text-mint-600 hover:text-mint-700 font-medium">Ver completo →</button>
          </div>
          <div class="info-card-body">
            <div class="space-y-0">
              ${this.plan.cronograma.filter(c => c.tipo === 'auditoria' || c.tipo === 'reunion').slice(0, 6).map((c, i) => `
                <div class="flex items-start gap-4 py-3 border-b border-slate-100 last:border-0 cursor-pointer hover:bg-slate-50 -mx-2 px-2 rounded-lg transition" data-crono-index="${this.plan.cronograma.indexOf(c)}">
                  <div class="text-center min-w-[4.5rem]">
                    <p class="text-xs font-bold text-mint-700">${c.fecha && !c.fecha.startsWith('DIA') ? c.fecha.slice(5) : ''}</p>
                    <p class="text-xs text-slate-400">${this.esc(c.hora)}</p>
                  </div>
                  <div class="flex-1 min-w-0">
                    <p class="font-medium text-slate-800 text-sm line-clamp-2">${this.esc(c.proceso.split('\n')[0])}</p>
                    <p class="text-xs text-slate-500 mt-0.5">${this.esc(c.auditor)} ${c.auditados ? '· ' + c.auditados.split('/')[0].trim() : ''}</p>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
        </div>

        <!-- Capítulos resumen -->
        <div class="info-card">
          <div class="info-card-header flex items-center justify-between">
            <span>Requisitos por Capítulo</span>
            <button onclick="App.navigate('capitulos')" class="text-sm text-mint-600 hover:text-mint-700 font-medium">Explorar →</button>
          </div>
          <div class="info-card-body">
            <div class="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-9 gap-3">
              ${this.requisitos.capitulos.map(cap => `
                <div class="text-center cursor-pointer group" data-capitulo="${cap.numero}">
                  <div class="w-12 h-12 mx-auto rounded-xl bg-mint-50 border-2 border-mint-200 flex items-center justify-center font-bold text-mint-700 group-hover:bg-mint-100 group-hover:border-mint-400 transition">${cap.numero}</div>
                  <p class="text-xs text-slate-500 mt-1.5 line-clamp-2">${cap.total_requisitos} req.</p>
                </div>
              `).join('')}
            </div>
          </div>
        </div>

        <!-- Equipo -->
        <div class="info-card">
          <div class="info-card-header">Equipo de Auditoría Interna</div>
          <div class="info-card-body">
            <div class="flex flex-wrap gap-2">
              ${this.plan.auditores_lista.map(a => `<span class="tag tag-auditor">${this.esc(a)}</span>`).join('')}
            </div>
            ${this.plan.observadores ? `<p class="text-sm text-slate-500 mt-3"><strong>Observadores:</strong> ${this.esc(this.plan.observadores)}</p>` : ''}
          </div>
        </div>
      </div>
    `;
  },

  /* ===== PLAN ===== */
  renderPlan() {
    return `
      <div class="space-y-6">
        <div>
          <h2 class="text-2xl lg:text-3xl font-bold text-navy-900">Plan de Auditoría 2026</h2>
          <p class="text-slate-500 mt-1">${this.esc(this.plan.codigo)} · Versión ${this.esc(this.plan.version)}</p>
        </div>

        <div class="grid lg:grid-cols-3 gap-6">
          <div class="info-card lg:col-span-1">
            <div class="info-card-header">Objetivo</div>
            <div class="info-card-body text-sm text-slate-700">${this.esc(this.plan.objetivo)}</div>
          </div>
          <div class="info-card lg:col-span-1">
            <div class="info-card-header">Alcance</div>
            <div class="info-card-body text-sm text-slate-700">${this.esc(this.plan.alcance)}</div>
          </div>
          <div class="info-card lg:col-span-1">
            <div class="info-card-header">Criterios</div>
            <div class="info-card-body text-sm text-slate-700">${this.esc(this.plan.criterios)}</div>
          </div>
        </div>

        <div class="info-card">
          <div class="info-card-header">Cronograma Detallado</div>
          <div class="info-card-body">
            <div class="space-y-0">
              ${this.plan.cronograma.map((c, idx) => this.renderCronoItem(c, idx)).join('')}
            </div>
          </div>
        </div>
      </div>
    `;
  },

  renderCronoItem(c, idx) {
    if (c.tipo === 'dia') {
      return `
        <div class="py-4 mt-2">
          <h3 class="text-lg font-bold text-gold-600 flex items-center gap-2">
            <span class="w-8 h-8 rounded-full bg-gold-100 flex items-center justify-center text-sm">📅</span>
            ${this.esc(c.fecha || 'DÍA')}
          </h3>
        </div>
      `;
    }

    if (c.tipo === 'receso') {
      return `
        <div class="py-3 px-4 my-2 bg-slate-50 rounded-lg text-center text-sm text-slate-500 italic">
          ☕ ${this.esc(c.proceso)} · ${this.esc(c.hora)}
        </div>
      `;
    }

    const isClickable = c.tipo === 'auditoria' || c.tipo === 'reunion';

    return `
      <div class="crono-item ${isClickable ? 'cursor-pointer' : ''}" ${isClickable ? `data-crono-index="${idx}"` : ''}>
        <div class="crono-dot ${c.tipo}"></div>
        <div class="bg-white border border-slate-200 rounded-xl p-4 hover:border-mint-300 hover:shadow-md transition ${isClickable ? 'hover:bg-mint-50/30' : ''}">
          <div class="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
            <div class="flex-1">
              <div class="flex items-center gap-2 mb-1">
                <span class="text-xs font-semibold text-mint-700">${c.fecha && !c.fecha.startsWith('DIA') ? this.formatDate(c.fecha) : ''}</span>
                <span class="text-xs text-slate-400">· ${this.esc(c.hora)}</span>
              </div>
              <h4 class="font-semibold text-slate-800 whitespace-pre-line text-sm">${this.esc(c.proceso)}</h4>
            </div>
            ${c.tipo === 'auditoria' ? `
              <div class="flex flex-wrap gap-1.5 sm:flex-col sm:items-end">
                ${c.auditor ? `<span class="tag tag-auditor">Auditor: ${this.esc(c.auditor)}</span>` : ''}
                ${c.auditados ? `<span class="tag tag-auditado">Auditados: ${this.esc(c.auditados)}</span>` : ''}
              </div>
            ` : ''}
          </div>
          ${c.sintesis_anterior ? `
            <div class="mt-3 pt-3 border-t border-slate-100">
              <p class="text-xs font-semibold text-red-600 uppercase mb-1">Hallazgos anteriores (ARCA 2025)</p>
              <p class="text-xs text-slate-600 line-clamp-3">${this.esc(c.sintesis_anterior.substring(0, 300))}...</p>
            </div>
          ` : ''}
        </div>
      </div>
    `;
  },

  showCronoModal(c) {
    document.getElementById('modalHeader').innerHTML = `
      <div>
        <p class="text-xs text-mint-600 font-semibold uppercase">${this.esc(c.hora)} · ${c.fecha ? this.formatDate(c.fecha) : ''}</p>
        <h3 class="text-lg font-bold text-navy-900 mt-0.5 whitespace-pre-line">${this.esc(c.proceso)}</h3>
      </div>
      <button onclick="App.closeModal()" class="p-2 hover:bg-slate-100 rounded-lg transition">
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
      </button>
    `;

    let body = '';

    if (c.auditor || c.auditados) {
      body += `<div class="flex flex-wrap gap-2 mb-4">
        ${c.auditor ? `<span class="tag tag-auditor">Auditor: ${this.esc(c.auditor)}</span>` : ''}
        ${c.auditados ? `<span class="tag tag-auditado">Auditados: ${this.esc(c.auditados)}</span>` : ''}
        ${c.observadores && c.observadores !== 'N.A.' ? `<span class="tag tag-proceso">Observadores: ${this.esc(c.observadores)}</span>` : ''}
      </div>`;
    }

    if (c.sintesis_anterior) {
      body += `<div class="detail-section hallazgo"><h4>Síntesis Auditoría Anterior (ARCA 2025)</h4><div class="content">${this.esc(c.sintesis_anterior)}</div></div>`;
    }

    if (c.requisitos_norma) {
      body += `<div class="detail-section"><h4>Requisitos de la Norma (Res. 015/2016)</h4><div class="content">${this.esc(c.requisitos_norma)}</div></div>`;
    }

    if (c.necesidades) {
      body += `<div class="detail-section"><h4>Necesidades para la Auditoría</h4><div class="content">${this.esc(c.necesidades)}</div></div>`;
    }

    document.getElementById('modalBody').innerHTML = body || '<p class="text-slate-500">Sin detalles adicionales.</p>';
    this.openModal();
  },

  /* ===== REQUISITOS GENERAL ===== */
  renderRequisitos() {
    return `
      <div class="space-y-6">
        <div>
          <h2 class="text-2xl lg:text-3xl font-bold text-navy-900">Requisitos OEA</h2>
          <p class="text-slate-500 mt-1">${this.requisitos.total_requisitos} requisitos · Res. ${this.esc(this.requisitos.resolucion)} · Revalidación ${this.requisitos.revalidacion}</p>
        </div>

        <div class="search-wrapper max-w-xl">
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
          <input type="text" id="searchGlobal" class="search-input" placeholder="Buscar por número, descripción, responsable o evidencia...">
        </div>

        <div id="requisitosList" class="grid gap-4">
          ${this.renderRequisitosList(this.getFilteredRequisitos())}
        </div>
      </div>
    `;
  },

  renderRequisitosList(requisitos) {
    if (!requisitos.length) {
      return '<div class="text-center py-12 text-slate-400">No se encontraron requisitos.</div>';
    }

    return requisitos.map(r => `
      <div class="req-card" data-req-id="${r.id}">
        <div class="flex items-start justify-between gap-3">
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2 mb-2">
              <span class="req-number">${this.esc(r.numero)}</span>
              <span class="text-xs text-slate-400">Cap. ${r.capitulo_num}</span>
            </div>
            <p class="text-sm text-slate-800 font-medium line-clamp-2">${this.esc(r.descripcion)}</p>
            <div class="flex flex-wrap gap-1 mt-2">
              ${r.responsables.slice(0, 3).map(resp => `<span class="tag tag-auditado">${this.esc(this.formatName(resp))}</span>`).join('')}
              ${r.responsables.length > 3 ? `<span class="tag text-slate-400">+${r.responsables.length - 3}</span>` : ''}
            </div>
          </div>
          <svg class="w-5 h-5 text-slate-300 flex-shrink-0 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/></svg>
        </div>
      </div>
    `).join('');
  },

  filterRequisitos(query) {
    const q = query.toLowerCase().trim();
    const list = document.getElementById('requisitosList');
    if (!list) return;

    const filtered = q ? this.getFilteredRequisitos().filter(r =>
      r.numero.toLowerCase().includes(q) ||
      r.descripcion.toLowerCase().includes(q) ||
      r.responsable.toLowerCase().includes(q) ||
      r.evidencia_interna.toLowerCase().includes(q) ||
      r.evidencia_oea.toLowerCase().includes(q) ||
      r.capitulo_nombre.toLowerCase().includes(q)
    ) : this.getFilteredRequisitos();

    list.innerHTML = this.renderRequisitosList(filtered);
    list.querySelectorAll('[data-req-id]').forEach(el => {
      el.addEventListener('click', () => {
        const req = this.requisitos.requisitos.find(r => r.id === el.dataset.reqId);
        if (req) this.showRequisitoModal(req);
      });
    });
  },

  formatName(name) {
    return name.split(' ').map(w => w.charAt(0) + w.slice(1).toLowerCase()).join(' ');
  },

  /* ===== POR RESPONSABLE ===== */
  renderPorResponsable() {
    let responsables = this.requisitos.responsables;
    if (Auth.isAuditado()) {
      responsables = [Auth.getShortName()];
    }
    const options = responsables.map(r =>
      `<option value="${this.esc(r)}">${this.esc(this.formatName(r))}</option>`
    ).join('');

    return `
      <div class="space-y-6">
        <div>
          <h2 class="text-2xl lg:text-3xl font-bold text-navy-900">Requisitos por Responsable</h2>
          <p class="text-slate-500 mt-1">Consulta los requisitos asignados a cada líder de proceso</p>
        </div>

        <div class="grid sm:grid-cols-2 gap-4 max-w-2xl">
          <div>
            <label class="block text-sm font-medium text-slate-700 mb-2">Seleccionar Responsable</label>
            <select id="filtroResponsable" class="select-input">
              <option value="">— Todos los responsables —</option>
              ${options}
            </select>
          </div>
          <div>
            <label class="block text-sm font-medium text-slate-700 mb-2">Búsqueda adicional</label>
            <div class="search-wrapper">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
              <input type="text" id="searchResponsable" class="search-input" placeholder="Filtrar resultados...">
            </div>
          </div>
        </div>

        <div id="responsableStats" class="hidden">
          <div class="stat-card inline-block">
            <p class="text-sm text-slate-500">Requisitos asignados</p>
            <p class="text-2xl font-bold text-mint-700" id="responsableCount">0</p>
          </div>
        </div>

        <div id="responsableList" class="grid gap-4">
          <div class="text-center py-16 text-slate-400">
            <svg class="w-16 h-16 mx-auto mb-4 text-slate-200" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>
            <p class="font-medium">Seleccione un responsable para ver sus requisitos</p>
            <p class="text-sm mt-1">Como auditado o auditor, podrá prepararse con las evidencias sugeridas</p>
          </div>
        </div>
      </div>
    `;
  },

  filterByResponsable(responsable, searchQuery = '') {
    const list = document.getElementById('responsableList');
    const stats = document.getElementById('responsableStats');
    const count = document.getElementById('responsableCount');

    if (!responsable) {
      list.innerHTML = `
        <div class="text-center py-16 text-slate-400">
          <svg class="w-16 h-16 mx-auto mb-4 text-slate-200" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>
          <p class="font-medium">Seleccione un responsable para ver sus requisitos</p>
        </div>`;
      stats.classList.add('hidden');
      return;
    }

    let filtered = this.requisitos.requisitos.filter(r =>
      r.responsables.some(resp => resp === responsable)
    );

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(r =>
        r.numero.toLowerCase().includes(q) ||
        r.descripcion.toLowerCase().includes(q) ||
        r.evidencia_interna.toLowerCase().includes(q)
      );
    }

    stats.classList.remove('hidden');
    count.textContent = filtered.length;

    list.innerHTML = `
      <div class="info-card mb-4">
        <div class="info-card-body flex items-center gap-4">
          <div class="w-14 h-14 rounded-full bg-gradient-to-br from-mint-400 to-mint-600 flex items-center justify-center text-white text-xl font-bold">
            ${responsable.charAt(0)}
          </div>
          <div>
            <h3 class="text-lg font-bold text-navy-900">${this.esc(this.formatName(responsable))}</h3>
            <p class="text-sm text-slate-500">${filtered.length} requisito(s) asignado(s)</p>
          </div>
        </div>
      </div>
      ${this.renderRequisitosList(filtered)}
    `;

    list.querySelectorAll('[data-req-id]').forEach(el => {
      el.addEventListener('click', () => {
        const req = this.requisitos.requisitos.find(r => r.id === el.dataset.reqId);
        if (req) this.showRequisitoModal(req);
      });
    });
  },

  /* ===== POR CAPÍTULO ===== */
  renderCapitulos() {
    return `
      <div class="space-y-6">
        <div>
          <h2 class="text-2xl lg:text-3xl font-bold text-navy-900">Requisitos por Capítulo</h2>
          <p class="text-slate-500 mt-1">Artículo 4º · Resolución 000015 de 2016 · 9 capítulos normativos</p>
        </div>

        <div class="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          ${this.requisitos.capitulos.map(cap => `
            <div class="chapter-card" data-capitulo="${cap.numero}">
              <div class="flex items-start gap-4">
                <div class="chapter-num">${cap.numero}</div>
                <div class="flex-1 min-w-0">
                  <h3 class="font-bold text-navy-900 text-sm leading-snug">${this.esc(cap.nombre)}</h3>
                  <p class="text-sm text-mint-600 font-semibold mt-2">${cap.total_requisitos} requisitos</p>
                </div>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  },

  renderCapituloDetalle(capNum) {
    const cap = this.requisitos.capitulos.find(c => c.numero === capNum);
    const reqs = this.requisitos.requisitos.filter(r => r.capitulo_num === capNum);

    const content = document.getElementById('appContent');
    content.innerHTML = `
      <div class="space-y-6 fade-in">
        <button onclick="App.navigate('capitulos')" class="flex items-center gap-2 text-mint-600 hover:text-mint-700 font-medium text-sm transition">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/></svg>
          Volver a Capítulos
        </button>

        <div class="flex items-start gap-4">
          <div class="chapter-num text-2xl">${cap.numero}</div>
          <div>
            <h2 class="text-2xl font-bold text-navy-900">Capítulo ${cap.numero}</h2>
            <p class="text-lg text-slate-600">${this.esc(cap.nombre)}</p>
            <p class="text-sm text-mint-600 font-semibold mt-1">${reqs.length} requisitos</p>
          </div>
        </div>

        <div class="search-wrapper max-w-xl">
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
          <input type="text" id="searchGlobal" class="search-input" placeholder="Buscar en este capítulo...">
        </div>

        <div id="requisitosList" class="grid gap-4">
          ${this.renderRequisitosList(reqs)}
        </div>
      </div>
    `;

    document.querySelectorAll('[data-req-id]').forEach(el => {
      el.addEventListener('click', () => {
        const req = this.requisitos.requisitos.find(r => r.id === el.dataset.reqId);
        if (req) this.showRequisitoModal(req);
      });
    });

    const search = document.getElementById('searchGlobal');
    if (search) {
      search.addEventListener('input', () => {
        const q = search.value.toLowerCase().trim();
        const list = document.getElementById('requisitosList');
        const filtered = q ? reqs.filter(r =>
          r.numero.toLowerCase().includes(q) ||
          r.descripcion.toLowerCase().includes(q) ||
          r.responsable.toLowerCase().includes(q)
        ) : reqs;
        list.innerHTML = this.renderRequisitosList(filtered);
        list.querySelectorAll('[data-req-id]').forEach(el => {
          el.addEventListener('click', () => {
            const req = this.requisitos.requisitos.find(r => r.id === el.dataset.reqId);
            if (req) this.showRequisitoModal(req);
          });
        });
      });
    }
  },

  /* ===== MODAL REQUISITO ===== */
  showRequisitoModal(req) {
    document.getElementById('modalHeader').innerHTML = `
      <div>
        <div class="flex items-center gap-2">
          <span class="req-number">${this.esc(req.numero)}</span>
          <span class="text-xs text-slate-400">Cap. ${req.capitulo_num} · ${this.esc(req.capitulo_nombre)}</span>
        </div>
        <h3 class="text-base font-bold text-navy-900 mt-2 leading-snug">${this.esc(req.descripcion)}</h3>
      </div>
      <button onclick="App.closeModal()" class="p-2 hover:bg-slate-100 rounded-lg transition flex-shrink-0">
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
      </button>
    `;

    let body = `
      <div class="grid sm:grid-cols-2 gap-4 mb-5">
        <div>
          <p class="text-xs font-semibold text-slate-400 uppercase">Autoridad</p>
          <p class="font-medium text-slate-800">${this.esc(req.autoridad)}</p>
        </div>
        <div>
          <p class="text-xs font-semibold text-slate-400 uppercase">Responsable(s)</p>
          <div class="flex flex-wrap gap-1 mt-1">
            ${req.responsables.map(r => `<span class="tag tag-auditado">${this.esc(this.formatName(r))}</span>`).join('')}
          </div>
        </div>
      </div>
    `;

    body += `<div class="detail-section evidencia"><h4>📋 Documentos / Evidencias — Auditoría Interna</h4><div class="content">${this.esc(req.evidencia_interna) || 'No especificada'}</div></div>`;
    body += `<div class="detail-section evidencia"><h4>🔍 Evidencias — Auditoría OEA (DIAN)</h4><div class="content">${this.esc(req.evidencia_oea) || 'No especificada'}</div></div>`;

    if (req.hallazgos_arca) {
      body += `<div class="detail-section hallazgo"><h4>⚠️ Hallazgos ARCA 2025 (histórico)</h4><div class="content">${this.esc(req.hallazgos_arca)}</div></div>`;
    }

    body += Hallazgos.renderRequisitoSection(req.id);

    if (Hallazgos.canCreate()) {
      body += `<div class="mt-4"><button type="button" onclick="App.closeModal(); Hallazgos.showForm({ requisito_id: '${req.id}', requisito_numero: '${this.esc(req.numero)}' })" class="btn-primary text-sm py-2">+ Registrar hallazgo en este requisito</button></div>`;
    }

    if (req.plan_accion) {
      body += `<div class="detail-section"><h4>📝 Plan de Acción</h4><div class="content">${this.esc(req.plan_accion)}</div></div>`;
    }

    if (req.info_dian) {
      body += `<div class="detail-section"><h4>🏛️ Revalidación DIAN 2025</h4><div class="content">${this.esc(req.info_dian)}</div></div>`;
    }

    if (Auth.isAuditor() || Auth.isAdmin()) {
      const pq = this.preguntas?.requisitos?.find(p => p.requisito_id === req.id);
      if (pq?.preguntas?.length) {
        body += `<div class="detail-section"><h4>❓ Banco de Preguntas (${pq.preguntas.length})</h4><div class="content">`;
        pq.preguntas.forEach(p => {
          body += `<div class="pregunta-item"><span class="num">${p.id}.</span>${this.esc(p.texto)}${p.fuente ? ` <span class="tag tag-proceso text-xs">${this.esc(p.fuente)}</span>` : ''}</div>`;
        });
        body += `</div></div>`;
      }
    }

    document.getElementById('modalBody').innerHTML = body;
    this.openModal();
  },

  openModal() {
    document.getElementById('modal').classList.add('active');
    document.getElementById('modal').classList.remove('hidden');
    document.body.style.overflow = 'hidden';
  },

  closeModal() {
    document.getElementById('modal').classList.remove('active');
    document.getElementById('modal').classList.add('hidden');
    document.body.style.overflow = '';
  },

  showToast(msg) {
    const toast = document.getElementById('toast');
    document.getElementById('toastMsg').textContent = msg;
    toast.classList.remove('translate-y-20', 'opacity-0');
    setTimeout(() => toast.classList.add('translate-y-20', 'opacity-0'), 3000);
  },

  getFilteredRequisitos() {
    let reqs = this.requisitos.requisitos;
    if (Auth.isAuditado()) {
      const shortName = Auth.getShortName();
      reqs = reqs.filter(r =>
        r.responsables.some(resp => resp === shortName || resp.includes(shortName.split(' ')[0]))
      );
    }
    return reqs;
  },

  getMyAuditSessions() {
    if (!Auth.isAuditor()) return this.plan.cronograma.filter(c => c.tipo === 'auditoria');
    const auditorName = Auth.getShortName().split(' ')[0];
    return this.plan.cronograma.filter(c =>
      c.tipo === 'auditoria' && c.auditor && c.auditor.toUpperCase().includes(auditorName)
    );
  },

  /* ===== BANCO DE PREGUNTAS (Auditor Interno) ===== */
  renderPreguntas() {
    const sesiones = this.listados?.sesiones || [];
    const mySessions = Auth.isAdmin() ? sesiones : sesiones.filter(s => {
      const auditorName = Auth.getShortName().split(' ')[0];
      return s.auditor && s.auditor.toUpperCase().includes(auditorName);
    });

    const options = mySessions.map(s =>
      `<option value="${s.id}">Sesión ${s.id} · ${this.esc(s.fecha)} · ${this.esc(s.proceso)}</option>`
    ).join('');

    return `
      <div class="space-y-6">
        <div>
          <h2 class="text-2xl lg:text-3xl font-bold text-navy-900">Banco de Preguntas</h2>
          <p class="text-slate-500 mt-1">10 preguntas por requisito · Uso exclusivo Auditor Interno · ${this.preguntas?.requisitos?.length || 0} requisitos</p>
        </div>

        <div class="max-w-xl">
          <label class="form-label">Filtrar por sesión de auditoría</label>
          <select id="filtroSesionPreguntas" class="select-input">
            <option value="">— Todas mis sesiones —</option>
            ${options}
          </select>
        </div>

        <div id="preguntasList">
          ${this.renderPreguntasList(mySessions.length ? mySessions[0].requisitos_ids : null)}
        </div>
      </div>
    `;
  },

  renderPreguntasList(requisitoIds) {
    let items = this.preguntas?.requisitos || [];
    if (requisitoIds?.length) {
      items = items.filter(p => requisitoIds.includes(p.requisito_id));
    } else if (Auth.isAuditor()) {
      const mySessions = this.getMyAuditSessions();
      const allIds = [...new Set(mySessions.flatMap(s => {
        const ses = this.listados?.sesiones?.find(x => x.proceso === s.proceso.split('\n')[0] || x.fecha === s.fecha);
        return ses?.requisitos_ids || [];
      }))];
      if (allIds.length) items = items.filter(p => allIds.includes(p.requisito_id));
    }

    if (!items.length) {
      return '<div class="text-center py-12 text-slate-400">No hay preguntas asignadas para su sesión.</div>';
    }

    return items.map(p => `
      <div class="info-card mb-4">
        <div class="info-card-header flex items-center gap-2">
          <span class="req-number">${this.esc(p.numero)}</span>
          <span class="text-xs text-slate-400">Cap. ${p.capitulo_num} · ${this.esc(p.capitulo_nombre)}</span>
        </div>
        <div class="info-card-body">
          <p class="text-sm text-slate-700 mb-4">${this.esc(p.descripcion)}</p>
          ${p.preguntas.map(q => `
            <div class="pregunta-item flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
              <div class="flex-1">
                <span class="num">${q.id}.</span>${this.esc(q.texto)}
                ${q.fuente ? `<span class="tag tag-proceso ml-2 text-xs">${this.esc(q.fuente)}</span>` : ''}
              </div>
              ${Hallazgos.canCreate() ? `
                <button type="button" onclick="Hallazgos.showForm({ requisito_id: '${p.requisito_id}', requisito_numero: '${this.esc(p.numero)}', pregunta_id: ${q.id} })"
                  class="text-xs text-mint-700 hover:text-mint-800 font-medium whitespace-nowrap flex-shrink-0">+ Hallazgo</button>
              ` : ''}
            </div>
          `).join('')}
        </div>
      </div>
    `).join('');
  },

  filterPreguntas(sesionId) {
    const list = document.getElementById('preguntasList');
    if (!list) return;
    if (!sesionId) {
      list.innerHTML = this.renderPreguntasList(null);
      return;
    }
    const sesion = this.listados?.sesiones?.find(s => s.id === parseInt(sesionId));
    list.innerHTML = this.renderPreguntasList(sesion?.requisitos_ids || []);
  },

  /* ===== LISTADOS DE VERIFICACIÓN ===== */
  renderListados() {
    let sesiones = this.listados?.sesiones || [];
    if (Auth.isAuditor()) {
      const auditorName = Auth.getShortName().split(' ')[0];
      sesiones = sesiones.filter(s => s.auditor && s.auditor.toUpperCase().includes(auditorName));
    }

    return `
      <div class="space-y-6">
        <div>
          <h2 class="text-2xl lg:text-3xl font-bold text-navy-900">Listados de Verificación</h2>
          <p class="text-slate-500 mt-1">GMC-FR08 · ${sesiones.length} sesiones · Descargue y gestione durante la auditoría</p>
        </div>

        <div class="grid gap-4">
          ${sesiones.map(s => `
            <div class="listado-card">
              <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <div class="flex items-center gap-2 mb-1">
                    <span class="req-number">Sesión ${s.id}</span>
                    <span class="text-xs text-slate-400">${this.esc(s.fecha)} · ${this.esc(s.hora)}</span>
                  </div>
                  <h3 class="font-bold text-navy-900">${this.esc(s.proceso)}</h3>
                  <p class="text-sm text-slate-500 mt-1">
                    Auditor: ${this.esc(s.auditor)} · Auditados: ${this.esc(s.auditados)}
                  </p>
                  <p class="text-xs text-mint-600 mt-1">${s.requisitos_numeros?.length || 0} requisitos · ${s.total_preguntas || 0} preguntas</p>
                </div>
                <div class="flex flex-wrap gap-2">
                  <a href="listados/${this.esc(s.archivo)}" download class="btn-primary whitespace-nowrap">
                    Descargar Excel
                  </a>
                  ${Hallazgos.canCreate() ? `
                    <button type="button" onclick="Hallazgos.showForm({ sesion_id: ${s.id} })" class="btn-secondary whitespace-nowrap">+ Hallazgo sesión</button>
                  ` : ''}
                  <button type="button" onclick="App.navigate('hallazgos'); setTimeout(()=>{ const el=document.getElementById('filtroHallazgoSesion'); if(el){el.value='${s.id}'; Hallazgos.refreshList();}},100)" class="btn-secondary whitespace-nowrap">Ver hallazgos</button>
                </div>
              </div>
              ${s.requisitos_numeros?.length ? `
                <div class="mt-3 flex flex-wrap gap-1">
                  ${s.requisitos_numeros.slice(0, 8).map(n => `<span class="tag tag-proceso">${this.esc(n)}</span>`).join('')}
                  ${s.requisitos_numeros.length > 8 ? `<span class="tag text-slate-400">+${s.requisitos_numeros.length - 8}</span>` : ''}
                </div>
              ` : ''}
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }
};

document.addEventListener('DOMContentLoaded', () => App.init());
