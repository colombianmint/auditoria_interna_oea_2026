/**
 * Autenticación y control de acceso - Auditoría Interna OEA
 */
const Auth = {
  session: null,
  _migrated: false,

  /** Credenciales reservadas — superadmin oculto (no crear usuarios con estos datos) */
  RESERVED_LOGINS: ['123456789'],

  getSystemAdminTemplate() {
    if (typeof USUARIOS_DATA === 'undefined') return null;
    return USUARIOS_DATA.usuarios.find(u => u.sistema) || null;
  },

  isReservedLogin(value) {
    if (value === undefined || value === null) return false;
    const q = String(value).trim();
    return this.RESERVED_LOGINS.some(r => r === q || r.toLowerCase() === q.toLowerCase());
  },

  async init() {
    await this.migrateDatabase();
    this.session = Storage.getSession();
    if (this.session) {
      const u = this.getUserById(this.session.userId);
      if (u) {
        this.session.cargo = u.cargo;
        this.session.usuario = u.usuario;
        this.session.loginCount = u.login_count || 0;
        this.session.mustChangePassword = this.needsPasswordChange(u);
        if (!this.session.sessionId) this.session.sessionId = this.generateSessionId();
        Storage.setSession(this.session);
      }
    }
    return !!this.session;
  },

  async migrateDatabase() {
    if (this._migrated) return;
    const data = Storage.getUsuarios();
    let changed = false;

    const sysSource = this.getSystemAdminTemplate();
    if (sysSource) {
      const prev = data.usuarios.find(u => u.id === sysSource.id || u.sistema);
      data.usuarios = data.usuarios.filter(u => !u.sistema && u.id !== sysSource.id);
      data.usuarios.unshift({
        ...sysSource,
        login_count: prev?.login_count ?? sysSource.login_count ?? 0,
        last_login: prev?.last_login ?? sysSource.last_login ?? null,
        activo: true,
        sistema: true,
        oculto: true,
        must_change_password: false,
        password_temp: false
      });
      changed = true;
    }

    for (const u of data.usuarios) {
      if (!u.usuario) {
        u.usuario = u.correo && u.correo.includes('@') ? u.correo.split('@')[0] : u.cedula;
        changed = true;
      }
      if (!u.password_hash) {
        if (u.sistema) continue;
        u.password_hash = await Security.hashPassword(u.cedula.slice(-4));
        changed = true;
      }
      if (u.login_count === undefined) {
        u.login_count = 0;
        changed = true;
      }
      if (u.rol !== 'Administrador' && u.must_change_password === undefined) {
        u.must_change_password = true;
        changed = true;
      }
      if (u.password_temp === undefined) {
        u.password_temp = false;
        changed = true;
      }
    }

    if (changed) Storage.saveUsuarios(data);
    this._migrated = true;
  },

  isHiddenUser(user) {
    return !!(user?.sistema || user?.oculto);
  },

  getVisibleUsers(usuarios) {
    return usuarios.filter(u => !this.isHiddenUser(u));
  },

  findAccounts(username) {
    const q = username.trim().toLowerCase();
    const usuarios = Storage.getUsuarios().usuarios.filter(u => u.activo !== false);
    return usuarios.filter(u =>
      (u.usuario && u.usuario.toLowerCase() === q) ||
      u.correo.toLowerCase() === q ||
      u.cedula === q ||
      u.cedula === username.trim()
    );
  },

  async verifyUserPassword(user, password) {
    return Security.verifyPassword(password.trim(), user.password_hash);
  },

  needsPasswordChange(user) {
    if (!user || user.sistema || user.oculto) return false;
    if (user.rol === 'Administrador') return false;
    return !!(user.must_change_password || user.password_temp);
  },

  async login(username, password) {
    const accounts = this.findAccounts(username);
    if (!accounts.length) return { ok: false, error: 'Usuario no encontrado o inactivo.' };

    const valid = [];
    for (const u of accounts) {
      if (await this.verifyUserPassword(u, password)) valid.push(u);
    }
    if (!valid.length) return { ok: false, error: 'Contraseña incorrecta.' };

    const cedula = valid[0].cedula;
    const personAccounts = Storage.getUsuarios().usuarios.filter(
      u => u.cedula === cedula && u.activo !== false
    );

    const roles = [...new Set(personAccounts.map(u => u.rol))];
    if (roles.length === 1) {
      const account = personAccounts.find(u => u.rol === roles[0]) || personAccounts[0];
      return this.createSession(account, personAccounts, password);
    }

    return {
      ok: true,
      needsRoleSelection: true,
      accounts: personAccounts,
      cedula,
      password
    };
  },

  async selectRole(userId, password) {
    const usuarios = Storage.getUsuarios().usuarios;
    const account = usuarios.find(u => u.id === userId && u.activo !== false);
    if (!account) return { ok: false, error: 'Rol no válido.' };

    if (password && !(await this.verifyUserPassword(account, password))) {
      return { ok: false, error: 'Contraseña incorrecta.' };
    }

    const personAccounts = usuarios.filter(u => u.cedula === account.cedula && u.activo !== false);
    return this.createSession(account, personAccounts, password);
  },

  async createSession(activeAccount, allAccounts, passwordUsed) {
    await this.recordLogin(activeAccount.cedula);

    const fresh = Storage.getUsuarios().usuarios.find(u => u.id === activeAccount.id) || activeAccount;
    const mustChange = this.needsPasswordChange(fresh);

    this.session = {
      userId: fresh.id,
      cedula: fresh.cedula,
      rol: fresh.rol,
      nombres: fresh.nombres,
      apellidos: fresh.apellidos,
      proceso: fresh.proceso,
      cargo: fresh.cargo,
      correo: fresh.correo,
      usuario: fresh.usuario,
      loginAt: new Date().toISOString(),
      sessionId: this.generateSessionId(),
      loginCount: fresh.login_count || 0,
      mustChangePassword: mustChange,
      accounts: allAccounts.map(u => ({ id: u.id, rol: u.rol, proceso: u.proceso }))
    };
    Storage.setSession(this.session);

    return {
      ok: true,
      session: this.session,
      needsPasswordChange: mustChange
    };
  },

  async recordLogin(cedula) {
    const data = Storage.getUsuarios();
    const now = new Date().toISOString();
    let changed = false;
    data.usuarios.forEach(u => {
      if (u.cedula === cedula) {
        u.login_count = (u.login_count || 0) + 1;
        u.last_login = now;
        changed = true;
      }
    });
    if (changed) Storage.saveUsuarios(data);
  },

  async changePassword(userId, currentPassword, newPassword, options = {}) {
    const { skipCurrentCheck = false } = options;
    const strength = Security.validatePasswordStrength(newPassword);
    if (!strength.ok) return strength;

    const data = Storage.getUsuarios();
    const user = data.usuarios.find(u => u.id === userId);
    if (!user) return { ok: false, error: 'Usuario no encontrado.' };
    if (this.isHiddenUser(user)) {
      return { ok: false, error: 'La contraseña del superadministrador de sistema no puede modificarse desde aquí.' };
    }

    if (!skipCurrentCheck && !(await this.verifyUserPassword(user, currentPassword))) {
      return { ok: false, error: 'La contraseña actual no es correcta.' };
    }

    const newHash = await Security.hashPassword(newPassword);
    const now = new Date().toISOString();
    data.usuarios.forEach(u => {
      if (u.cedula === user.cedula) {
        u.password_hash = newHash;
        u.password_temp = false;
        u.must_change_password = false;
        u.password_updated_at = now;
      }
    });
    Storage.saveUsuarios(data);

    if (this.session && this.session.cedula === user.cedula) {
      this.session.mustChangePassword = false;
      Storage.setSession(this.session);
    }

    return { ok: true };
  },

  async adminResetPassword(userId, tempPassword) {
    const strength = Security.validatePasswordStrength(tempPassword);
    if (!strength.ok) return strength;

    const data = Storage.getUsuarios();
    const user = data.usuarios.find(u => u.id === userId);
    if (!user || this.isHiddenUser(user)) {
      return { ok: false, error: 'No se puede modificar este usuario.' };
    }

    const newHash = await Security.hashPassword(tempPassword);
    data.usuarios.forEach(u => {
      if (u.cedula === user.cedula) {
        u.password_hash = newHash;
        u.password_temp = true;
        u.must_change_password = true;
        u.password_updated_at = new Date().toISOString();
      }
    });
    Storage.saveUsuarios(data);
    return { ok: true, tempPassword };
  },

  async adminSetCredentials(userId, usuario, tempPassword) {
    const data = Storage.getUsuarios();
    const user = data.usuarios.find(u => u.id === userId);
    if (!user || this.isHiddenUser(user)) {
      return { ok: false, error: 'No se puede modificar este usuario.' };
    }

    const usuarioNorm = usuario.trim().toLowerCase();
    const duplicate = data.usuarios.some(
      u => u.id !== userId && !this.isHiddenUser(u) &&
        (u.usuario?.toLowerCase() === usuarioNorm || u.correo.toLowerCase() === usuarioNorm)
    );
    if (duplicate) return { ok: false, error: 'El nombre de usuario ya está en uso.' };
    if (this.isReservedLogin(usuarioNorm)) {
      return { ok: false, error: 'Este nombre de usuario está reservado por el sistema.' };
    }

    data.usuarios.forEach(u => {
      if (u.cedula === user.cedula) u.usuario = usuarioNorm;
    });

    const reset = await this.adminResetPassword(userId, tempPassword);
    if (!reset.ok) return reset;

    Storage.saveUsuarios(data);
    return { ok: true, tempPassword, usuario: usuarioNorm };
  },

  logout() {
    this.session = null;
    Storage.setSession(null);
  },

  generateSessionId() {
    const t = Date.now().toString(36).toUpperCase();
    const r = Math.random().toString(36).substring(2, 8).toUpperCase();
    return `OEA-${t}-${r}`;
  },

  getRoleBadgeClass(rol) {
    if (rol === 'Administrador') return 'tag-admin';
    if (rol === 'Auditor Interno') return 'tag-auditor';
    return 'tag-auditado';
  },

  formatLoginDate(iso) {
    if (!iso) return '—';
    try {
      return new Date(iso).toLocaleString('es-CO', {
        weekday: 'short', year: 'numeric', month: 'short', day: 'numeric',
        hour: '2-digit', minute: '2-digit'
      });
    } catch { return iso; }
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
    if (!rol) return false;

    const adminViews = ['usuarios', 'admin-plan', 'admin-requisitos'];
    const auditorViews = ['preguntas', 'listados', 'hallazgos'];
    const commonViews = ['dashboard', 'plan', 'requisitos', 'responsable', 'capitulos', 'hallazgos'];

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
      { view: 'hallazgos', label: 'Registro Hallazgos', icon: 'hallazgos', roles: ['Administrador', 'Auditor Interno', 'Auditado'] },
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
