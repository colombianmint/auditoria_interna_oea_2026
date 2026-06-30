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
    const users = Auth.getVisibleUsers(data.usuarios || []);
    const activos = users.filter(u => u.activo !== false).length;

    return `
      <div class="space-y-6">
        <div class="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <h2 class="text-2xl lg:text-3xl font-bold text-navy-900">Gestión de Usuarios</h2>
            <p class="text-slate-500 mt-1">${users.length} usuarios · ${activos} activos · Trazabilidad de ingresos</p>
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
                  <th>ID</th><th>Rol</th><th>Usuario</th><th>Nombre</th><th>Proceso</th>
                  <th>Ingresos</th><th>Último acceso</th><th>Estado</th><th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                ${users.map(u => `
                  <tr class="${u.activo === false ? 'opacity-50' : ''}">
                    <td>${u.id}</td>
                    <td><span class="tag ${u.rol === 'Administrador' ? 'tag-admin' : u.rol === 'Auditor Interno' ? 'tag-auditor' : 'tag-auditado'}">${this.esc(u.rol)}</span></td>
                    <td class="font-mono text-xs">${this.esc(u.usuario || '—')}${u.password_temp ? ' <span class="text-amber-600" title="Contraseña temporal">⏳</span>' : ''}</td>
                    <td class="font-medium">${this.esc(u.nombres.split(' ')[0] + ' ' + u.apellidos.split(' ')[0])}</td>
                    <td class="text-xs max-w-[120px] truncate" title="${this.esc(u.proceso)}">${this.esc(u.proceso.split(' ').slice(0, 2).join(' '))}</td>
                    <td class="text-center font-semibold text-mint-700">${u.login_count || 0}</td>
                    <td class="text-xs">${u.last_login ? this.esc(u.last_login.slice(0, 16).replace('T', ' ')) : '—'}</td>
                    <td>${u.activo === false ? '<span class="text-red-500">Inactivo</span>' : '<span class="text-mint-600">Activo</span>'}</td>
                    <td class="whitespace-nowrap">
                      <button onclick="Admin.showUserForm(${u.id})" class="text-mint-600 hover:underline text-sm mr-2">Editar</button>
                      <button onclick="Admin.showResetPassword(${u.id})" class="text-navy-700 hover:underline text-sm mr-2">Contraseña</button>
                      <button onclick="Admin.toggleUser(${u.id})" class="text-amber-600 hover:underline text-sm mr-2">${u.activo === false ? 'Activar' : 'Inactivar'}</button>
                      ${u.id !== 0 ? `<button onclick="Admin.deleteUser(${u.id})" class="text-red-500 hover:underline text-sm">Eliminar</button>` : ''}
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
        <p class="text-sm text-slate-500">Contraseña inicial: últimos 4 dígitos de la cédula (primer ingreso obliga cambio). El administrador puede asignar usuario y contraseña temporal.</p>
      </div>
    `;
  },

  showUserForm(id) {
    const data = Storage.getUsuarios();
    const user = id !== undefined ? data.usuarios.find(u => u.id === id) : null;
    if (user && Auth.isHiddenUser(user)) {
      App.showToast('No se puede modificar la cuenta de superadministrador');
      return;
    }
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
          <div><label class="form-label">Nombre de usuario (login)</label>
            <input type="text" id="userLogin" class="form-input" value="${this.esc(user?.usuario || '')}" required
              placeholder="Ej: jzuluaga o correo">
          </div>
          ${isNew ? `
          <div><label class="form-label">Contraseña temporal</label>
            <div class="flex gap-2">
              <input type="text" id="userTempPass" class="form-input flex-1" required minlength="6" placeholder="Mínimo 6 caracteres">
              <button type="button" onclick="Admin.generateTempPass()" class="btn-secondary whitespace-nowrap">Generar</button>
            </div>
            <p class="text-xs text-slate-400 mt-1">El usuario deberá cambiarla en su primer ingreso.</p>
          </div>
          ` : `
          <div class="sm:col-span-2 p-3 bg-slate-50 rounded-lg text-sm">
            <p><strong>Ingresos:</strong> ${user?.login_count || 0} · <strong>Último acceso:</strong> ${user?.last_login ? this.esc(user.last_login.slice(0, 16).replace('T', ' ')) : 'Nunca'}</p>
            ${user?.password_temp ? '<p class="text-amber-600 mt-1">⏳ Contraseña temporal activa — debe cambiarla al ingresar.</p>' : ''}
          </div>
          `}
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

  generateTempPass() {
    const input = document.getElementById('userTempPass');
    if (input) input.value = Security.generateTempPassword(8);
  },

  async saveUser(isNew) {
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
      usuario: document.getElementById('userLogin').value.trim().toLowerCase(),
      activo: true,
      login_count: 0,
      last_login: null,
      password_temp: true,
      must_change_password: true
    };

    if (user.id === 0 || Auth.isHiddenUser(data.usuarios.find(u => u.id === user.id))) {
      App.showToast('No se puede modificar la cuenta de superadministrador');
      return;
    }

    if (Auth.isReservedLogin(user.usuario) || Auth.isReservedLogin(user.cedula)) {
      App.showToast('El usuario o cédula «123456789» está reservado para el superadministrador del sistema');
      return;
    }

    if (isNew) {
      const tempPass = document.getElementById('userTempPass')?.value;
      if (!tempPass) {
        App.showToast('Indique una contraseña temporal');
        return;
      }
      user.password_hash = await Security.hashPassword(tempPass);
      data.usuarios.push(user);
      Storage.saveUsuarios(data);
      App.closeModal();
      this.showTempPasswordResult(user.usuario, tempPass, 'Usuario creado');
      return;
    } else {
      const idx = data.usuarios.findIndex(u => u.id === user.id);
      if (idx >= 0) {
        const prev = data.usuarios[idx];
        user.activo = prev.activo !== false;
        user.password_hash = prev.password_hash;
        user.password_temp = prev.password_temp;
        user.must_change_password = prev.must_change_password;
        user.login_count = prev.login_count || 0;
        user.last_login = prev.last_login;
        data.usuarios[idx] = user;
        data.usuarios.forEach(u => {
          if (u.cedula === user.cedula && u.id !== user.id) {
            u.usuario = user.usuario;
          }
        });
      }
      Storage.saveUsuarios(data);
      App.closeModal();
      App.showToast('Usuario guardado correctamente');
      App.navigate('usuarios');
      return;
    }
  },

  showResetPassword(id) {
    const user = Auth.getUserById(id);
    if (!user || Auth.isHiddenUser(user)) return;

    document.getElementById('modalHeader').innerHTML = `
      <h3 class="text-lg font-bold text-navy-900">Restablecer contraseña</h3>
      <button onclick="App.closeModal()" class="p-2 hover:bg-slate-100 rounded-lg"><svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg></button>
    `;

    document.getElementById('modalBody').innerHTML = `
      <p class="text-sm text-slate-600 mb-4">Usuario: <strong>${this.esc(user.usuario)}</strong> · ${this.esc(Auth.getFullName(user))}</p>
      <form id="resetPassForm" class="space-y-4">
        <input type="hidden" id="resetUserId" value="${id}">
        <div><label class="form-label">Nuevo nombre de usuario (opcional)</label>
          <input type="text" id="resetUsuario" class="form-input" value="${this.esc(user.usuario || '')}"></div>
        <div><label class="form-label">Contraseña temporal</label>
          <div class="flex gap-2">
            <input type="text" id="resetTempPass" class="form-input flex-1" required minlength="6">
            <button type="button" onclick="document.getElementById('resetTempPass').value=Security.generateTempPassword(8)" class="btn-secondary">Generar</button>
          </div>
        </div>
        <p class="text-xs text-slate-500">Al ingresar con esta contraseña, el sistema solicitará cambiarla. Ingresos registrados: ${user.login_count || 0}</p>
        <div class="flex justify-end gap-2">
          <button type="button" onclick="App.closeModal()" class="btn-secondary">Cancelar</button>
          <button type="submit" class="btn-primary">Restablecer</button>
        </div>
      </form>
    `;

    document.getElementById('resetPassForm').addEventListener('submit', async e => {
      e.preventDefault();
      await this.applyResetPassword();
    });
    App.openModal();
  },

  async applyResetPassword() {
    const id = parseInt(document.getElementById('resetUserId').value);
    const usuario = document.getElementById('resetUsuario').value.trim();
    const tempPass = document.getElementById('resetTempPass').value;

    const user = Auth.getUserById(id);
    if (usuario && usuario !== user.usuario) {
      const data = Storage.getUsuarios();
      data.usuarios.forEach(u => {
        if (u.cedula === user.cedula) u.usuario = usuario.toLowerCase();
      });
      Storage.saveUsuarios(data);
    }

    const result = await Auth.adminResetPassword(id, tempPass);
    if (!result.ok) {
      App.showToast(result.error);
      return;
    }

    App.closeModal();
    this.showTempPasswordResult(usuario || user.usuario, tempPass, 'Contraseña restablecida');
  },

  showTempPasswordResult(usuario, tempPass, title) {
    document.getElementById('modalHeader').innerHTML = `
      <h3 class="text-lg font-bold text-navy-900">${this.esc(title)}</h3>
      <button onclick="App.closeModal()" class="p-2 hover:bg-slate-100 rounded-lg"><svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg></button>
    `;
    document.getElementById('modalBody').innerHTML = `
      <div class="p-4 bg-amber-50 border border-amber-200 rounded-xl space-y-3">
        <p class="text-sm text-slate-700">Comunique al usuario las siguientes credenciales temporales:</p>
        <div class="font-mono text-sm bg-white p-3 rounded-lg border">
          <p><strong>Usuario:</strong> ${this.esc(usuario)}</p>
          <p class="mt-2"><strong>Contraseña temporal:</strong> ${this.esc(tempPass)}</p>
        </div>
        <p class="text-xs text-amber-700">El usuario deberá cambiar la contraseña en su próximo ingreso.</p>
      </div>
    `;
    App.openModal();
    App.navigate('usuarios');
  },

  toggleUser(id) {
    const target = Auth.getUserById(id);
    if (target && Auth.isHiddenUser(target)) {
      App.showToast('No se puede modificar la cuenta de sistema');
      return;
    }
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
    const target = Auth.getUserById(id);
    if (!target || Auth.isHiddenUser(target)) return;
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
