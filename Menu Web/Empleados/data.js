// ═══════════════════════════════════════════
// data.js — Panel de empleados
// ═══════════════════════════════════════════

// ── Mismas credenciales que el cliente ─────
const SUPABASE_URL  = 'https://mgcoqkrtncnapbkbyzzr.supabase.co'
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1nY29xa3J0bmNuYXBia2J5enpyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU5NDgzNDMsImV4cCI6MjA5MTUyNDM0M30.O2tuuH4R0zLuvxes7mi0DOGnvwGQG4ihLtmmY7WyKxY'

const { createClient } = supabase
const db = createClient(SUPABASE_URL, SUPABASE_ANON)

// ── Estados del pedido ──────────────────────
// Orden y etiquetas de los estados para botones y badges
const ESTADOS = {
  pendiente:        { label: 'Pendiente',    badge: 'badge--pendiente',      siguiente: 'en preparacion' },
  'en preparacion': { label: 'En prep.',     badge: 'badge--en-preparacion', siguiente: 'listo' },
  listo:            { label: 'Listo',        badge: 'badge--listo',          siguiente: 'entregado' },
  entregado:        { label: 'Entregado',    badge: 'badge--entregado',      siguiente: null },
  cancelado:        { label: 'Cancelado',    badge: 'badge--cancelado',      siguiente: null },
}

// Labels para los botones de acción
const BTN_LABELS = {
  'en preparacion': { label: 'Preparar',  clase: 'btn-estado--preparar' },
  listo:            { label: 'Listo',     clase: 'btn-estado--listo' },
  entregado:        { label: 'Entregar',  clase: 'btn-estado--entregar' },
}
