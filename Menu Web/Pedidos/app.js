// ═══════════════════════════════════════════
// app.js — Página de pedidos activos
// ═══════════════════════════════════════════

const state = {
  pedidos:      [],
  filtroEstado: 'todos',
  busqueda:     '',
  expandidos:   new Set(),   // IDs de filas expandidas
}

const $ = id => document.getElementById(id)

const elList        = $('pedidos-list')
const elEmpty       = $('empty-state')
const elFiltros     = $('estado-filters')
const elSearch      = $('search-input')
const elHTotal      = $('hstat-total')
const elHPend       = $('hstat-pendientes')
const elHPrep       = $('hstat-prep')
const elHListos     = $('hstat-listos')

// ════════════════════════════════════════════
// INIT
// ════════════════════════════════════════════
async function init() {
  await cargarPedidos()
  iniciarRealtime()
  bindEvents()
  // Refrescar tiempos cada 30 seg
  setInterval(() => renderLista(), 30000)
}

// ════════════════════════════════════════════
// CARGAR
// ════════════════════════════════════════════
async function cargarPedidos() {
  const { data, error } = await db
    .from('pedidos')
    .select(`
      id, numero_mesa, nombre_cliente, tipo,
      estado, nota, total, created_at,
      pedido_items ( id, cantidad, nombre_snapshot, precio_snapshot )
    `)
    .not('estado', 'in', '("entregado","cancelado")')
    .order('created_at', { ascending: true })

  if (error) { console.error(error); return }
  state.pedidos = data ?? []
  renderLista()
  actualizarStats()
}

// ════════════════════════════════════════════
// REALTIME
// ════════════════════════════════════════════
function iniciarRealtime() {
  db.channel('pedidos-vista')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'pedidos' },
      async ({ eventType, new: nuevo, old: viejo }) => {

        if (eventType === 'INSERT') {
          const { data } = await db
            .from('pedidos')
            .select(`id, numero_mesa, nombre_cliente, tipo, estado, nota, total, created_at,
                     pedido_items ( id, cantidad, nombre_snapshot, precio_snapshot )`)
            .eq('id', nuevo.id).single()
          if (data) state.pedidos.push(data)
        }

        if (eventType === 'UPDATE') {
          const idx = state.pedidos.findIndex(p => p.id === nuevo.id)
          if (idx !== -1) state.pedidos[idx] = { ...state.pedidos[idx], ...nuevo }
          if (nuevo.estado === 'entregado' || nuevo.estado === 'cancelado') {
            state.pedidos = state.pedidos.filter(p => p.id !== nuevo.id)
            state.expandidos.delete(nuevo.id)
          }
        }

        if (eventType === 'DELETE') {
          state.pedidos = state.pedidos.filter(p => p.id !== viejo.id)
          state.expandidos.delete(viejo.id)
        }

        renderLista()
        actualizarStats()
      })
    .subscribe()
}

// ════════════════════════════════════════════
// RENDER
// ════════════════════════════════════════════
function renderLista() {
  const filtrados = filtrar()

  elEmpty.hidden = filtrados.length > 0
  elList.hidden  = filtrados.length === 0

  if (filtrados.length === 0) return

  elList.innerHTML = filtrados.map(p => filaPedido(p)).join('')
}

function filtrar() {
  const q = state.busqueda.toLowerCase()
  return state.pedidos.filter(p => {
    const matchEstado = state.filtroEstado === 'todos' || p.estado === state.filtroEstado
    const matchQ = !q || (
      p.id.toLowerCase().includes(q) ||
      String(p.numero_mesa ?? '').includes(q) ||
      (p.nombre_cliente ?? '').toLowerCase().includes(q)
    )
    return matchEstado && matchQ
  })
}

function filaPedido(p) {
  const est     = ESTADOS[p.estado] ?? ESTADOS.pendiente
  const minutos = Math.floor((Date.now() - new Date(p.created_at)) / 60000)
  const urgente = p.estado === 'pendiente' && minutos >= 10
  const abierto = state.expandidos.has(p.id)

  const resumen = (p.pedido_items ?? [])
    .slice(0, 3)
    .map(i => `<strong>${i.cantidad}×</strong> ${i.nombre_snapshot}`)
    .join(' · ')
  const masItems = (p.pedido_items?.length ?? 0) > 3
    ? ` <em>+${p.pedido_items.length - 3} más</em>` : ''

  const mesa = p.numero_mesa ? `Mesa ${p.numero_mesa}` : 'Para llevar'

  // Botón de siguiente estado
  const sig = est.siguiente
  const btnAccion = sig ? accionBtn(p.id, sig) : ''

  // Detalle expandido
  const detalleHtml = detalleExpandido(p, sig)

  return `
    <div class="pedido-row"
      data-id="${p.id}"
      data-estado="${p.estado}"
      onclick="toggleDetalle('${p.id}')"
    >
      <span class="pedido-row__id">#${p.id.slice(0,8).toUpperCase()}</span>
      <div class="pedido-row__ubicacion">
        <span class="pedido-row__mesa">${mesa}</span>
        ${p.nombre_cliente ? `<span class="pedido-row__cliente">${p.nombre_cliente}</span>` : ''}
      </div>
      <span class="pedido-row__items">${resumen}${masItems}</span>
      <span class="pedido-row__time${urgente ? ' urgent' : ''}">
        ${minutos < 1 ? 'ahora' : minutos + ' min'}${urgente ? ' ⚠' : ''}
      </span>
      <span class="pedido-row__badge ${est.badge}">${est.label}</span>
    </div>
    ${detalleHtml}
  `
}

function detalleExpandido(p, siguienteEstado) {
  const abierto = state.expandidos.has(p.id)
  const items = (p.pedido_items ?? []).map(i => `
    <li class="pedido-detail__item">
      <span class="pedido-detail__qty">${i.cantidad}×</span>
      <span>${i.nombre_snapshot}</span>
      <span class="pedido-detail__price">RD$${(i.precio_snapshot * i.cantidad).toLocaleString('es-DO')}</span>
    </li>
  `).join('')

  const notaHtml = p.nota
    ? `<p class="pedido-detail__nota">Nota: ${p.nota}</p>` : ''

  const btnHtml = siguienteEstado ? accionBtn(p.id, siguienteEstado) : ''

  return `
    <div class="pedido-detail${abierto ? ' open' : ''}" id="detail-${p.id}">
      <ul class="pedido-detail__items">${items}</ul>
      ${notaHtml}
      <div class="pedido-detail__footer">
        <span class="pedido-detail__total">Total: RD$${Number(p.total).toLocaleString('es-DO')}</span>
        <div class="pedido-detail__actions">${btnHtml}</div>
      </div>
    </div>
  `
}

function accionBtn(id, sigEstado) {
  const mapa = {
    'en preparacion': { label: 'Preparar',  clase: 'btn-action--prep' },
    listo:            { label: 'Listo',     clase: 'btn-action--listo' },
    entregado:        { label: 'Entregar',  clase: 'btn-action--entregar' },
  }
  const info = mapa[sigEstado]
  if (!info) return ''
  return `
    <button
      class="btn-action ${info.clase}"
      onclick="cambiarEstado(event, '${id}', '${sigEstado}')"
    >${info.label}</button>
  `
}

// ════════════════════════════════════════════
// ACCIONES
// ════════════════════════════════════════════
function toggleDetalle(id) {
  if (state.expandidos.has(id)) {
    state.expandidos.delete(id)
  } else {
    state.expandidos.add(id)
  }
  const el = document.getElementById(`detail-${id}`)
  if (el) el.classList.toggle('open', state.expandidos.has(id))
}

async function cambiarEstado(e, id, nuevoEstado) {
  e.stopPropagation()
  const { error } = await db
    .from('pedidos')
    .update({ estado: nuevoEstado })
    .eq('id', id)

  if (error) { console.error(error); return }

  const idx = state.pedidos.findIndex(p => p.id === id)
  if (idx !== -1) {
    state.pedidos[idx].estado = nuevoEstado
    if (nuevoEstado === 'entregado' || nuevoEstado === 'cancelado') {
      state.pedidos.splice(idx, 1)
      state.expandidos.delete(id)
    }
  }
  renderLista()
  actualizarStats()
}

// ════════════════════════════════════════════
// STATS
// ════════════════════════════════════════════
function actualizarStats() {
  const pend  = state.pedidos.filter(p => p.estado === 'pendiente').length
  const prep  = state.pedidos.filter(p => p.estado === 'en preparacion').length
  const listo = state.pedidos.filter(p => p.estado === 'listo').length

  elHTotal.textContent    = `${state.pedidos.length} pedido${state.pedidos.length !== 1 ? 's' : ''}`
  elHPend.textContent     = `${pend} pendiente${pend !== 1 ? 's' : ''}`
  elHPrep.textContent     = `${prep} en prep.`
  elHListos.textContent   = `${listo} listo${listo !== 1 ? 's' : ''}`
}

// ════════════════════════════════════════════
// EVENTOS
// ════════════════════════════════════════════
function bindEvents() {
  elFiltros.addEventListener('click', e => {
    const btn = e.target.closest('.filter-pill')
    if (!btn) return
    state.filtroEstado = btn.dataset.estado
    elFiltros.querySelectorAll('.filter-pill').forEach(b =>
      b.classList.toggle('active', b === btn)
    )
    renderLista()
  })

  elSearch.addEventListener('input', e => {
    state.busqueda = e.target.value.trim()
    renderLista()
  })
}

window.toggleDetalle  = toggleDetalle
window.cambiarEstado  = cambiarEstado

document.addEventListener('DOMContentLoaded', init)
