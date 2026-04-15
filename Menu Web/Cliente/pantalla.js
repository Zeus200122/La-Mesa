
const preparando = document.getElementById('preparando')
const listos = document.getElementById('listos')

async function cargar() {
  const { data } = await db
    .from('pedidos')
    .select('id, estado, nombre_cliente')
    .order('created_at', { ascending: true })

  const enPrep = data.filter(p => p.estado === 'en preparacion')
  const listosData = data.filter(p => p.estado === 'listo')

  preparando.innerHTML = enPrep.map(p => cardPedido(p, 'prep')).join('')
  listos.innerHTML = listosData.map(p => cardPedido(p, 'listo')).join('')
}

function cardPedido(p, tipo) {
  return `
    <div class="pedido ${tipo}">
      <div class="codigo">#${p.id.slice(0,6)}</div>
      <div class="cliente">${p.nombre_cliente || 'Mesa ' + (p.numero_mesa ?? '')}</div>
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