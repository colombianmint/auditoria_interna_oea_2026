/**
 * Módulo Hallazgos — Auditoría Interna OEA 2026 (Fase 3)
 * Registro de hallazgos, evidencias y exportación
 */
const Hallazgos = {
  TIPOS: [
    'Conforme',
    'Observación',
    'Oportunidad de mejora',
    'No conformidad menor',
    'No conformidad mayor'
  ],
  ESTADOS: ['abierto', 'en_seguimiento', 'cerrado', 'verificado'],
  EVIDENCIA_TIPOS: ['documento', 'registro', 'foto', 'entrevista', 'nota'],

  getData() {
    return Storage.getHallazgos();
  },

  getAll() {
    return this.getData().hallazgos || [];
  },

  getById(id) {
    return this.getAll().find(h => h.id === id);
  },

  getFiltered(filters = {}) {
    let items = this.getVisible();
    if (filters.sesion_id) items = items.filter(h => h.sesion_id === parseInt(filters.sesion_id));
    if (filters.requisito_id) items = items.filter(h => h.requisito_id === filters.requisito_id);
    if (filters.tipo) items = items.filter(h => h.tipo === filters.tipo);
    if (filters.estado) items = items.filter(h => h.estado === filters.estado);
    if (filters.q) {
      const q = filters.q.toLowerCase();
      items = items.filter(h =>
        h.descripcion?.toLowerCase().includes(q) ||
        h.requisito_numero?.toLowerCase().includes(q) ||
        h.id?.toLowerCase().includes(q)
      );
    }
    return items.sort((a, b) => new Date(b.updated_at || b.created_at) - new Date(a.updated_at || a.created_at));
  },

  getVisible() {
    let items = this.getAll();
    if (Auth.isAdmin()) return items;
    if (Auth.isAuditor()) {
      const name = Auth.getShortName().split(' ')[0];
      const sesionIds = (App.listados?.sesiones || [])
        .filter(s => s.auditor?.toUpperCase().includes(name))
        .map(s => s.id);
      return items.filter(h => sesionIds.includes(h.sesion_id) || h.auditor_id === Auth.getUser()?.userId);
    }
    if (Auth.isAuditado()) {
      const reqs = App.getFilteredRequisitos().map(r => r.id);
      return items.filter(h => reqs.includes(h.requisito_id));
    }
    return [];
  },

  getForRequisito(requisitoId) {
    return this.getVisible().filter(h => h.requisito_id === requisitoId);
  },

  getForSesion(sesionId) {
    return this.getVisible().filter(h => h.sesion_id === parseInt(sesionId));
  },

  canEdit(hallazgo) {
    if (Auth.isAdmin()) return true;
    if (Auth.isAuditor()) return hallazgo?.auditor_id === Auth.getUser()?.userId;
    return false;
  },

  canCreate() {
    return Auth.isAdmin() || Auth.isAuditor();
  },

  getStats() {
    const items = this.getVisible().filter(h => h.tipo !== 'Conforme');
    return {
      total: items.length,
      abiertos: items.filter(h => h.estado === 'abierto').length,
      nc: items.filter(h => h.tipo?.includes('conformidad')).length,
      obs: items.filter(h => h.tipo === 'Observación').length,
      om: items.filter(h => h.tipo === 'Oportunidad de mejora').length
    };
  },

  nextId() {
    const year = new Date().getFullYear();
    const prefix = `H-${year}-`;
    const nums = this.getAll()
      .filter(h => h.id?.startsWith(prefix))
      .map(h => parseInt(h.id.replace(prefix, ''), 10))
      .filter(n => !isNaN(n));
    const next = nums.length ? Math.max(...nums) + 1 : 1;
    return `${prefix}${String(next).padStart(3, '0')}`;
  },

  tipoClass(tipo) {
    if (tipo === 'Conforme') return 'hallazgo-tipo-conforme';
    if (tipo?.includes('mayor')) return 'hallazgo-tipo-nc-mayor';
    if (tipo?.includes('menor')) return 'hallazgo-tipo-nc-menor';
    if (tipo === 'Observación') return 'hallazgo-tipo-obs';
    return 'hallazgo-tipo-om';
  },

  estadoLabel(estado) {
    const map = {
      abierto: 'Abierto',
      en_seguimiento: 'En seguimiento',
      cerrado: 'Cerrado',
      verificado: 'Verificado'
    };
    return map[estado] || estado;
  },

  /* ===== VISTA PRINCIPAL ===== */
  renderHallazgos() {
    const stats = this.getStats();
    const sesiones = App.listados?.sesiones || [];
    const mySesiones = Auth.isAdmin() ? sesiones : sesiones.filter(s => {
      const name = Auth.getShortName().split(' ')[0];
      return s.auditor?.toUpperCase().includes(name);
    });

    return `
      <div class="space-y-6">
        <div class="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
          <div>
            <h2 class="text-2xl lg:text-3xl font-bold text-navy-900">Registro de Hallazgos</h2>
            <p class="text-slate-500 mt-1">Auditoría Interna OEA 2026 · GMC-FR08 · Trazabilidad ISO 9001:2015</p>
          </div>
          <div class="flex flex-wrap gap-2">
            ${this.canCreate() ? `<button type="button" onclick="Hallazgos.showForm()" class="btn-primary">+ Nuevo hallazgo</button>` : ''}
            <button type="button" onclick="Hallazgos.exportJson()" class="btn-secondary">Exportar JSON</button>
            <button type="button" onclick="Hallazgos.exportCsv()" class="btn-secondary">Exportar CSV</button>
            <button type="button" onclick="Hallazgos.printReport()" class="btn-secondary">Imprimir / PDF</button>
          </div>
        </div>

        <div class="grid grid-cols-2 lg:grid-cols-5 gap-3">
          <div class="stat-card"><p class="text-sm text-slate-500">Total hallazgos</p><p class="text-2xl font-bold text-navy-800">${stats.total}</p></div>
          <div class="stat-card"><p class="text-sm text-slate-500">Abiertos</p><p class="text-2xl font-bold text-red-600">${stats.abiertos}</p></div>
          <div class="stat-card"><p class="text-sm text-slate-500">No conformidades</p><p class="text-2xl font-bold text-orange-600">${stats.nc}</p></div>
          <div class="stat-card"><p class="text-sm text-slate-500">Observaciones</p><p class="text-2xl font-bold text-amber-600">${stats.obs}</p></div>
          <div class="stat-card"><p class="text-sm text-slate-500">Oport. mejora</p><p class="text-2xl font-bold text-mint-700">${stats.om}</p></div>
        </div>

        <div class="info-card">
          <div class="info-card-header">Filtros</div>
          <div class="info-card-body">
            <div class="grid sm:grid-cols-2 lg:grid-cols-5 gap-3">
              <div>
                <label class="form-label">Sesión</label>
                <select id="filtroHallazgoSesion" class="select-input">
                  <option value="">Todas</option>
                  ${mySesiones.map(s => `<option value="${s.id}">Sesión ${s.id} · ${App.esc(s.fecha)}</option>`).join('')}
                </select>
              </div>
              <div>
                <label class="form-label">Tipo</label>
                <select id="filtroHallazgoTipo" class="select-input">
                  <option value="">Todos</option>
                  ${this.TIPOS.map(t => `<option value="${t}">${t}</option>`).join('')}
                </select>
              </div>
              <div>
                <label class="form-label">Estado</label>
                <select id="filtroHallazgoEstado" class="select-input">
                  <option value="">Todos</option>
                  ${this.ESTADOS.map(e => `<option value="${e}">${this.estadoLabel(e)}</option>`).join('')}
                </select>
              </div>
              <div class="sm:col-span-2">
                <label class="form-label">Buscar</label>
                <input type="search" id="filtroHallazgoQ" class="form-input" placeholder="ID, requisito, descripción...">
              </div>
            </div>
          </div>
        </div>

        <div id="hallazgosList">${this.renderList()}</div>
      </div>
    `;
  },

  renderList() {
    const filters = this.getActiveFilters();
    const items = this.getFiltered(filters);

    if (!items.length) {
      return `<div class="text-center py-16 text-slate-400">
        <p class="text-lg font-medium">Sin hallazgos registrados</p>
        <p class="text-sm mt-2">${this.canCreate() ? 'Use "Nuevo hallazgo" o regístrelo desde el banco de preguntas.' : 'No hay hallazgos visibles para su rol.'}</p>
      </div>`;
    }

    return items.map(h => this.renderCard(h)).join('');
  },

  renderCard(h) {
    const evidCount = h.evidencias?.length || 0;
    const sesion = App.listados?.sesiones?.find(s => s.id === h.sesion_id);
    return `
      <div class="hallazgo-card mb-4">
        <div class="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div class="flex-1 min-w-0">
            <div class="flex flex-wrap items-center gap-2 mb-2">
              <span class="font-mono text-sm font-bold text-navy-800">${App.esc(h.id)}</span>
              <span class="tag ${this.tipoClass(h.tipo)}">${App.esc(h.tipo)}</span>
              <span class="tag tag-proceso">${App.esc(this.estadoLabel(h.estado))}</span>
              ${h.requisito_numero ? `<span class="req-number">${App.esc(h.requisito_numero)}</span>` : ''}
            </div>
            <p class="text-slate-700 leading-relaxed">${App.esc(h.descripcion)}</p>
            <div class="flex flex-wrap gap-x-4 gap-y-1 mt-3 text-xs text-slate-500">
              ${sesion ? `<span>Sesión ${h.sesion_id} · ${App.esc(sesion.fecha)}</span>` : ''}
              ${h.pregunta_id ? `<span>Pregunta #${h.pregunta_id}</span>` : ''}
              <span>Auditor: ${App.esc(h.auditor_nombre)}</span>
              <span>${evidCount} evidencia(s)</span>
              <span>Actualizado: ${App.esc(Auth.formatLoginDate(h.updated_at || h.created_at))}</span>
            </div>
            ${h.accion_correctiva ? `<p class="text-sm text-mint-800 mt-2 bg-mint-50 rounded-lg px-3 py-2"><strong>Acción:</strong> ${App.esc(h.accion_correctiva)}</p>` : ''}
          </div>
          <div class="flex gap-2 flex-shrink-0">
            <button type="button" onclick="Hallazgos.showDetail('${h.id}')" class="btn-secondary text-sm py-2">Ver</button>
            ${this.canEdit(h) ? `
              <button type="button" onclick="Hallazgos.showForm('${h.id}')" class="btn-secondary text-sm py-2">Editar</button>
              <button type="button" onclick="Hallazgos.deleteHallazgo('${h.id}')" class="text-sm py-2 px-3 text-red-600 hover:bg-red-50 rounded-xl">Eliminar</button>
            ` : ''}
          </div>
        </div>
        ${evidCount ? `
          <div class="mt-3 pt-3 border-t border-slate-100 flex flex-wrap gap-2">
            ${h.evidencias.map(e => `<span class="evidencia-chip" title="${App.esc(e.notas || '')}">📎 ${App.esc(e.nombre || e.referencia)}</span>`).join('')}
          </div>
        ` : ''}
      </div>
    `;
  },

  getActiveFilters() {
    return {
      sesion_id: document.getElementById('filtroHallazgoSesion')?.value,
      tipo: document.getElementById('filtroHallazgoTipo')?.value,
      estado: document.getElementById('filtroHallazgoEstado')?.value,
      q: document.getElementById('filtroHallazgoQ')?.value
    };
  },

  refreshList() {
    const el = document.getElementById('hallazgosList');
    if (el) el.innerHTML = this.renderList();
  },

  bindEvents() {
    ['filtroHallazgoSesion', 'filtroHallazgoTipo', 'filtroHallazgoEstado'].forEach(id => {
      document.getElementById(id)?.addEventListener('change', () => this.refreshList());
    });
    document.getElementById('filtroHallazgoQ')?.addEventListener('input', () => this.refreshList());
  },

  /* ===== FORMULARIO ===== */
  showForm(idOrPrefill) {
    if (!this.canCreate() && typeof idOrPrefill === 'string') {
      const h = this.getById(idOrPrefill);
      if (!this.canEdit(h)) {
        App.showToast('No tiene permisos para editar este hallazgo');
        return;
      }
    } else if (!this.canCreate()) {
      App.showToast('No tiene permisos para crear hallazgos');
      return;
    }

    let prefill = {};
    let existing = null;

    if (typeof idOrPrefill === 'string') {
      existing = this.getById(idOrPrefill);
    } else if (idOrPrefill && typeof idOrPrefill === 'object') {
      prefill = idOrPrefill;
    }

    const h = existing || prefill || {};
    const sesiones = App.listados?.sesiones || [];
    const mySesiones = Auth.isAdmin() ? sesiones : sesiones.filter(s => {
      const name = Auth.getShortName().split(' ')[0];
      return s.auditor?.toUpperCase().includes(name);
    });

    document.getElementById('modalHeader').innerHTML = `
      <div>
        <h3 class="text-lg font-bold text-navy-900">${existing ? 'Editar hallazgo' : 'Registrar hallazgo'}</h3>
        <p class="text-sm text-slate-500">${existing ? App.esc(existing.id) : 'Nuevo registro de auditoría interna'}</p>
      </div>
      <button onclick="App.closeModal()" class="p-2 hover:bg-slate-100 rounded-lg"><svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg></button>
    `;

    const reqOptions = (App.requisitos?.requisitos || []).map(r =>
      `<option value="${r.id}" data-numero="${App.esc(r.numero)}" ${h.requisito_id === r.id ? 'selected' : ''}>${App.esc(r.numero)} — ${App.esc(r.descripcion.slice(0, 60))}...</option>`
    ).join('');

    document.getElementById('modalBody').innerHTML = `
      <form id="hallazgoForm" class="space-y-4">
        <input type="hidden" id="hallazgoEditId" value="${existing?.id || ''}">
        <div class="grid sm:grid-cols-2 gap-4">
          <div>
            <label class="form-label">Sesión de auditoría *</label>
            <select id="hallazgoSesion" class="select-input" required>
              <option value="">Seleccione...</option>
              ${mySesiones.map(s => `<option value="${s.id}" ${h.sesion_id === s.id ? 'selected' : ''}>Sesión ${s.id} · ${App.esc(s.fecha)} · ${App.esc(s.proceso)}</option>`).join('')}
            </select>
          </div>
          <div>
            <label class="form-label">Requisito OEA *</label>
            <select id="hallazgoRequisito" class="select-input" required>
              <option value="">Seleccione...</option>
              ${reqOptions}
            </select>
          </div>
        </div>
        <div class="grid sm:grid-cols-2 gap-4">
          <div>
            <label class="form-label">Tipo de hallazgo *</label>
            <select id="hallazgoTipo" class="select-input" required>
              ${this.TIPOS.map(t => `<option value="${t}" ${h.tipo === t ? 'selected' : ''}>${t}</option>`).join('')}
            </select>
          </div>
          <div>
            <label class="form-label">Estado</label>
            <select id="hallazgoEstado" class="select-input">
              ${this.ESTADOS.map(e => `<option value="${e}" ${(h.estado || 'abierto') === e ? 'selected' : ''}>${this.estadoLabel(e)}</option>`).join('')}
            </select>
          </div>
        </div>
        <div>
          <label class="form-label">Pregunta relacionada (opcional)</label>
          <select id="hallazgoPregunta" class="select-input">
            <option value="">— Ninguna —</option>
          </select>
        </div>
        <div>
          <label class="form-label">Descripción del hallazgo *</label>
          <textarea id="hallazgoDescripcion" class="form-input min-h-[100px]" required placeholder="Describa el hallazgo, criterio evaluado y contexto...">${App.esc(h.descripcion || '')}</textarea>
        </div>
        <div>
          <label class="form-label">Acción correctiva / recomendación</label>
          <textarea id="hallazgoAccion" class="form-input min-h-[80px]" placeholder="Acción propuesta o plan de tratamiento...">${App.esc(h.accion_correctiva || '')}</textarea>
        </div>
        <div>
          <div class="flex items-center justify-between mb-2">
            <label class="form-label mb-0">Evidencias</label>
            <button type="button" onclick="Hallazgos.addEvidenciaRow()" class="text-sm text-mint-700 font-medium">+ Agregar evidencia</button>
          </div>
          <div id="evidenciasContainer" class="space-y-2"></div>
        </div>
        <div class="flex gap-2 pt-2">
          <button type="submit" class="btn-primary flex-1 py-3">Guardar hallazgo</button>
          <button type="button" onclick="App.closeModal()" class="btn-secondary py-3 px-6">Cancelar</button>
        </div>
      </form>
    `;

    this.renderEvidenciaRows(h.evidencias || [{ tipo: 'documento', nombre: '', referencia: '', notas: '' }]);
    this.populatePreguntas(h.requisito_id, h.pregunta_id);

    document.getElementById('hallazgoRequisito').addEventListener('change', e => {
      this.populatePreguntas(e.target.value);
    });
    document.getElementById('hallazgoSesion').addEventListener('change', e => {
      this.filterRequisitosBySesion(parseInt(e.target.value));
    });

    if (h.sesion_id) this.filterRequisitosBySesion(h.sesion_id, h.requisito_id);

    document.getElementById('hallazgoForm').addEventListener('submit', e => {
      e.preventDefault();
      this.saveHallazgo();
    });

    App.openModal();
  },

  filterRequisitosBySesion(sesionId, selectedId) {
    const sel = document.getElementById('hallazgoRequisito');
    if (!sel || !sesionId) return;
    const sesion = App.listados?.sesiones?.find(s => s.id === sesionId);
    if (!sesion?.requisitos_ids?.length) return;

    const ids = sesion.requisitos_ids;
    [...sel.options].forEach(opt => {
      if (!opt.value) return;
      opt.hidden = !ids.includes(opt.value);
    });
    if (selectedId) sel.value = selectedId;
    else if (!ids.includes(sel.value)) sel.value = '';
    this.populatePreguntas(sel.value);
  },

  populatePreguntas(requisitoId, selectedPregunta) {
    const sel = document.getElementById('hallazgoPregunta');
    if (!sel) return;
    const pq = App.preguntas?.requisitos?.find(p => p.requisito_id === requisitoId);
    if (!pq?.preguntas?.length) {
      sel.innerHTML = '<option value="">— Sin preguntas —</option>';
      return;
    }
    sel.innerHTML = '<option value="">— Ninguna —</option>' +
      pq.preguntas.map(p => `<option value="${p.id}" ${selectedPregunta == p.id ? 'selected' : ''}>${p.id}. ${App.esc(p.texto.slice(0, 80))}...</option>`).join('');
  },

  renderEvidenciaRows(evidencias) {
    const container = document.getElementById('evidenciasContainer');
    if (!container) return;
    container.innerHTML = evidencias.map((e, i) => this.evidenciaRowHtml(e, i)).join('');
  },

  evidenciaRowHtml(e, idx) {
    return `
      <div class="evidencia-row grid sm:grid-cols-4 gap-2 p-3 bg-slate-50 rounded-xl" data-idx="${idx}">
        <div>
          <label class="text-xs text-slate-500">Tipo</label>
          <select class="select-input text-sm evid-tipo">
            ${this.EVIDENCIA_TIPOS.map(t => `<option value="${t}" ${e.tipo === t ? 'selected' : ''}>${t}</option>`).join('')}
          </select>
        </div>
        <div>
          <label class="text-xs text-slate-500">Nombre / título</label>
          <input type="text" class="form-input text-sm evid-nombre" value="${App.esc(e.nombre || '')}" placeholder="Ej. Listado de inventario">
        </div>
        <div>
          <label class="text-xs text-slate-500">Referencia (código doc.)</label>
          <input type="text" class="form-input text-sm evid-ref" value="${App.esc(e.referencia || '')}" placeholder="Ej. GPE-FR07">
        </div>
        <div class="flex gap-1 items-end">
          <div class="flex-1">
            <label class="text-xs text-slate-500">Notas</label>
            <input type="text" class="form-input text-sm evid-notas" value="${App.esc(e.notas || '')}">
          </div>
          <button type="button" onclick="this.closest('.evidencia-row').remove()" class="p-2 text-red-500 hover:bg-red-50 rounded-lg" title="Quitar">×</button>
        </div>
      </div>
    `;
  },

  addEvidenciaRow() {
    const container = document.getElementById('evidenciasContainer');
    const idx = container.querySelectorAll('.evidencia-row').length;
    container.insertAdjacentHTML('beforeend', this.evidenciaRowHtml({ tipo: 'documento' }, idx));
  },

  collectEvidencias() {
    const rows = document.querySelectorAll('.evidencia-row');
    const user = Auth.getUser();
    const now = new Date().toISOString();
    const evidencias = [];
    rows.forEach((row, i) => {
      const nombre = row.querySelector('.evid-nombre')?.value.trim();
      const referencia = row.querySelector('.evid-ref')?.value.trim();
      const notas = row.querySelector('.evid-notas')?.value.trim();
      const tipo = row.querySelector('.evid-tipo')?.value;
      if (!nombre && !referencia && !notas) return;
      evidencias.push({
        id: i + 1,
        tipo,
        nombre: nombre || referencia,
        referencia: referencia || '',
        notas: notas || '',
        capturado_por: user?.userId,
        capturado_nombre: Auth.getFullName(user),
        fecha: now
      });
    });
    return evidencias;
  },

  saveHallazgo() {
    const editId = document.getElementById('hallazgoEditId')?.value;
    const sesionId = parseInt(document.getElementById('hallazgoSesion').value);
    const requisitoId = document.getElementById('hallazgoRequisito').value;
    const reqSel = document.getElementById('hallazgoRequisito');
    const reqNumero = reqSel.selectedOptions[0]?.dataset?.numero || '';
    const descripcion = document.getElementById('hallazgoDescripcion').value.trim();
    const preguntaVal = document.getElementById('hallazgoPregunta').value;

    if (!descripcion) {
      App.showToast('La descripción es obligatoria');
      return;
    }

    const now = new Date().toISOString();
    const user = Auth.getUser();
    const data = this.getData();
    const payload = {
      sesion_id: sesionId,
      requisito_id: requisitoId,
      requisito_numero: reqNumero,
      pregunta_id: preguntaVal ? parseInt(preguntaVal) : null,
      tipo: document.getElementById('hallazgoTipo').value,
      estado: document.getElementById('hallazgoEstado').value,
      descripcion,
      accion_correctiva: document.getElementById('hallazgoAccion').value.trim(),
      evidencias: this.collectEvidencias(),
      auditor_id: user?.userId,
      auditor_nombre: Auth.getFullName(user),
      updated_at: now
    };

    if (editId) {
      const idx = data.hallazgos.findIndex(h => h.id === editId);
      if (idx >= 0) {
        data.hallazgos[idx] = { ...data.hallazgos[idx], ...payload };
      }
    } else {
      data.hallazgos.push({
        id: this.nextId(),
        ...payload,
        created_at: now
      });
    }

    Storage.saveHallazgos(data);
    App.hallazgos = data;
    App.closeModal();
    App.showToast(editId ? 'Hallazgo actualizado' : 'Hallazgo registrado');
    if (App.currentView === 'hallazgos') App.navigate('hallazgos');
  },

  deleteHallazgo(id) {
    const h = this.getById(id);
    if (!this.canEdit(h)) {
      App.showToast('No tiene permisos');
      return;
    }
    if (!confirm(`¿Eliminar el hallazgo ${id}? Esta acción no se puede deshacer.`)) return;

    const data = this.getData();
    data.hallazgos = data.hallazgos.filter(x => x.id !== id);
    Storage.saveHallazgos(data);
    App.hallazgos = data;
    App.showToast('Hallazgo eliminado');
    this.refreshList();
  },

  showDetail(id) {
    const h = this.getById(id);
    if (!h) return;
    const sesion = App.listados?.sesiones?.find(s => s.id === h.sesion_id);

    document.getElementById('modalHeader').innerHTML = `
      <div>
        <span class="font-mono font-bold text-navy-900">${App.esc(h.id)}</span>
        <div class="flex gap-2 mt-2">
          <span class="tag ${this.tipoClass(h.tipo)}">${App.esc(h.tipo)}</span>
          <span class="tag tag-proceso">${App.esc(this.estadoLabel(h.estado))}</span>
        </div>
      </div>
      <button onclick="App.closeModal()" class="p-2 hover:bg-slate-100 rounded-lg"><svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg></button>
    `;

    let body = `
      <div class="grid sm:grid-cols-2 gap-4 mb-4 text-sm">
        <div><p class="text-xs text-slate-400 uppercase">Requisito</p><p class="font-medium">${App.esc(h.requisito_numero)}</p></div>
        <div><p class="text-xs text-slate-400 uppercase">Sesión</p><p class="font-medium">${sesion ? `Sesión ${h.sesion_id} · ${App.esc(sesion.fecha)}` : h.sesion_id}</p></div>
        <div><p class="text-xs text-slate-400 uppercase">Auditor</p><p class="font-medium">${App.esc(h.auditor_nombre)}</p></div>
        <div><p class="text-xs text-slate-400 uppercase">Registrado</p><p class="font-medium">${App.esc(Auth.formatLoginDate(h.created_at))}</p></div>
      </div>
      <div class="detail-section hallazgo"><h4>Descripción</h4><div class="content">${App.esc(h.descripcion)}</div></div>
    `;

    if (h.accion_correctiva) {
      body += `<div class="detail-section evidencia"><h4>Acción correctiva</h4><div class="content">${App.esc(h.accion_correctiva)}</div></div>`;
    }

    if (h.evidencias?.length) {
      body += `<div class="detail-section evidencia"><h4>Evidencias (${h.evidencias.length})</h4><div class="content"><ul class="space-y-2">`;
      h.evidencias.forEach(e => {
        body += `<li class="p-2 bg-slate-50 rounded-lg"><strong>${App.esc(e.nombre)}</strong> <span class="text-xs text-slate-500">[${App.esc(e.tipo)}]</span>
          ${e.referencia ? `<br><span class="text-sm font-mono">${App.esc(e.referencia)}</span>` : ''}
          ${e.notas ? `<br><span class="text-sm text-slate-600">${App.esc(e.notas)}</span>` : ''}
          <br><span class="text-xs text-slate-400">${App.esc(e.capturado_nombre)} · ${App.esc(Auth.formatLoginDate(e.fecha))}</span></li>`;
      });
      body += `</ul></div></div>`;
    }

    if (this.canEdit(h)) {
      body += `<div class="mt-4 flex gap-2">
        <button type="button" onclick="App.closeModal(); Hallazgos.showForm('${h.id}')" class="btn-primary">Editar</button>
      </div>`;
    }

    document.getElementById('modalBody').innerHTML = body;
    App.openModal();
  },

  renderRequisitoSection(requisitoId) {
    const items = this.getForRequisito(requisitoId).filter(h => h.tipo !== 'Conforme');
    if (!items.length) return '';
    return `
      <div class="detail-section hallazgo">
        <h4>📋 Hallazgos Internos 2026 (${items.length})</h4>
        <div class="content space-y-2">
          ${items.map(h => `
            <div class="p-2 bg-white/50 rounded-lg cursor-pointer hover:bg-white/80" onclick="Hallazgos.showDetail('${h.id}')">
              <span class="font-mono text-xs font-bold">${App.esc(h.id)}</span>
              <span class="tag ${this.tipoClass(h.tipo)} ml-2 text-xs">${App.esc(h.tipo)}</span>
              <p class="text-sm mt-1">${App.esc(h.descripcion.slice(0, 150))}${h.descripcion.length > 150 ? '...' : ''}</p>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  },

  /* ===== EXPORTACIÓN ===== */
  exportJson() {
    const data = { ...this.getData(), hallazgos: this.getFiltered(this.getActiveFilters()) };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `oea_hallazgos_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    App.showToast('Hallazgos exportados (JSON)');
  },

  exportCsv() {
    const items = this.getFiltered(this.getActiveFilters());
    const headers = ['ID', 'Sesión', 'Requisito', 'Tipo', 'Estado', 'Descripción', 'Acción correctiva', 'Auditor', 'Evidencias', 'Creado', 'Actualizado'];
    const rows = items.map(h => [
      h.id, h.sesion_id, h.requisito_numero, h.tipo, h.estado,
      `"${(h.descripcion || '').replace(/"/g, '""')}"`,
      `"${(h.accion_correctiva || '').replace(/"/g, '""')}"`,
      h.auditor_nombre,
      h.evidencias?.length || 0,
      h.created_at, h.updated_at
    ]);
    const csv = [headers.join(';'), ...rows.map(r => r.join(';'))].join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `oea_hallazgos_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    App.showToast('Hallazgos exportados (CSV)');
  },

  printReport() {
    const items = this.getFiltered(this.getActiveFilters());
    const user = Auth.getUser();
    const win = window.open('', '_blank');
    if (!win) {
      App.showToast('Permita ventanas emergentes para imprimir');
      return;
    }

    win.document.write(`<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>Informe Hallazgos OEA 2026</title>
      <style>
        body{font-family:Inter,system-ui,sans-serif;padding:2rem;color:#1e293b;font-size:11pt}
        h1{font-size:18pt;margin:0} .meta{color:#64748b;font-size:10pt;margin:1rem 0}
        table{width:100%;border-collapse:collapse;margin-top:1rem;font-size:9pt}
        th,td{border:1px solid #cbd5e1;padding:6px 8px;text-align:left;vertical-align:top}
        th{background:#f1f5f9} .footer{margin-top:2rem;font-size:9pt;color:#64748b;border-top:1px solid #e2e8f0;padding-top:1rem}
        @media print{body{padding:0}}
      </style></head><body>
      <h1>Informe de Hallazgos — Auditoría Interna OEA 2026</h1>
      <p class="meta">C.I. Colombian Mint S.A.S. · SGC ISO 9001:2015 · ${new Date().toLocaleString('es-CO')}</p>
      <p class="meta">Generado por: ${App.esc(Auth.getFullName(user))} · Rol: ${App.esc(user?.rol)} · Total: ${items.length} hallazgos</p>
      <table><thead><tr>
        <th>ID</th><th>Sesión</th><th>Requisito</th><th>Tipo</th><th>Estado</th><th>Descripción</th><th>Acción</th><th>Evid.</th>
      </tr></thead><tbody>
      ${items.map(h => `<tr>
        <td>${App.esc(h.id)}</td><td>${h.sesion_id}</td><td>${App.esc(h.requisito_numero)}</td>
        <td>${App.esc(h.tipo)}</td><td>${App.esc(this.estadoLabel(h.estado))}</td>
        <td>${App.esc(h.descripcion)}</td><td>${App.esc(h.accion_correctiva || '—')}</td><td>${h.evidencias?.length || 0}</td>
      </tr>`).join('')}
      </tbody></table>
      <div class="footer">Documento generado desde el Sistema de Auditoría Interna OEA · Res. 000015/2016</div>
      </body></html>`);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 400);
  }
};
