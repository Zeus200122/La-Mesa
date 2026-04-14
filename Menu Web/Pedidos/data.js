// ═══════════════════════════════════════════
// data.js — Página de pedidos activos
// ═══════════════════════════════════════════

const SUPABASE_URL  = 'https://mgcoqkrtncnapbkbyzzr.supabase.co'
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1nY29xa3J0bmNuYXBia2J5enpyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU5NDgzNDMsImV4cCI6MjA5MTUyNDM0M30.O2tuuH4R0zLuvxes7mi0DOGnvwGQG4ihLtmmY7WyKxY'

const { createClient } = supabase
const db = createClient(SUPABASE_URL, SUPABASE_ANON)

const ESTADOS = {
  pendiente:        { label: 'Pendiente',  badge: 'badge--pendiente',      siguiente: 'en preparacion' },
  'en preparacion': { label: 'En prep.',   badge: 'badge--en-preparacion', siguiente: 'listo' },
  listo:            { label: 'Listo',      badge: 'badge--listo',          siguiente: 'entregado' },
  entregado:        { label: 'Entregado',  badge: 'badge--entregado',      siguiente: null },
}
