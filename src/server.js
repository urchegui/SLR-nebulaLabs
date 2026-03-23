import express      from 'express'
import cors         from 'cors'
import 'dotenv/config'

import { generateSearchStrings } from './agents/string-generator.js'
import { runSearchAgent }        from './agents/search-agent.js'
import { supabase }              from './db/client.js'

const app  = express()
const PORT = process.env.PORT || 3000

app.use(cors({ origin: 'http://localhost:5173' }))
app.use(express.json())

// ─── POST /runs/create ───────────────────────────────────────────────────────
// El usuario describe su SLR en lenguaje natural
// Claude genera los strings booleanos
// Se lanza el Search Agent y se devuelve el run_id

app.post('/runs/create', async (req, res) => {
  const { topic, description } = req.body

  if (!topic) {
    return res.status(400).json({ error: 'El campo topic es obligatorio' })
  }

  try {
    // 1. Claude genera los strings booleanos
    console.log('Generando strings booleanos para:', topic)
    const strings = await generateSearchStrings(topic, description)

    // 2. Lanzar el Search Agent (no esperamos a que termine)
    //    Devolvemos el run_id inmediatamente para que el
    //    frontend pueda hacer polling del progreso
    let runId = null

    runSearchAgent(topic, strings)
      .then(id  => { runId = id })
      .catch(err => console.error('Search Agent error:', err))

    // Pequeña espera para que el run se cree en BD
    await new Promise(r => setTimeout(r, 800))

    // 3. Obtener el run recién creado
    const { data: run } = await supabase
      .from('runs')
      .select('id, topic, status, created_at')
      .eq('topic', topic)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    res.json({
      run_id:  run.id,
      topic:   run.topic,
      status:  run.status,
      strings              // devolvemos los strings para que el usuario los vea
    })

  } catch (err) {
    console.error('Error en /runs/create:', err)
    res.status(500).json({ error: err.message })
  }
})

// ─── GET /runs/:id ───────────────────────────────────────────────────────────
// Estado actual del run + conteos PRISMA

app.get('/runs/:id', async (req, res) => {
  const { id } = req.params

  const { data: run, error } = await supabase
    .from('runs')
    .select('id, topic, status, created_at, updated_at')
    .eq('id', id)
    .single()

  if (error || !run) {
    return res.status(404).json({ error: 'Run no encontrado' })
  }

  // Conteos PRISMA de este run
  const { data: events } = await supabase
    .from('prisma_events')
    .select('stage, event_type, count, notes, created_at')
    .eq('run_id', id)
    .order('created_at', { ascending: true })

  res.json({ run, prisma_events: events || [] })
})

// ─── GET /runs/:id/stats ─────────────────────────────────────────────────────
// Estadísticas de screening para el dashboard

app.get('/runs/:id/stats', async (req, res) => {
  const { id } = req.params

  const { data: studies } = await supabase
    .from('studies')
    .select(`
      id,
      is_duplicate,
      screening_decisions ( decision, by_human, confidence )
    `)
    .eq('run_id', id)

  if (!studies) return res.json({ total: 0 })

  const stats = {
    total:       studies.length,
    duplicates:  studies.filter(s => s.is_duplicate).length,
    include:     0,
    exclude:     0,
    maybe:       0,
    hitl:        0,
    unscreened:  0
  }

  for (const study of studies) {
    if (study.is_duplicate) continue
    const last = study.screening_decisions?.at(-1)
    if (!last)                      stats.unscreened++
    else if (last.decision === 'include') stats.include++
    else if (last.decision === 'exclude') stats.exclude++
    else {
      stats.maybe++
      if (last.confidence < 0.7)    stats.hitl++
    }
  }

  res.json(stats)
})

// ─── GET /runs ───────────────────────────────────────────────────────────────
// Lista de todos los runs

app.get('/runs', async (req, res) => {
  const { data: runs } = await supabase
    .from('runs')
    .select('id, topic, status, created_at')
    .order('created_at', { ascending: false })
    .limit(20)

  res.json(runs || [])
})

// ─── Arrancar servidor ───────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`)
})