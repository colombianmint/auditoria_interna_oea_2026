/**
 * Autenticación y control de acceso - Auditoría Interna OEA
 */
const Auth = {
  session: null,

  init() {
    this.session = Storage.getSession();
    return !!this.session;
  },

  getPasswordForUser(user) {
    if (user.cedula === '123456789') return '123456789';
    return user.cedula.slice(-4);
  },

  findAccounts(username) {
    const q = username.trim().toLowerCase();
    const usuarios = Storage.getUsuarios().usuarios.filter(u => u.activo !== false);
    return usuarios.filter(u =>
      u.correo.toLowerCase() === q ||
      u.cedula === q ||
      u.cedula === username.trim()
    );
  },

  login(username, password) {
    const accounts = this.findAccounts(username);
    if (!accounts.length) return { ok: false, error: 'Usuario no encontrado o inactivo.' };

    const valid = accounts.filter(u => this.getPasswordForUser(u) === password.trim());
    if (!valid.length) return { ok: false, error: 'Contraseña incorrecta.' };

    const cedula = valid[0].cedula;
    const personAccounts = Storage.getUsuarios().usuarios.filter(
      u => u.cedula === cedula && u.activo !== false
    );

    const roles = [...new Set(personAccounts.map(u => u.rol))];
    if (roles.length === 1) {
      const account = personAccounts.find(u => u.rol === roles[0]) || personAccounts[0];
      return this.createSession(account, personAccounts);
    }

    return {
      ok: true,
      needsRoleSelection: true,
      accounts: personAccounts,
      cedula
    };
  },

  selectRole(userId) {
    const usuarios = Storage.getUsuarios().usuarios;
    const account = usuarios.find(u => u.id === userId && u.activo !== false);
    if (!account) return { ok: false, error: 'Rol no válido.' };

    const personAccounts = usuarios.filter(u => u.cedula === account.cedula && u.activo !== false);
    return this.createSession(account, personAccounts);
  },

  createSession(activeAccount, allAccounts) {
    this.session = {
      userId: activeAccount.id,
      cedula: activeAccount.cedula,
      rol: activeAccount.rol,
      nombres: activeAccount.nombres,
      apellidos: activeAccount.apellidos,
      proceso: activeAccount.proceso,
      cargo: activeAccount.cargo,
      correo: activeAccount.correo,
      loginAt: new Date().toISOString(),
      accounts: allAccounts.map(u => ({ id: u.id, rol: u.rol, proceso: u.proceso }))
    };
    Storage.setSession(this.session);
    return { ok: true, session: this.session };
  },

  logout() {
    this.session = null;
    Storage.setSession(null);
  },

  isLoggedIn() {
    return !!this.session;
  },

  getUser() {
    return this.session;
  },

  getRol() {
    return this.session?.rol || null;
  },

  isAdmin() {
    return this.getRol() === 'Administrador';
  },

  isAuditor() {
    return this.getRol() === 'Auditor Interno';
  },

  isAuditado() {
    return this.getRol() === 'Auditado';
  },

  getFullName(user) {
    const u = user || this.session;
    if (!u) return '';
    return `${u.nombres} ${u.apellidos}`.trim();
  },

  getShortName(user) {
    const u = user || this.session;
    if (!u) return '';
    const first = u.nombres.split(' ')[0];
    const apellido = u.apellidos.split(' ')[0];
    return `${first} ${apellido}`.toUpperCase();
  },

  getUserById(id) {
    return Storage.getUsuarios().usuarios.find(u => u.id === id);
  },

  getUserDisplayName(user) {
    if (!user) return '';
    return `${user.nombres.split(' ')[0]} ${user.apellidos.split(' ')[0]}`.toUpperCase();
  },

  matchUserToResponsable(responsableName, usuarios) {
    const name = responsableName.toUpperCase().trim();
    return usuarios.find(u => {
      const short = this.getUserDisplayName(u);
      const full = `${u.nombres} ${u.apellidos}`.toUpperCase();
      return short === name || full.includes(name) || name.includes(short.split(' ')[0]);
    });
  },

  canAccessView(view) {
    const rol = this.getRol();
    const publicViews = [];
    if (!rol) return publicViews.includes(view);

    const adminViews = ['usuarios', 'admin-plan', 'admin-requisitos'];
    const auditorViews = ['preguntas', 'listados'];
    const commonViews = ['dashboard', 'plan', 'requisitos', 'responsable', 'capitulos'];

    if (rol === 'Administrador') {
      return [...commonViews, ...adminViews, ...auditorViews].includes(view);
    }
    if (rol === 'Auditor Interno') {
      return [...commonViews, ...auditorViews].includes(view);
    }
    if (rol === 'Auditado') {
      return commonViews.includes(view);
    }
    return false;
  },

  getVisibleNavItems() {
    const all = [
      { view: 'dashboard', label: 'Dashboard', icon: 'dashboard' },
      { view: 'plan', label: 'Plan de Auditoría', icon: 'plan' },
      { view: 'requisitos', label: 'Requisitos OEA', icon: 'requisitos' },
      { view: 'responsable', label: 'Por Responsable', icon: 'responsable' },
      { view: 'capitulos', label: 'Por Capítulo', icon: 'capitulos' },
      { view: 'preguntas', label: 'Banco de Preguntas', icon: 'preguntas', roles: ['Administrador', 'Auditor Interno'] },
      { view: 'listados', label: 'Listados Verificación', icon: 'listados', roles: ['Administrador', 'Auditor Interno'] },
      { view: 'usuarios', label: 'Gestión Usuarios', icon: 'usuarios', roles: ['Administrador'] },
      { view: 'admin-plan', label: 'Editar Plan', icon: 'admin-plan', roles: ['Administrador'] },
      { view: 'admin-requisitos', label: 'Editar Requisitos', icon: 'admin-requisitos', roles: ['Administrador'] }
    ];
    const rol = this.getRol();
    return all.filter(item => {
      if (!item.roles) return Auth.canAccessView(item.view);
      return item.roles.includes(rol);
    });
  }
};
