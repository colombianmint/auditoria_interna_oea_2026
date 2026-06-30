/**
 * Persistencia local para datos gestionados en la aplicación OEA
 */
const Storage = {
  KEYS: {
    usuarios: 'oea_usuarios',
    plan: 'oea_plan',
    requisitos: 'oea_requisitos',
    preguntas: 'oea_preguntas',
    listados: 'oea_listados',
    session: 'oea_session'
  },

  get(key) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  },

  set(key, data) {
    localStorage.setItem(key, JSON.stringify(data));
  },

  remove(key) {
    localStorage.removeItem(key);
  },

  getUsuarios() {
    const saved = this.get(this.KEYS.usuarios);
    if (saved?.usuarios) return saved;
    return typeof USUARIOS_DATA !== 'undefined' ? USUARIOS_DATA : { version: '1', usuarios: [] };
  },

  saveUsuarios(data) {
    this.set(this.KEYS.usuarios, data);
  },

  getPlan() {
    return this.get(this.KEYS.plan) || (typeof PLAN_DATA !== 'undefined' ? PLAN_DATA : null);
  },

  savePlan(data) {
    this.set(this.KEYS.plan, data);
  },

  getRequisitos() {
    return this.get(this.KEYS.requisitos) || (typeof REQUISITOS_DATA !== 'undefined' ? REQUISITOS_DATA : null);
  },

  saveRequisitos(data) {
    this.set(this.KEYS.requisitos, data);
  },

  getPreguntas() {
    return this.get(this.KEYS.preguntas) || (typeof PREGUNTAS_DATA !== 'undefined' ? PREGUNTAS_DATA : null);
  },

  savePreguntas(data) {
    this.set(this.KEYS.preguntas, data);
  },

  getListados() {
    return this.get(this.KEYS.listados) || (typeof LISTADOS_DATA !== 'undefined' ? LISTADOS_DATA : null);
  },

  saveListados(data) {
    this.set(this.KEYS.listados, data);
  },

  getSession() {
    return this.get(this.KEYS.session);
  },

  setSession(session) {
    if (session) this.set(this.KEYS.session, session);
    else this.remove(this.KEYS.session);
  },

  exportAll() {
    return {
      usuarios: this.getUsuarios(),
      plan: this.getPlan(),
      requisitos: this.getRequisitos(),
      preguntas: this.getPreguntas(),
      listados: this.getListados(),
      exportedAt: new Date().toISOString()
    };
  },

  importAll(data) {
    if (data.usuarios) this.saveUsuarios(data.usuarios);
    if (data.plan) this.savePlan(data.plan);
    if (data.requisitos) this.saveRequisitos(data.requisitos);
    if (data.preguntas) this.savePreguntas(data.preguntas);
    if (data.listados) this.saveListados(data.listados);
  },

  resetToDefaults() {
    Object.values(this.KEYS).forEach(k => {
      if (k !== this.KEYS.session) this.remove(k);
    });
  }
};
