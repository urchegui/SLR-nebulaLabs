import express      from 'express'
import cors         from 'cors'
import path         from 'path'
import { fileURLToPath } from 'url'
import 'dotenv/config'

import { generateSearchStrings } from './agents/string-generator.js'
import { runSearchAgent }        from './agents/search-agent.js'
import { supabase }              from './db/client.js'

const app     = express()
const PORT    = process.env.PORT || 3000
const __dirname = path.dirname(fileURLToPath(import.meta.url))

app.use(cors())
app.use(express.json())

// Servir el frontend React buildeado
app.use(express.static(path.join(__dirname, '../web/dist')))

// ... todas tus rutas API igual que antes ...

// Cualquier ruta que no sea /api devuelve el index.html de React
app.get('/{*splat}', (req, res) => {
  if (!req.path.startsWith('/runs') && !req.path.startsWith('/api')) {
    res.sendFile(path.join(__dirname, '../web/dist/index.html'))
  }
})

app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`)
})