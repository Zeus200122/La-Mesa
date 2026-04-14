// ═══════════════════════════════════════════
// data.js — Admin de productos
// ═══════════════════════════════════════════

const SUPABASE_URL  = 'https://mgcoqkrtncnapbkbyzzr.supabase.co'
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1nY29xa3J0bmNuYXBia2J5enpyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU5NDgzNDMsImV4cCI6MjA5MTUyNDM0M30.O2tuuH4R0zLuvxes7mi0DOGnvwGQG4ihLtmmY7WyKxY'

const { createClient } = supabase
const db = createClient(SUPABASE_URL, SUPABASE_ANON)

// Bucket de Storage donde se guardan las imágenes
const STORAGE_BUCKET = 'productos'
