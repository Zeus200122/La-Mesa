
const preparando = document.getElementById('preparando')
const listos = document.getElementById('listos')

const pedidoActual = localStorage.getItem('pedido_actual')


async function cargar() {
  const { data } = await db
    .from('pedidos')
    .select('id, estado, nombre_cliente, created_at')
    .order('created_at', { ascending: true })

  const enPrep = data.filter(p => p.estado === 'en preparacion')
  const listosData = data.filter(p => p.estado === 'listo')

  preparando.innerHTML = enPrep
    .map((p, i) => cardPedido(p, 'prep', i + 1))
    .join('')

  listos.innerHTML = listosData
    .map((p, i) => cardPedido(p, 'listo', i + 1))
    .join('')
}

function cardPedido(p, tipo, posicion) {
  const esMio = p.id === pedidoActual

  return `
    <div class="pedido ${tipo} ${esMio ? 'mi-pedido' : ''}">
      <div class="turno">#${posicion}</div>
      <div class="codigo">${p.id.slice(0,6)}</div>
      <div class="cliente">${p.nombre_cliente || 'Cliente'}</div>
      ${esMio ? '<div class="badge">🟡 Tu pedido</div>' : ''}
    </div>
  `
}

function volverMenu() {
  window.location.href = "index.html"
}

// realtime
db.channel('pedidos')
  .on('postgres_changes', {
    event: '*',
    schema: 'public',
    table: 'pedidos'
  }, cargar)
  .subscribe()

cargar()