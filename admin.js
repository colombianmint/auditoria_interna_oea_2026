/**
 * Módulos de administración - Usuarios, Plan y Requisitos
 */
const Admin = {
  esc(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  },

  /* ===== USUARIOS ===== */
  renderUsuarios() {
    const data = Storage.getUsuarios();
    const users = data.usuarios || [];
    const activos = users.filter(u => u.activo !== false).length;

    return `
      <div class="space-y-6">
        <div class="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <h2 class="text-2xl lg:text-3xl font-bold text-navy-900">Gestión de Usuarios</h2>
            <p class="text-slate-500 mt-1">${users.length} usuarios registrados · ${activos} activos</p>
          </div>
          <div class="flex gap-2">
            <button onclick="Admin.exportData()" class="btn-secondary">Exportar datos</button>
            <button onclick="Admin.showUserForm()" class="btn-primary">+ Nuevo usuario</button>
          </div>
        </div>

        <div class="info-card">
          <div class="info-card-body overflow-x-auto">
            <table class="admin-table">
              <thead>
                <tr>
                  <th>ID</th><th>Rol</th><th>Proceso</th><th>Nombre</th><th>Cargo</th>
                  <th>Cédula</th><th>Correo</th><th>Estado</th><th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                ${users.map(u => `
                  <tr class="${u.activo === false ? 'opacity-50' : ''}">
                    <td>${u.id}</td>
                    <td><span class="tag ${u.rol === 'Administrador' ? 'tag-admin' : u.rol === 'Auditor Interno' ? 'tag-auditor' : 'tag-auditado'}">${this.esc(u.rol)}</span></td>
                    <td class="text-xs max-w-[140px] truncate" title="${this.esc(u.proceso)}">${this.esc(u.proceso.split(' ').slice(0, 2).join(' '))}</td>
                    <td class="font-medium">${this.esc(u.nombres.split(' ')[0] + ' ' + u.apellidos.split(' ')[0])}</td>
                    <td class="text-xs">${this.esc(u.cargo)}</td>
                    <td>${this.esc(u.cedula)}</td>
                    <td class="text-xs">${this.esc(u.correo)}</td>
                    <td>${u.activo === false ? '<span class="text-red-500">Inactivo</span>' : '<span class="text-mint-600">Activo</span>'}</td>
                    <td class="whitespace-nowrap">
                      <button onclick="Admin.showUserForm(${u.id})" class="text-mint-600 hover:underline text-sm mr-2">Editar</button>
                      <button onclick="Admin.toggleUser(${u.id})" class="text-amber-600 hover:underline text-sm mr-2">${u.activo === false ? 'Activar' : 'Inactivar'}</button>
                      ${u.id !== 0 ? `<button onclick="Admin.deleteUser(${u.id})" class="text-red-500 hover:underline text-sm">Eliminar</button>` : ''}
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
        <p class="text-sm text-slate-500">Contraseña por defecto: últimos 4 dígitos de la cédula. Super Admin: 123456789 / 123456789</p>
      </div>
    `;
  },

  showUserForm(id) {
    const data = Storage.getUsuarios();
    const user = id !== undefined ? data.usuarios.find(u => u.id === id) : null;
    const isNew = !user;
    const nextId = isNew ? Math.max(...data.usuarios.map(u => u.id), 0) + 1 : user.id;

    document.getElementById('modalHeader').innerHTML = `
      <h3 class="text-lg font-bold text-navy-900">${isNew ? 'Nuevo Usuario' : 'Editar Usuario'}</h3>
      <button onclick="App.closeModal()" class="p-2 hover:bg-slate-100 rounded-lg"><svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg></button>
    `;

    document.getElementById('modalBody').innerHTML = `
      <form id="userForm" class="space-y-4">
        <input type="hidden" id="userId" value="${nextId}">
        <div class="grid sm:grid-cols-2 gap-4">
          <div><label class="form-label">Rol</label>
            <select id="userRol" class="select-input" required>
              <option value="Administrador" ${user?.rol === 'Administrador' ? 'selected' : ''}>Administrador</option>
              <option value="Auditor Interno" ${user?.rol === 'Auditor Interno' ? 'selected' : ''}>Auditor Interno</option>
              <option value="Auditado" ${user?.rol === 'Auditado' ? 'selected' : ''}>Auditado</option>
            </select>
          </div>
          <div><label class="form-label">Proceso</label>
            <input type="text" id="userProceso" class="form-input" value="${this.esc(user?.proceso || '')}" required>
          </div>
          <div><label class="form-label">Nombres</label>
            <input type="text" id="userNombres" class="form-input" value="${this.esc(user?.nombres || '')}" required>
          </div>
          <div><label class="form-label">Apellidos</label>
            <input type="text" id="userApellidos" class="form-input" value="${this.esc(user?.apellidos || '')}" required>
          </div>
          <div><label class="form-label">Cargo</label>
            <input type="text" id="userCargo" class="form-input" value="${this.esc(user?.cargo || '')}" required>
          </div>
          <div><label class="form-label">Cédula</label>
            <input type="text" id="userCedula" class="form-input" value="${this.esc(user?.cedula || '')}" required>
          </div>
          <div class="sm:col-span-2"><label class="form-label">Correo</label>
            <input type="email" id="userCorreo" class="form-input" value="${this.esc(user?.correo || '')}" required>
          </div>
        </div>
        <div class="flex justify-end gap-2 pt-4">
          <button type="button" onclick="App.closeModal()" class="btn-secondary">Cancelar</button>
          <button type="submit" class="btn-primary">Guardar</button>
        </div>
      </form>
    `;

    document.getElementById('userForm').addEventListener('submit', e => {
      e.preventDefault();
      this.saveUser(isNew);
    });
    App.openModal();
  },

  saveUser(isNew) {
    const data = Storage.getUsuarios();
    const user = {
      id: parseInt(document.getElementById('userId').value),
      rol: document.getElementById('userRol').value,
      proceso: document.getElementById('userProceso').value.trim(),
      nombres: document.getElementById('userNombres').value.trim().toUpperCase(),
      apellidos: document.getElementById('userApellidos').value.trim().toUpperCase(),
      cargo: document.getElementById('userCargo').value.trim(),
      cedula: document.getElementById('userCedula').value.trim(),
      correo: document.getElementById('userCorreo').value.trim().toLowerCase(),
      activo: true
    };

    if (isNew) {
      data.usuarios.push(user);
    } else {
      const idx = data.usuarios.findIndex(u => u.id === user.id);
      if (idx >= 0) {
        user.activo = data.usuarios[idx].activo !== false;
        data.usuarios[idx] = user;
      }
    }

    Storage.saveUsuarios(data);
    App.closeModal();
    App.showToast('Usuario guardado correctamente');
    App.navigate('usuarios');
  },

  toggleUser(id) {
    if (id === 0) { App.showToast('No se puede inactivar al Super Administrador'); return; }
    const data = Storage.getUsuarios();
    const user = data.usuarios.find(u => u.id === id);
    if (user) {
      user.activo = user.activo === false ? true : false;
      Storage.saveUsuarios(data);
      App.showToast(user.activo ? 'Usuario activado' : 'Usuario inactivado');
      App.navigate('usuarios');
    }
  },

  deleteUser(id) {
    if (id === 0) return;
    if (!confirm('¿Eliminar este usuario permanentemente?')) return;
    const data = Storage.getUsuarios();
    data.usuarios = data.usuarios.filter(u => u.id !== id);
    Storage.saveUsuarios(data);
    App.showToast('Usuario eliminado');
    App.navigate('usuarios');
  },

  /* ===== PLAN ===== */
  renderAdminPlan() {
    const plan = Storage.getPlan();
    const editable = plan.cronograma.filter(c => c.tipo === 'auditoria' || c.tipo === 'reunion');

    return `
      <div class="space-y-6">
        <div class="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <h2 class="text-2xl lg:text-3xl font-bold text-navy-900">Editar Plan de Auditoría</h2>
            <p class="text-slate-500 mt-1">${this.esc(plan.codigo)} · Gestión de cronograma y asignaciones</p>
          </div>
          <button onclick="Admin.savePlan()" class="btn-primary">Guardar cambios</button>
        </div>

        <div id="planEditor" class="space-y-4">
          ${plan.cronograma.map((c, idx) => {
      if (c.tipo === 'dia') {
        return `<div class="py-3 px-4 bg-gold-50 rounded-xl font-bold text-gold-700">${this.esc(c.fecha || 'DÍA')}</div>`;
      }
      if (c.tipo === 'receso') {
        return `<div class="py-2 px-4 bg-slate-50 rounded-lg text-sm text-slate-500 italic">☕ ${this.esc(c.proceso)} · ${this.esc(c.hora)}</div>`;
      }
      return `
              <div class="info-card plan-edit-card" data-plan-idx="${idx}">
                <div class="info-card-header flex justify-between items-center">
                  <span>${c.tipo === 'auditoria' ? '🔍 Auditoría' : '📋 Reunión'} · ${this.esc(c.hora)}</span>
                  <span class="text-xs text-slate-400">${this.esc(c.fecha)}</span>
                </div>
                <div class="info-card-body grid gap-3">
                  <div class="grid sm:grid-cols-2 gap-3">
                    <div><label class="form-label">Fecha auditoría</label>
                      <input type="date" class="form-input plan-field" data-field="fecha" data-idx="${idx}" value="${c.fecha && !c.fecha.startsWith('DIA') ? c.fecha : ''}"></div>
                    <div><label class="form-label">Hora</label>
                      <input type="text" class="form-input plan-field" data-field="hora" data-idx="${idx}" value="${this.esc(c.hora)}"></div>
                  </div>
                  <div><label class="form-label">Proceso / Capítulo Requisito</label>
                    <textarea class="form-input plan-field" data-field="proceso" data-idx="${idx}" rows="3">${this.esc(c.proceso)}</textarea></div>
                  <div><label class="form-label">Síntesis resultados auditoría anterior</label>
                    <textarea class="form-input plan-field" data-field="sintesis_anterior" data-idx="${idx}" rows="3">${this.esc(c.sintesis_anterior)}</textarea></div>
                  <div><label class="form-label">Requisitos de la norma</label>
                    <textarea class="form-input plan-field" data-field="requisitos_norma" data-idx="${idx}" rows="4">${this.esc(c.requisitos_norma)}</textarea></div>
                  <div><label class="form-label">Necesidades para la auditoría</label>
                    <textarea class="form-input plan-field" data-field="necesidades" data-idx="${idx}" rows="2">${this.esc(c.necesidades)}</textarea></div>
                  <div class="grid sm:grid-cols-3 gap-3">
                    <div><label class="form-label">Auditados</label>
                      <input type="text" class="form-input plan-field" data-field="auditados" data-idx="${idx}" value="${this.esc(c.auditados)}"></div>
                    <div><label class="form-label">Auditor interno</label>
                      <input type="text" class="form-input plan-field" data-field="auditor" data-idx="${idx}" value="${this.esc(c.auditor)}"></div>
                    <div><label class="form-label">Observadores</label>
                      <input type="text" class="form-input plan-field" data-field="observadores" data-idx="${idx}" value="${this.esc(c.observadores)}"></div>
                  </div>
                </div>
              </div>
            `;
    }).join('')}
        </div>
      </div>
    `;
  },

  savePlan() {
    const plan = Storage.getPlan();
    document.querySelectorAll('.plan-field').forEach(el => {
      const idx = parseInt(el.dataset.idx);
      const field = el.dataset.field;
      if (plan.cronograma[idx]) plan.cronograma[idx][field] = el.value;
    });
    Storage.savePlan(plan);
    App.plan = plan;
    App.showToast('Plan de auditoría guardado');
  },

  /* ===== REQUISITOS ===== */
  renderAdminRequisitos() {
    const req = Storage.getRequisitos();
    const usuarios = Storage.getUsuarios().usuarios.filter(u => u.activo !== false);

    return `
      <div class="space-y-6">
        <div class="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <h2 class="text-2xl lg:text-3xl font-bold text-navy-900">Editar Responsables de Requisitos</h2>
            <p class="text-slate-500 mt-1">${req.total_requisitos} requisitos · Asignación desde base de usuarios</p>
          </div>
          <button onclick="Admin.saveRequisitos()" class="btn-primary">Guardar cambios</button>
        </div>

        <div class="search-wrapper max-w-xl">
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
          <input type="text" id="adminReqSearch" class="search-input" placeholder="Buscar requisito...">
        </div>

        <div id="adminReqList" class="space-y-3">
          ${req.requisitos.map(r => this.renderReqEditRow(r, usuarios)).join('')}
        </div>
      </div>
    `;
  },

  renderReqEditRow(r, usuarios) {
    const selectedIds = r.responsable_ids || [];
    const options = usuarios.map(u =>
      `<option value="${u.id}" ${selectedIds.includes(u.id) ? 'selected' : ''}>${this.esc(Auth.getUserDisplayName(u))} (${this.esc(u.rol)} - ${this.esc(u.proceso.split(' ').slice(0, 2).join(' '))})</option>`
    ).join('');

    return `
      <div class="info-card req-edit-row" data-req-id="${r.id}" data-search="${this.esc(r.numero + ' ' + r.descripcion).toLowerCase()}">
        <div class="info-card-body">
          <div class="flex flex-col sm:flex-row sm:items-start gap-4">
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2 mb-1">
                <span class="req-number">${this.esc(r.numero)}</span>
                <span class="text-xs text-slate-400">Cap. ${r.capitulo_num}</span>
              </div>
              <p class="text-sm text-slate-700 line-clamp-2">${this.esc(r.descripcion)}</p>
            </div>
            <div class="sm:w-140">
              <label class="form-label">Responsable(s)</label>
              <select multiple class="select-input req-responsables" data-req-id="${r.id}" size="6">${options}</select>
              <p class="text-xs text-slate-400 mt-1">Ctrl+clic para selección múltiple</p>
            </div>
          </div>
        </div>
      </div>
    `;
  },

  bindAdminRequisitosEvents() {
    const search = document.getElementById('adminReqSearch');
    if (search) {
      search.addEventListener('input', () => {
        const q = search.value.toLowerCase();
        document.querySelectorAll('.req-edit-row').forEach(row => {
          row.classList.toggle('hidden', q && !row.dataset.search.includes(q));
        });
      });
    }
  },

  saveRequisitos() {
    const req = Storage.getRequisitos();
    const usuarios = Storage.getUsuarios().usuarios;

    document.querySelectorAll('.req-responsables').forEach(sel => {
      const reqId = sel.dataset.reqId;
      const ids = Array.from(sel.selectedOptions).map(o => parseInt(o.value));
      const r = req.requisitos.find(x => x.id === reqId);
      if (r) {
        r.responsable_ids = ids;
        r.responsables = ids.map(id => {
          const u = usuarios.find(x => x.id === id);
          return u ? Auth.getUserDisplayName(u) : '';
        }).filter(Boolean);
        r.responsable = r.responsables.join(' / ');
      }
    });

    req.responsables = [...new Set(req.requisitos.flatMap(r => r.responsables))].sort();
    Storage.saveRequisitos(req);
    App.requisitos = req;
    App.showToast('Responsables de requisitos guardados');
  },

  exportData() {
    const data = Storage.exportAll();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `oea_backup_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    App.showToast('Datos exportados');
  }
};
