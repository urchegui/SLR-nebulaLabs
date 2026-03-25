import express      from 'express'
import cors         from 'cors'
import path         from 'path'
import { fileURLToPath } from 'url'
import 'dotenv/config'

import { runSearchAgent } from './agents/search-agent.js'
import { supabase }       from './db/client.js'

const app     = express()
const PORT    = process.env.PORT || 3000
const __dirname = path.dirname(fileURLToPath(import.meta.url))

app.use(cors())
app.use(express.json())

// Servir el frontend React buildeado
app.use(express.static(path.join(__dirname, '../web/dist')))

// ── Runs ──────────────────────────────────────────────────────────────────────

// POST /runs/create
app.post('/runs/create', async (req, res) => {
  const { topic, description } = req.body
  if (!topic) return res.status(400).json({ error: 'topic is required' })

  const { data: run, error } = await supabase
    .from('runs')
    .insert({ topic, status: 'pending' })
    .select()
    .single()

  if (error) return res.status(500).json({ error: error.message })

  const strings = description
    ? description.split('\n').map(s => s.trim()).filter(Boolean)
    : [topic]

  runSearchAgent(topic, strings).catch(err =>
    console.error(`[run:${run.id}] search agent error:`, err.message)
  )

  res.json(run)
})

// GET /runs
app.get('/runs', async (_req, res) => {
  const { data, error } = await supabase
    .from('runs')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) return res.status(500).json({ error: error.message })
  res.json(data)
})

// GET /runs/:id
app.get('/runs/:id', async (req, res) => {
  const { data, error } = await supabase
    .from('runs')
    .select('*')
    .eq('id', req.params.id)
    .single()
  if (error) return res.status(404).json({ error: error.message })
  res.json(data)
})

// GET /runs/:id/stats
app.get('/runs/:id/stats', async (req, res) => {
  const runId = req.params.id
  const [studiesRes, prismaRes] = await Promise.all([
    supabase.from('studies').select('id, screening_status, is_duplicate').eq('run_id', runId),
    supabase.from('prisma_log').select('*').eq('run_id', runId).order('created_at', { ascending: true })
  ])
  if (studiesRes.error) return res.status(500).json({ error: studiesRes.error.message })
  const studies = studiesRes.data || []
  res.json({
    total:      studies.length,
    duplicates: studies.filter(s => s.is_duplicate).length,
    pending:    studies.filter(s => s.screening_status === 'pending').length,
    included:   studies.filter(s => s.screening_status === 'included').length,
    excluded:   studies.filter(s => s.screening_status === 'excluded').length,
    prisma_log: prismaRes.data || []
  })
})

// GET /runs/:id/papers
app.get('/runs/:id/papers', async (req, res) => {
  const { status, limit = 50, offset = 0 } = req.query
  let query = supabase
    .from('studies')
    .select('*')
    .eq('run_id', req.params.id)
    .range(Number(offset), Number(offset) + Number(limit) - 1)
  if (status) query = query.eq('screening_status', status)
  const { data, error } = await query
  if (error) return res.status(500).json({ error: error.message })
  res.json(data)
})

// PATCH /runs/:id/papers/:paperId
app.patch('/runs/:id/papers/:paperId', async (req, res) => {
  const { screening_status, hitl_notes } = req.body
  const { data, error } = await supabase
    .from('studies')
    .update({ screening_status, hitl_notes, updated_at: new Date() })
    .eq('id', req.params.paperId)
    .eq('run_id', req.params.id)
    .select()
    .single()
  if (error) return res.status(500).json({ error: error.message })
  res.json(data)
})

// Cualquier ruta que no sea /runs devuelve el index.html de React
app.get('/{*splat}', (req, res) => {
  if (!req.path.startsWith('/runs') && !req.path.startsWith('/api')) {
    res.sendFile(path.join(__dirname, '../web/dist/index.html'))
  }
})

app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`)
})