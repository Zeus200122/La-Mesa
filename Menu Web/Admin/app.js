// ═══════════════════════════════════════════
// app.js — Admin de productos
// ═══════════════════════════════════════════

let panelEventsBound = false


const state = {
  productos:       [],
  categorias:      [],
  filtroCategoria: 'todas',
  soloNoDisp:      false,
  editando:        null,   // producto que se está editando (null = nuevo)
  eliminando:      null,   // producto pendiente de confirmar eliminación
  imgFile:         null,   // archivo de imagen seleccionado
  imgPreviewUrl:   null,   // URL de previsualización local
}

const $ = id => document.getElementById(id)

// ── Auth ──
const elLoginScreen  = $('login-screen')
const elAdminPanel   = $('admin-panel')
const elLoginEmail   = $('login-email')
const elLoginPass    = $('login-pass')
const elLoginError   = $('login-error')
const elBtnLogin     = $('btn-login')
const elBtnLogout    = $('btn-logout')

// ── Tabla ──
const elCatTabs      = $('cat-tabs')
const elSoloNoDisp   = $('solo-no-disponibles')
const elProdTbody    = $('prod-tbody')
const elEmptyState   = $('empty-state')

// ── Modal producto ──
const elModal        = $('producto-modal')
const elModalOverlay = $('modal-overlay')
const elModalTitle   = $('modal-title')
const elModalClose   = $('modal-close')
const elBtnNuevo     = $('btn-nuevo')
const elBtnCancelar  = $('btn-cancelar')
const elBtnGuardar   = $('btn-guardar')
const elFormError    = $('form-error')
const elImgPreview   = $('img-preview')
const elImgFile      = $('img-file')
const elBtnQuitarImg = $('btn-quitar-img')
const elFNombre      = $('f-nombre')
const elFDesc        = $('f-desc')
const elFCategoria   = $('f-categoria')
const elFPrecio      = $('f-precio')
const elFDisponible  = $('f-disponible')
const elFDestacado   = $('f-destacado')

// ── Modal confirmar ──
const elConfirmModal   = $('confirm-modal')
const elConfirmOverlay = $('confirm-overlay')
const elConfirmClose   = $('confirm-close')
const elConfirmNombre  = $('confirm-nombre')
const elBtnNo          = $('btn-no')
const elBtnSi          = $('btn-si')

const elToastContainer = $('toast-container')

// ════════════════════════════════════════════
// AUTENTICACIÓN
// ════════════════════════════════════════════
async function init() {
  try {
    const { data, error } = await db.auth.getSession()
    if (error) throw error

    console.log('Sesión detectada:', data.session)
    
    if (data.session) {
      const { data: userData } = await db.auth.getUser()
      const rol = userData.user?.app_metadata?.rol

      if (rol === 'admin') {
        await mostrarPanel()
      } else {
        await db.auth.signOut()
        mostrarLogin()
      }
    } else {
      mostrarLogin()
    }

    
    db.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') mostrarLogin()
    })

    bindAuthEvents()

  } catch (err) {
    console.error('Error en init:', err)
    mostrarLogin()
  }
}


function mostrarLogin() {
  elLoginScreen.style.display = 'block'
  elAdminPanel.style.display  = 'none'
}

async function mostrarPanel() {
  elLoginScreen.style.display = 'none'
  elAdminPanel.style.display  = 'block'

  try {
    await cargarCategorias()
    await cargarProductos()
  } catch (err) {
    console.error('Error cargando datos:', err)
  }

  renderCatTabs()
  renderTabla()

  if (!panelEventsBound) {
  bindPanelEvents()
  panelEventsBound = true
  }
}


async function login() {
  const email = elLoginEmail.value.trim()
  const pass  = elLoginPass.value

  if (!email || !pass) {
    elLoginError.textContent = 'Completa todos los campos.'
    return
  }

  elBtnLogin.disabled = true
  elBtnLogin.textContent = 'Entrando...'
  elLoginError.textContent = ''

  const { data, error } = await db.auth.signInWithPassword({
    email,
    password: pass
  })

  if (error) {
    elLoginError.textContent = 'Email o contraseña incorrectos.'
    elBtnLogin.disabled = false
    elBtnLogin.textContent = 'Entrar'
    return // 🔥 ESTO TE FALTABA
  }

  // 🔥 refrescar token (muy importante)
  await db.auth.refreshSession()

  const rol = data.user?.app_metadata?.rol

  if (rol !== 'admin') {
    await db.auth.signOut()
    elLoginError.textContent = 'No tienes acceso'
    elBtnLogin.disabled = false
    elBtnLogin.textContent = 'Entrar'
    return
  }

  await mostrarPanel()
}

async function logout() {
  await db.auth.signOut()
  mostrarLogin()
}

// ════════════════════════════════════════════
// CARGAR DATOS
// ════════════════════════════════════════════
async function cargarCategorias() {
  const { data } = await db.from('categorias').select('*').order('orden')
  state.categorias = data ?? []

  // Rellenar el select del modal
  elFCategoria.innerHTML = '<option value="">— Selecciona —</option>' +
    state.categorias.map(c => `<option value="${c.id}">${c.nombre}</option>`).join('')
}

async function cargarProductos() {
  const { data, error } = await db
    .from('productos')
    .select('*, categorias(nombre)')
    .order('created_at', { ascending: false })

  if (error) { console.error(error); return }
  state.productos = data ?? []
}

// ════════════════════════════════════════════
// RENDER — TABS DE CATEGORÍA
// ════════════════════════════════════════════
function renderCatTabs() {
  const tabs = [{ id: 'todas', nombre: 'Todas' }, ...state.categorias]
  elCatTabs.innerHTML = tabs.map(c => `
    <button class="cat-tab${c.id === state.filtroCategoria ? ' active' : ''}"
      data-cat="${c.id}">${c.nombre}</button>
  `).join('')
}

// ════════════════════════════════════════════
// RENDER — TABLA
// ════════════════════════════════════════════
function renderTabla() {
  const filtrados = state.productos.filter(p => {
    const matchCat  = state.filtroCategoria === 'todas' || p.categoria_id === state.filtroCategoria
    const matchDisp = !state.soloNoDisp || !p.disponible
    return matchCat && matchDisp
  })

  elEmptyState.hidden = filtrados.length > 0
  elProdTbody.innerHTML = filtrados.map(p => filaProducto(p)).join('')
}

function filaProducto(p) {
  const catNombre = p.categorias?.nombre ?? '—'
  const imgHtml = p.imagen_url
    ? `<div class="td-img"><img src="${p.imagen_url}" alt="${p.nombre}" /></div>`
    : `<div class="td-img">🍴</div>`

  return `
    <tr class="${p.disponible ? '' : 'no-disponible'}" data-id="${p.id}">
      <td>${imgHtml}</td>
      <td>
        <p class="td-nombre">${p.nombre}</p>
        ${p.descripcion ? `<p class="td-desc">${p.descripcion.slice(0, 60)}${p.descripcion.length > 60 ? '…' : ''}</p>` : ''}
      </td>
      <td style="color:var(--muted);font-size:.8rem">${catNombre}</td>
      <td>
        <input
          class="precio-input"
          type="number"
          value="${p.precio}"
          min="0" step="1"
          data-id="${p.id}"
          onchange="actualizarPrecio('${p.id}', this.value)"
          onclick="event.stopPropagation()"
        />
      </td>
      <td class="col-toggle">
        <label class="switch">
          <input type="checkbox" ${p.disponible ? 'checked' : ''}
            onchange="toggleCampo('${p.id}', 'disponible', this.checked)"
          />
          <span class="switch-track"></span>
        </label>
      </td>
      <td class="col-toggle">
        <label class="switch">
          <input type="checkbox" ${p.destacado ? 'checked' : ''}
            onchange="toggleCampo('${p.id}', 'destacado', this.checked)"
          />
          <span class="switch-track"></span>
        </label>
      </td>
      <td>
        <div class="row-actions">
          <button class="btn-row" onclick="abrirEditar('${p.id}')">Editar</button>
          <button class="btn-row btn-row--delete" onclick="pedirConfirmarEliminar('${p.id}')">Borrar</button>
        </div>
      </td>
    </tr>
  `
}

// ════════════════════════════════════════════
// ACCIONES RÁPIDAS (inline en la tabla)
// ════════════════════════════════════════════

// Cambiar precio directamente en la tabla
async function actualizarPrecio(id, valor) {
  const precio = parseFloat(valor)
  if (isNaN(precio) || precio < 0) return
  const { error } = await db.from('productos').update({ precio }).eq('id', id)
  if (error) { toast('Error al actualizar precio', 'error'); return }
  const p = state.productos.find(p => p.id === id)
  if (p) p.precio = precio
  toast('Precio actualizado')
}

// Toggle disponible / destacado
async function toggleCampo(id, campo, valor) {
  const { error } = await db.from('productos').update({ [campo]: valor }).eq('id', id)
  if (error) { toast('Error al actualizar', 'error'); return }
  const p = state.productos.find(p => p.id === id)
  if (p) p[campo] = valor
  renderTabla()
  toast(`${campo === 'disponible' ? 'Disponibilidad' : 'Destacado'} actualizado`)
}

// ════════════════════════════════════════════
// MODAL — CREAR / EDITAR
// ════════════════════════════════════════════
function abrirNuevo() {
  state.editando    = null
  state.imgFile     = null
  state.imgPreviewUrl = null

  elModalTitle.textContent = 'Nuevo producto'
  elFNombre.value      = ''
  elFDesc.value        = ''
  elFCategoria.value   = ''
  elFPrecio.value      = ''
  elFDisponible.checked = true
  elFDestacado.checked  = false
  elFormError.textContent = ''
  renderImgPreview(null)
  abrirModal(elModal)
}

function abrirEditar(id) {
  const p = state.productos.find(p => p.id === id)
  if (!p) return

  state.editando      = p
  state.imgFile       = null
  state.imgPreviewUrl = p.imagen_url

  elModalTitle.textContent = 'Editar producto'
  elFNombre.value       = p.nombre
  elFDesc.value         = p.descripcion ?? ''
  elFCategoria.value    = p.categoria_id ?? ''
  elFPrecio.value       = p.precio
  elFDisponible.checked = p.disponible
  elFDestacado.checked  = p.destacado
  elFormError.textContent = ''
  renderImgPreview(p.imagen_url)
  abrirModal(elModal)
}

function renderImgPreview(url) {
  elImgPreview.innerHTML = url
    ? `<img src="${url}" alt="preview" />`
    : `<span class="img-preview__placeholder">Sin imagen</span>`
}

async function guardarProducto() {
  const nombre     = elFNombre.value.trim()
  const categoriaId = elFCategoria.value
  const precio     = parseFloat(elFPrecio.value)

  if (!nombre)           { elFormError.textContent = 'El nombre es obligatorio.'; return }
  if (!categoriaId)      { elFormError.textContent = 'Selecciona una categoría.'; return }
  if (isNaN(precio) || precio < 0) { elFormError.textContent = 'El precio no es válido.'; return }

  elBtnGuardar.disabled = true
  elBtnGuardar.textContent = 'Guardando...'
  elFormError.textContent = ''

  try {
    // 1. Subir imagen si hay una nueva
    let imagen_url = state.editando?.imagen_url ?? null

    if (state.imgFile) {
      const ext      = state.imgFile.name.split('.').pop()
      const filename = `${Date.now()}.${ext}`
      const { error: uploadError } = await db.storage
        .from(STORAGE_BUCKET)
        .upload(filename, state.imgFile, { upsert: true })

      if (uploadError) throw uploadError

      const { data: urlData } = db.storage
        .from(STORAGE_BUCKET)
        .getPublicUrl(filename)

      imagen_url = urlData.publicUrl
    }

    // Si quitó la imagen existente
    if (!state.imgPreviewUrl && !state.imgFile) {
      imagen_url = null
    }

    // 2. Insert o Update
    const payload = {
      nombre,
      descripcion:  elFDesc.value.trim() || null,
      categoria_id: categoriaId,
      precio,
      disponible:   elFDisponible.checked,
      destacado:    elFDestacado.checked,
      imagen_url,
    }

    console.log({
  nombre,
  categoriaId,
  precio,
  imagen_url
})

    if (state.editando) {
      const { error } = await db.from('productos').update(payload).eq('id', state.editando.id)
      if (error) throw error
    } else {
      const { error } = await db.from('productos').insert(payload)
      if (error) throw error
    }

    // 3. Recargar y cerrar
    await cargarProductos()
    renderTabla()
    cerrarModal(elModal)
    toast(state.editando ? 'Producto actualizado' : 'Producto creado', 'ok')

  } catch (err) {
  console.error('ERROR COMPLETO:', err)
  elFormError.textContent = err.message || 'Error al guardar'
  } finally {
    elBtnGuardar.disabled = false
    elBtnGuardar.textContent = 'Guardar'
  }
}

// ════════════════════════════════════════════
// MODAL — CONFIRMAR ELIMINACIÓN
// ════════════════════════════════════════════
function pedirConfirmarEliminar(id) {
  const p = state.productos.find(p => p.id === id)
  if (!p) return
  state.eliminando = p
  elConfirmNombre.textContent = p.nombre
  abrirModal(elConfirmModal)
}

async function confirmarEliminar() {
  if (!state.eliminando) return

  const { error } = await db.from('productos').delete().eq('id', state.eliminando.id)
  if (error) { toast('Error al eliminar', 'error'); return }

  state.productos = state.productos.filter(p => p.id !== state.eliminando.id)
  renderTabla()
  cerrarModal(elConfirmModal)
  toast('Producto eliminado')
  state.eliminando = null
}

// ════════════════════════════════════════════
// HELPERS — MODAL
// ════════════════════════════════════════════
function abrirModal(el) {
  el.hidden = false
  requestAnimationFrame(() => el.classList.add('open'))
  el.setAttribute('aria-hidden', 'false')
}

function cerrarModal(el) {
  el.classList.remove('open')
  setTimeout(() => {
    el.hidden = true
    el.setAttribute('aria-hidden', 'true')
  }, 200)
}

// ════════════════════════════════════════════
// TOAST
// ════════════════════════════════════════════
function toast(msg, tipo = '') {
  const el = document.createElement('div')
  el.className = `toast${tipo ? ' toast--' + tipo : ''}`
  el.textContent = msg
  elToastContainer.appendChild(el)
  setTimeout(() => el.remove(), 3500)
}

// ════════════════════════════════════════════
// EVENTOS
// ════════════════════════════════════════════
function bindAuthEvents() {
  elBtnLogin.addEventListener('click', login)
  elLoginPass.addEventListener('keydown', e => { if (e.key === 'Enter') login() })
}

function bindPanelEvents() {
  elBtnLogout.addEventListener('click', logout)
  elBtnNuevo.addEventListener('click', abrirNuevo)

  // Filtro categorías
  elCatTabs.addEventListener('click', e => {
    const tab = e.target.closest('.cat-tab')
    if (!tab) return
    state.filtroCategoria = tab.dataset.cat
    elCatTabs.querySelectorAll('.cat-tab').forEach(t =>
      t.classList.toggle('active', t === tab)
    )
    renderTabla()
  })

  // Filtro no disponibles
  elSoloNoDisp.addEventListener('change', e => {
    state.soloNoDisp = e.target.checked
    renderTabla()
  })

  // Modal producto
  elModalClose.addEventListener('click', () => cerrarModal(elModal))
  elModalOverlay.addEventListener('click', () => cerrarModal(elModal))
  elBtnCancelar.addEventListener('click', () => cerrarModal(elModal))
  elBtnGuardar.addEventListener('click', guardarProducto)

  // Imagen
  elImgFile.addEventListener('change', e => {
    const file = e.target.files[0]
    if (!file) return
    if (file.size > 2 * 1024 * 1024) {
      toast('La imagen debe ser menor a 2 MB', 'error')
      return
    }
    state.imgFile = file
    state.imgPreviewUrl = URL.createObjectURL(file)
    renderImgPreview(state.imgPreviewUrl)
  })

  elBtnQuitarImg.addEventListener('click', () => {
    state.imgFile       = null
    state.imgPreviewUrl = null
    elImgFile.value     = ''
    renderImgPreview(null)
  })

  // Modal confirmación
  elConfirmClose.addEventListener('click', () => cerrarModal(elConfirmModal))
  elConfirmOverlay.addEventListener('click', () => cerrarModal(elConfirmModal))
  elBtnNo.addEventListener('click', () => cerrarModal(elConfirmModal))
  elBtnSi.addEventListener('click', confirmarEliminar)

  // Escape
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      cerrarModal(elModal)
      cerrarModal(elConfirmModal)
    }
  })
}

// Exponer para onclick inline en la tabla
window.actualizarPrecio       = actualizarPrecio
window.toggleCampo            = toggleCampo
window.abrirEditar            = abrirEditar
window.pedirConfirmarEliminar = pedirConfirmarEliminar

document.addEventListener('DOMContentLoaded', init)
