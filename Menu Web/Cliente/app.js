// ═══════════════════════════════════════════
// app.js — Lógica principal de la pantalla del cliente
// ═══════════════════════════════════════════

// ── Estado global ──────────────────────────
const state = {
  productos:        [],        // todos los productos cargados
  categoriaActiva:  'Todos',   // filtro activo
  carrito:          [],        // [{ producto, cantidad }]
}

// ── Referencias al DOM ─────────────────────
const $ = (id) => document.getElementById(id)

const elMesaNum     = $('mesa-numero')
const elCategorias  = $('categorias')
const elMenuGrid    = $('menu-grid')
const elCartToggle  = $('cart-toggle')
const elCartBadge   = $('cart-badge')
const elCartPanel   = $('cart-panel')
const elCartOverlay = $('cart-overlay')
const elCartClose   = $('cart-close')
const elCartList    = $('cart-list')
const elCartEmpty   = $('cart-empty')
const elCartTotal   = $('cart-total')
const elBtnConfirmar = $('btn-confirmar')
const elNotaPedido  = $('nota-pedido')
const elNombreCliente = $('nombre-cliente')  // puede ser null si no hay campo en el HTML
const elModalConfirm = $('modal-confirm')
const elConfirmNum  = $('confirm-num')
const elModalClose  = $('modal-close')

// ════════════════════════════════════════════
// INICIALIZACIÓN
// ════════════════════════════════════════════
async function init() {
  mostrarMesa()
  const productos = await cargarProductos()
  state.productos = productos
  renderCategorias()
  renderMenu()
  bindEvents()

  const { data, error } = await db.auth.getSession()
console.log("SESSION:", data)
console.log("SESSION ERROR:", error)
  actualizarCarritoUI() // 👈 IMPORTANTE

}

// ── Mostrar número de mesa ─────────────────
function mostrarMesa() {
  elMesaNum.textContent = MESA_ACTUAL ?? '—'
}

// ── Cargar productos desde Supabase ────────
// Si falla o la tabla está vacía, usa MENU_DEMO
async function cargarProductos() {
  try {
    const { data, error } = await db
      .from('productos')
      .select(`
        id,
        nombre,
        descripcion,
        precio,
        imagen_url,
        disponible,
        destacado,
        categorias ( nombre )
      `)
      .eq('disponible', true)
      .order('created_at')

    if (error) throw error

    if (!data || data.length === 0) {
      console.info('[info] Tabla productos vacía, usando datos de demostración.')
      return MENU_DEMO
    }

    return data
  } catch (err) {
    console.warn('[supabase] Error al cargar productos, usando demo:', err.message)
    return MENU_DEMO
  }
}

// ════════════════════════════════════════════
// RENDER — CATEGORÍAS
// ════════════════════════════════════════════
function renderCategorias() {
  const cats = ['Todos', ...new Set(state.productos.map(p => p.categorias?.nombre ?? 'Sin categoría'))]

  elCategorias.innerHTML = cats.map(cat => `
    <button
      class="cat-btn${cat === state.categoriaActiva ? ' active' : ''}"
      data-cat="${cat}"
      aria-pressed="${cat === state.categoriaActiva}"
    >
      ${cat}
    </button>
  `).join('')
}

// ════════════════════════════════════════════
// RENDER — GRID DE PRODUCTOS
// ════════════════════════════════════════════
function renderMenu() {
  const filtrados = state.categoriaActiva === 'Todos'
    ? state.productos.filter(p => p.disponible)
    : state.productos.filter(p => (p.categorias?.nombre ?? 'Sin categoría') === state.categoriaActiva && p.disponible)

  if (filtrados.length === 0) {
    elMenuGrid.innerHTML = '<p class="menu-empty">No hay productos en esta categoría.</p>'
    return
  }

  elMenuGrid.innerHTML = filtrados.map((p, i) => `
    <article
      class="card"
      style="animation-delay: ${i * 0.04}s"
      data-id="${p.id}"
    >
      <div class="card__img-wrap">
        ${p.imagen_url
          ? `<img src="${p.imagen_url}" alt="${p.nombre}" loading="lazy" />`
          : `<div class="card__placeholder">${EMOJI_CATEGORIA[p.categorias?.nombre] ?? EMOJI_CATEGORIA.default}</div>`
        }
        ${p.destacado ? '<span class="card__tag">Destacado</span>' : ''}
      </div>
      <div class="card__body">
        <p class="card__name">${p.nombre}</p>
        <p class="card__desc">${p.descripcion}</p>
        <div class="card__footer">
          <span class="card__price">RD$${p.precio.toLocaleString('es-DO')}</span>
          <button
            class="card__add"
            data-id="${p.id}"
            aria-label="Agregar ${p.nombre} al pedido"
          >+</button>
        </div>
      </div>
    </article>
  `).join('')
}

// ════════════════════════════════════════════
// CARRITO
// ════════════════════════════════════════════

// ── Agregar producto ───────────────────────
function agregarAlCarrito(id) {
  const producto = state.productos.find(p => String(p.id) === String(id))
  if (!producto) return

  const existente = state.carrito.find(i => i.producto.id === id)
  if (existente) {
    existente.cantidad += 1
  } else {
    state.carrito.push({ producto, cantidad: 1 })
  }

  actualizarCarritoUI()
  animarBotonAdd(id)
}

// ── Cambiar cantidad ───────────────────────
function cambiarCantidad(id, delta) {
  const idx = state.carrito.findIndex(i => i.producto.id === id)
  if (idx === -1) return

  state.carrito[idx].cantidad += delta

  if (state.carrito[idx].cantidad <= 0) {
    state.carrito.splice(idx, 1)
  }

  actualizarCarritoUI()
}

// ── Actualizar toda la UI del carrito ──────
function actualizarCarritoUI() {
  const total       = calcularTotal()
  const cantTotal   = state.carrito.reduce((s, i) => s + i.cantidad, 0)
  const carritoVacio = state.carrito.length === 0

  // Badge
  elCartBadge.textContent = cantTotal
  elCartBadge.classList.toggle('visible', cantTotal > 0)

  // Estado vacío
  elCartEmpty.classList.toggle('visible', carritoVacio)

  // Botón confirmar
  elBtnConfirmar.disabled = carritoVacio

  // Total
  elCartTotal.textContent = `RD$${total.toLocaleString('es-DO')}`

  // Lista
  if (carritoVacio) {
    elCartList.innerHTML = ''
    return
  }

  elCartList.innerHTML = state.carrito.map(item => `
    <li class="cart-item" data-id="${item.producto.id}">
      <span class="cart-item__name">${item.producto.nombre}</span>
      <div class="cart-item__controls">
        <button class="cart-item__qty-btn" data-action="menos" data-id="${item.producto.id}" aria-label="Quitar uno">−</button>
        <span class="cart-item__qty">${item.cantidad}</span>
        <button class="cart-item__qty-btn" data-action="mas" data-id="${item.producto.id}" aria-label="Agregar uno">+</button>
      </div>
      <span class="cart-item__subtotal">RD$${(item.producto.precio * item.cantidad).toLocaleString('es-DO')}</span>
    </li>
  `).join('')

  console.log('Productos:', state.productos)
}

// ── Calcular total ─────────────────────────
function calcularTotal() {
  return state.carrito.reduce((sum, i) => sum + i.producto.precio * i.cantidad, 0)
}

// ── Animación de feedback al agregar ──────
function animarBotonAdd(id) {
  const btn = document.querySelector(`.card__add[data-id="${id}"]`)
  if (!btn) return
  btn.textContent = '✓'
  btn.style.background = 'var(--gold)'
  setTimeout(() => {
    btn.textContent = '+'
    btn.style.background = ''
  }, 700)
}

// ════════════════════════════════════════════
// CONFIRMAR PEDIDO → SUPABASE
// ════════════════════════════════════════════
async function confirmarPedido() {
  if (state.carrito.length === 0) return

  elBtnConfirmar.textContent = 'Enviando…'
  elBtnConfirmar.classList.add('loading')

  console.log(window.db)
  
  const pedidoData = {
    numero_mesa: MESA_ACTUAL ?? null,
    nombre_cliente: elNombreCliente?.value?.trim() || null,
    tipo: TIPO_PEDIDO,
    nota: elNotaPedido.value.trim() || null,
    total: calcularTotal(),
    estado: 'pendiente',
  }

  const { data } = await db.auth.getSession()
  console.log("JWT:", data.session?.access_token)

  console.log("📦 DATOS PEDIDO:", pedidoData)

  console.log("SESSION:", data)
  try {
    // ═══════════════════════
    // 1. INSERT PEDIDO
    // ═══════════════════════
    const { data: pedido, error: errPedido } = await db
      .from('pedidos')
      .insert(pedidoData)
      .select('id')
      .single()

    console.log("🧾 RESPUESTA PEDIDO:", pedido)
    console.log("❌ ERROR PEDIDO:", errPedido)

    if (errPedido) throw errPedido

    if (!pedido || !pedido.id) {
      throw new Error("Pedido no creado correctamente")
    }

    // ═══════════════════════
    // 2. PREPARAR ITEMS
    // ═══════════════════════
    const items = state.carrito.map(i => ({
      pedido_id: pedido.id,
      producto_id: i.producto.id?.toString().startsWith('demo') ? null : i.producto.id,
      nombre_snapshot: i.producto.nombre,
      precio_snapshot: i.producto.precio,
      cantidad: i.cantidad,
    }))

    console.log("🛒 ITEMS A INSERTAR:", items)

    // ═══════════════════════
    // 3. INSERT ITEMS
    // ═══════════════════════
    const { data: dataItems, error: errItems } = await db
      .from('pedido_items')
      .insert(items)

    console.log("📦 RESPUESTA ITEMS:", dataItems)
    console.log("❌ ERROR ITEMS:", errItems)

    if (errItems) throw errItems

    // ═══════════════════════
    // 4. TODO OK
    // ═══════════════════════
    mostrarConfirmacion(pedido.id.slice(0, 8).toUpperCase())

  } catch (err) {
    console.error('💥 ERROR COMPLETO:', err)

    alert(`
Error al enviar pedido:

${err.message}

(Revisa la consola para más detalles)
    `)
  } finally {
    elBtnConfirmar.textContent = 'Confirmar pedido'
    elBtnConfirmar.classList.remove('loading')
  }
}

// ════════════════════════════════════════════
// MODAL DE CONFIRMACIÓN
// ════════════════════════════════════════════
function mostrarConfirmacion(pedidoId) {
  cerrarCarrito()

  // Limpiar estado
  state.carrito = []
  elNotaPedido.value = ''
  actualizarCarritoUI()

  // Mostrar modal
  elConfirmNum.textContent = `Pedido #${pedidoId}`
  elModalConfirm.classList.add('open')
  elModalConfirm.setAttribute('aria-hidden', 'false')
}

function cerrarModal() {
  elModalConfirm.classList.remove('open')
  elModalConfirm.setAttribute('aria-hidden', 'true')
}

// ════════════════════════════════════════════
// PANEL DEL CARRITO (abrir/cerrar)
// ════════════════════════════════════════════
function abrirCarrito() {
  elCartPanel.classList.add('open')
  elCartPanel.setAttribute('aria-hidden', 'false')
  document.body.style.overflow = 'hidden'
}

function cerrarCarrito() {
  elCartPanel.classList.remove('open')
  elCartPanel.setAttribute('aria-hidden', 'true')
  document.body.style.overflow = ''
}

// ════════════════════════════════════════════
// EVENTOS
// ════════════════════════════════════════════
function bindEvents() {
  // Filtros de categoría (delegación)
  elCategorias.addEventListener('click', (e) => {
    const btn = e.target.closest('.cat-btn')
    if (!btn) return
    state.categoriaActiva = btn.dataset.cat

    // Actualizar botones activos
    elCategorias.querySelectorAll('.cat-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.cat === state.categoriaActiva)
      b.setAttribute('aria-pressed', b.dataset.cat === state.categoriaActiva)
    })

    renderMenu()
  })

  // Agregar al carrito (delegación en el grid)
  elMenuGrid.addEventListener('click', (e) => {
    const btn = e.target.closest('.card__add')
    if (!btn) return
  agregarAlCarrito(btn.dataset.id)  
})

  // Controles del carrito (delegación)
  elCartList.addEventListener('click', (e) => {
    const btn = e.target.closest('.cart-item__qty-btn')
    if (!btn) return
    const id = btn.dataset.id
    const delta = btn.dataset.action === 'mas' ? 1 : -1
    cambiarCantidad(id, delta)
  })

  // Abrir/cerrar carrito
  elCartToggle.addEventListener('click', abrirCarrito)
  elCartClose.addEventListener('click', cerrarCarrito)
  elCartOverlay.addEventListener('click', cerrarCarrito)

  // Confirmar pedido
  elBtnConfirmar.addEventListener('click', confirmarPedido)

  // Cerrar modal
  elModalClose.addEventListener('click', cerrarModal)

  // Cerrar modal con Escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (elModalConfirm.classList.contains('open')) cerrarModal()
      else cerrarCarrito()
    }
  })
}

// ════════════════════════════════════════════
// ARRANQUE
// ════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', init)
