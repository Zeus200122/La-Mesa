// ═══════════════════════════════════════════
// app.js — Panel de empleados
// ═══════════════════════════════════════════

let panelEventsBound = false

let initRunning = false


// ── Estado global ───────────────────────────
const state = {
  pedidos:        [],        // todos los pedidos cargados
  filtroEstado:   'todos',   // filtro activo de estado
  filtroMesa:     'todas',   // filtro activo de mesa
  pedidoDetalle:  null,      // pedido abierto en el modal
  realtimeSub:    null,      // suscripción activa de Realtime
}


// ── Referencias al DOM ──────────────────────
const $ = (id) => document.getElementById(id)

const elLoginScreen   = $('login-screen')
const elPanel         = $('panel')
const elLoginEmail    = $('login-email')
const elLoginPass     = $('login-pass')
const elLoginError    = $('login-error')
const elBtnLogin      = $('btn-login')
const elBtnLogout     = $('btn-logout')
const elOrdersGrid    = $('orders-grid')
const elEmptyState    = $('empty-state')
const elFilterTabs    = $('filter-tabs')
const elMesaChips     = $('mesa-chips')
const elNumPendientes = $('num-pendientes')
const elNumPrep       = $('num-prep')
const elDetailModal   = $('detail-modal')
const elDetailOverlay = $('detail-overlay')
const elDetailClose   = $('detail-close')
const elDetailNum     = $('detail-num')
const elDetailMeta    = $('detail-meta')
const elDetailItems   = $('detail-items')
const elDetailNotaWrap = $('detail-nota-wrap')
const elDetailNota    = $('detail-nota')
const elDetailTotal   = $('detail-total')
const elDetailActions = $('detail-actions')

// ── Contenedor de toasts ────────────────────
const toastContainer = document.createElement('div')
toastContainer.className = 'toast-container'
document.body.appendChild(toastContainer)

// ════════════════════════════════════════════
// AUTENTICACIÓN
// ════════════════════════════════════════════
async function init() {
  if (initRunning) return
  initRunning = true

  bindAuthEvents()

  try {
    const { data, error } = await db.auth.getSession()
    if (error) throw error

    if (!data.session) {
      mostrarLogin()
      return
    }

    const { data: userData } = await db.auth.getUser()
    const rol = userData.user?.app_metadata?.rol

    console.log('ROL:', rol)

    if (rol === 'empleado' || rol === 'admin') {
      mostrarPanel()
    } else {
      await db.auth.signOut()
      mostrarLogin()
    }

  } catch (err) {
    console.error('Error en init:', err)
    mostrarLogin()
  } finally {
    initRunning = false
  }

  if (elBtnLogout) {
  elBtnLogout.addEventListener('click', logout)
}
}

function mostrarLogin() {
  elLoginScreen.hidden = false
  elPanel.hidden = true
  if (state.realtimeSub) {
    state.realtimeSub.unsubscribe()
    state.realtimeSub = null
  }
}

function mostrarPanel() {
  elLoginScreen.hidden = true
  elPanel.hidden = false

  cargarPedidos()
  iniciarRealtime()

  if (!panelEventsBound) {
    bindPanelEvents()
    panelEventsBound = true
  }
}

// ── Login ───────────────────────────────────
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
    return
  }

  await db.auth.refreshSession()

  const { data: userData } = await db.auth.getUser()
  const rol = userData.user?.app_metadata?.rol

  
  if (rol !== 'empleado' && rol !== 'admin') {
    await db.auth.signOut()
    elLoginError.textContent = 'No tienes acceso'
    elBtnLogin.disabled = false
    elBtnLogin.textContent = 'Entrar'
    return
  }

  mostrarPanel()
}

// ── Logout ──────────────────────────────────
async function logout() {
  await db.auth.signOut()
}

// ════════════════════════════════════════════
// CARGAR PEDIDOS
// ════════════════════════════════════════════
async function cargarPedidos() {
  const { data, error } = await db
    .from('pedidos')
    .select(`
      id,
      numero_mesa,
      nombre_cliente,
      tipo,
      estado,
      nota,
      total,
      created_at,
      updated_at,
      pedido_items (
        id,
        cantidad,
        nombre_snapshot,
        precio_snapshot
      )
    `)
    .not('estado', 'in', '("entregado","cancelado")')
    .order('created_at', { ascending: true })

  if (error) {
    console.error('[supabase] Error al cargar pedidos:', error)
    return
  }

  state.pedidos = data ?? []
  actualizarMesaChips()
  renderPedidos()
  actualizarStats()
}

// ════════════════════════════════════════════
// REALTIME
// ════════════════════════════════════════════
function iniciarRealtime() {
  state.realtimeSub = db
    .channel('pedidos-live')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'pedidos' },
      async (payload) => {
        const { eventType, new: nuevo, old: viejo } = payload

        if (eventType === 'INSERT') {
          // Cargar el pedido completo con sus ítems
          const { data } = await db
            .from('pedidos')
            .select(`
              id, numero_mesa, nombre_cliente, tipo,
              estado, nota, total, created_at, updated_at,
              pedido_items ( id, cantidad, nombre_snapshot, precio_snapshot )
            `)
            .eq('id', nuevo.id)
            .single()

          if (data) {
            state.pedidos.unshift(data)
            mostrarToast(`Nuevo pedido — ${data.numero_mesa ? 'Mesa ' + data.numero_mesa : data.nombre_cliente ?? 'Para llevar'}`, 'new-order')
          }
        }

        if (eventType === 'UPDATE') {
          const idx = state.pedidos.findIndex(p => p.id === nuevo.id)
          if (idx !== -1) {
            state.pedidos[idx] = { ...state.pedidos[idx], ...nuevo }
          }
          // Si pasó a entregado/cancelado, quitarlo
          if (nuevo.estado === 'entregado' || nuevo.estado === 'cancelado') {
            state.pedidos = state.pedidos.filter(p => p.id !== nuevo.id)
          }
        }

        if (eventType === 'DELETE') {
          state.pedidos = state.pedidos.filter(p => p.id !== viejo.id)
        }

        actualizarMesaChips()
        renderPedidos()
        actualizarStats()
      }
    )
    .subscribe()
}

// ════════════════════════════════════════════
// RENDER — TARJETAS DE PEDIDOS
// ════════════════════════════════════════════
function renderPedidos() {
  const filtrados = filtrarPedidos()

  elEmptyState.hidden  = filtrados.length > 0
  elOrdersGrid.hidden  = filtrados.length === 0

  if (filtrados.length === 0) return

  elOrdersGrid.innerHTML = filtrados.map(p => tarjetaPedido(p)).join('')
}

function filtrarPedidos() {
  return state.pedidos.filter(p => {
    const matchEstado = state.filtroEstado === 'todos' || p.estado === state.filtroEstado
    const matchMesa   = state.filtroMesa === 'todas'   || String(p.numero_mesa) === state.filtroMesa
    return matchEstado && matchMesa
  })
}

function tarjetaPedido(p) {
  const estado   = ESTADOS[p.estado] ?? ESTADOS.pendiente
  const minutos  = Math.floor((Date.now() - new Date(p.created_at)) / 60000)
  const urgente  = p.estado === 'pendiente' && minutos >= 10

  const sig      = estado.siguiente
  const btnLabel = sig ? BTN_LABELS[sig] : null

  const itemsHtml = (p.pedido_items ?? []).slice(0, 4).map(i => `
    <div class="order-card__item">
      <span class="order-card__item-qty">${i.cantidad}×</span>
      <span class="order-card__item-name">${i.nombre_snapshot}</span>
    </div>
  `).join('')

  const masItems = (p.pedido_items?.length ?? 0) > 4
    ? `<p class="order-card__more">+${p.pedido_items.length - 4} más...</p>`
    : ''

  const btnHtml = btnLabel ? `
    <button
      class="btn-estado ${btnLabel.clase}"
      data-id="${p.id}"
      data-siguiente="${sig}"
      onclick="cambiarEstado(event, '${p.id}', '${sig}')"
    >${btnLabel.label}</button>
  ` : ''

  const mesaLabel = p.numero_mesa
    ? `Mesa ${p.numero_mesa}`
    : `Para llevar`

  return `
    <article
      class="order-card"
      data-id="${p.id}"
      data-estado="${p.estado}"
      onclick="abrirDetalle('${p.id}')"
    >
      <div class="order-card__head">
        <div>
          <p class="order-card__id">#${p.id.slice(0,8).toUpperCase()}</p>
          <p class="order-card__mesa">${mesaLabel}</p>
          ${p.nombre_cliente ? `<p class="order-card__cliente">${p.nombre_cliente}</p>` : ''}
        </div>
        <span class="order-card__badge ${estado.badge}">${estado.label}</span>
      </div>
      <div class="order-card__items">
        ${itemsHtml}
        ${masItems}
      </div>
      <div class="order-card__foot">
        <span class="order-card__time${urgente ? ' urgent' : ''}">
          ${minutos < 1 ? 'ahora' : minutos + ' min'}${urgente ? ' ⚠' : ''}
        </span>
        <div class="order-card__actions">
          ${btnHtml}
        </div>
      </div>
    </article>
  `
}

// ════════════════════════════════════════════
// CAMBIAR ESTADO
// ════════════════════════════════════════════
async function cambiarEstado(e, id, nuevoEstado) {
  e.stopPropagation() // evitar abrir el modal al clicar el botón

  const { error } = await db
    .from('pedidos')
    .update({ estado: nuevoEstado })
    .eq('id', id)

  if (error) {
    console.error('[supabase] Error al actualizar estado:', error)
    mostrarToast('Error al actualizar el pedido.', 'error')
    return
  }

  // Actualizar localmente sin esperar Realtime
  const idx = state.pedidos.findIndex(p => p.id === id)
  if (idx !== -1) {
    state.pedidos[idx].estado = nuevoEstado
    if (nuevoEstado === 'entregado' || nuevoEstado === 'cancelado') {
      state.pedidos.splice(idx, 1)
    }
  }

  renderPedidos()
  actualizarStats()

  // Si el modal está abierto y es este pedido, actualizarlo
  if (state.pedidoDetalle?.id === id) {
    state.pedidoDetalle.estado = nuevoEstado
    renderDetalleFooter()
  }
}

// ════════════════════════════════════════════
// MODAL DE DETALLE
// ════════════════════════════════════════════
function abrirDetalle(id) {
  const pedido = state.pedidos.find(p => p.id === id)
  if (!pedido) return

  state.pedidoDetalle = pedido

  const mesaLabel = pedido.numero_mesa
    ? `Mesa ${pedido.numero_mesa}`
    : `Para llevar`

  elDetailNum.textContent  = `#${pedido.id.slice(0,8).toUpperCase()} — ${mesaLabel}`
  elDetailMeta.textContent = `${pedido.nombre_cliente ?? ''} · ${formatFecha(pedido.created_at)}`

  elDetailItems.innerHTML = (pedido.pedido_items ?? []).map(i => `
    <li class="detail-item">
      <span class="detail-item__qty">${i.cantidad}×</span>
      <span class="detail-item__name">${i.nombre_snapshot}</span>
      <span class="detail-item__price">RD$${(i.precio_snapshot * i.cantidad).toLocaleString('es-DO')}</span>
    </li>
  `).join('')

  elDetailNotaWrap.hidden = !pedido.nota
  elDetailNota.textContent = pedido.nota ?? ''

  elDetailTotal.textContent = `RD$${Number(pedido.total).toLocaleString('es-DO')}`

  renderDetalleFooter()

  elDetailModal.hidden = false
  requestAnimationFrame(() => elDetailModal.classList.add('open'))
  elDetailModal.setAttribute('aria-hidden', 'false')
}

function renderDetalleFooter() {
  if (!state.pedidoDetalle) return
  const estado = ESTADOS[state.pedidoDetalle.estado]
  const sig = estado?.siguiente

  elDetailActions.innerHTML = ''

  if (sig) {
    const btnInfo = BTN_LABELS[sig]
    const btn = document.createElement('button')
    btn.className = `btn-estado ${btnInfo.clase}`
    btn.textContent = btnInfo.label
    btn.onclick = (e) => cambiarEstado(e, state.pedidoDetalle.id, sig)
    elDetailActions.appendChild(btn)
  }
}

function cerrarDetalle() {
  elDetailModal.classList.remove('open')
  setTimeout(() => {
    elDetailModal.hidden = true
    elDetailModal.setAttribute('aria-hidden', 'true')
    state.pedidoDetalle = null
  }, 220)
}

// ════════════════════════════════════════════
// FILTROS
// ════════════════════════════════════════════
function actualizarMesaChips() {
  const mesas = ['todas', ...[...new Set(
    state.pedidos
      .filter(p => p.numero_mesa)
      .map(p => String(p.numero_mesa))
      .sort((a, b) => Number(a) - Number(b))
  )]]

  elMesaChips.innerHTML = mesas.map(m => `
    <button
      class="mesa-chip${m === state.filtroMesa ? ' active' : ''}"
      data-mesa="${m}"
    >${m === 'todas' ? 'Todas' : 'Mesa ' + m}</button>
  `).join('')
}

function actualizarStats() {
  elNumPendientes.textContent = state.pedidos.filter(p => p.estado === 'pendiente').length
  elNumPrep.textContent       = state.pedidos.filter(p => p.estado === 'en preparacion').length
}

// ════════════════════════════════════════════
// TOASTS
// ════════════════════════════════════════════
function mostrarToast(msg, tipo = '') {
  const el = document.createElement('div')
  el.className = `toast ${tipo}`
  el.textContent = msg
  toastContainer.appendChild(el)
  setTimeout(() => el.remove(), 4000)
}

// ════════════════════════════════════════════
// UTILIDADES
// ════════════════════════════════════════════
function formatFecha(iso) {
  return new Date(iso).toLocaleTimeString('es-DO', { hour: '2-digit', minute: '2-digit' })
}

// Exponer globalmente para los onclick inline
window.cambiarEstado = cambiarEstado
window.abrirDetalle  = abrirDetalle

// ════════════════════════════════════════════
// EVENTOS
// ════════════════════════════════════════════
function bindAuthEvents() {
  elBtnLogin.addEventListener('click', login)
  elLoginPass.addEventListener('keydown', e => { if (e.key === 'Enter') login() })
}

function bindPanelEvents() {
  // Logout
  elBtnLogout.addEventListener('click', logout)

  // Filtros de estado
  elFilterTabs.addEventListener('click', e => {
    const tab = e.target.closest('.filter-tab')
    if (!tab) return
    state.filtroEstado = tab.dataset.estado
    elFilterTabs.querySelectorAll('.filter-tab').forEach(t =>
      t.classList.toggle('active', t === tab)
    )
    renderPedidos()
  })

  // Filtros de mesa (delegación sobre el contenedor)
  $('mesa-filter').addEventListener('click', e => {
    const chip = e.target.closest('.mesa-chip')
    if (!chip) return
    state.filtroMesa = chip.dataset.mesa
    elMesaChips.querySelectorAll('.mesa-chip').forEach(c =>
      c.classList.toggle('active', c === chip)
    )
    renderPedidos()
  })

  // Cerrar modal
  elDetailClose.addEventListener('click', cerrarDetalle)
  elDetailOverlay.addEventListener('click', cerrarDetalle)
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') cerrarDetalle()
  })
}

// ════════════════════════════════════════════
// ARRANQUE
// ════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', init)
