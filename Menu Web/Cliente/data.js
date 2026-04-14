// ═══════════════════════════════════════════
// data.js — Configuración de Supabase y datos
// ═══════════════════════════════════════════

// ── Configuración de Supabase ──────────────
const SUPABASE_URL  = 'https://mgcoqkrtncnapbkbyzzr.supabase.co'
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1nY29xa3J0bmNuYXBia2J5enpyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU5NDgzNDMsImV4cCI6MjA5MTUyNDM0M30.O2tuuH4R0zLuvxes7mi0DOGnvwGQG4ihLtmmY7WyKxY'

// Inicializar cliente (disponible globalmente)
const { createClient } = supabase
const db = createClient(SUPABASE_URL, SUPABASE_ANON)

// ── Parámetros de la URL ───────────────────
// Uso:
//   ?mesa=5            → pedido en mesa 5
//   ?tipo=para+llevar  → pedido para llevar
//   (sin parámetros)   → kiosco general, pedirá el nombre
const urlParams   = new URLSearchParams(window.location.search)
const MESA_ACTUAL = urlParams.get('mesa')   ? parseInt(urlParams.get('mesa')) : null
const TIPO_PEDIDO = urlParams.get('tipo')   || (MESA_ACTUAL ? 'mesa' : 'para llevar')

// ── Emojis de fallback por categoría ──────
// Se usan cuando el producto no tiene imagen_url
const EMOJI_CATEGORIA = {
  'Entradas':       '🥗',
  'Platos fuertes': '🍽️',
  'Bebidas':        '🥤',
  'Postres':        '🍮',
  'default':        '🍴',
}

// ── Datos de demostración ──────────────────
// Solo se usan si Supabase no responde o la tabla está vacía.
const MENU_DEMO = [
  {
    id: 'demo-1',
    nombre: 'Mofongo de camarones',
    descripcion: 'Plátano verde majado con ajo, chicharrón y camarones al ajillo',
    precio: 595,
    categorias: { nombre: 'Platos fuertes' },
    imagen_url: null,
    disponible: true,
    destacado: true,
  },
  {
    id: 'demo-2',
    nombre: 'Tostones con queso',
    descripcion: 'Crujientes tostones con queso blanco y salsa rosada',
    precio: 220,
    categorias: { nombre: 'Entradas' },
    imagen_url: null,
    disponible: true,
    destacado: false,
  },
  {
    id: 'demo-3',
    nombre: 'Pollo guisado',
    descripcion: 'Muslo de pollo criollo con arroz blanco y habichuelas',
    precio: 450,
    categorias: { nombre: 'Platos fuertes' },
    imagen_url: null,
    disponible: true,
    destacado: false,
  },
  {
    id: 'demo-4',
    nombre: 'Jugo de chinola',
    descripcion: 'Maracuyá fresco con agua o leche, sin azúcar añadida',
    precio: 120,
    categorias: { nombre: 'Bebidas' },
    imagen_url: null,
    disponible: true,
    destacado: false,
  },
  {
    id: 'demo-5',
    nombre: 'Ceviche de pargo',
    descripcion: 'Pargo fresco marinado en limón con cebolla roja y cilantro',
    precio: 480,
    categorias: { nombre: 'Entradas' },
    imagen_url: null,
    disponible: true,
    destacado: true,
  },
  {
    id: 'demo-6',
    nombre: 'Flan de coco',
    descripcion: 'Flan artesanal de coco tostado con caramelo oscuro',
    precio: 195,
    categorias: { nombre: 'Postres' },
    imagen_url: null,
    disponible: true,
    destacado: false,
  },
]