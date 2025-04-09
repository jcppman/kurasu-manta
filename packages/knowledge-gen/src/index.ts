import express from 'express'
import { serve } from 'inngest/express'
import { functions, inngest } from './inngest'

// Initialize Express app
const app = express()

// Middleware
app.use(express.json())

// Set up Inngest routes
app.use('/api/inngest', serve({ client: inngest, functions }))

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// Start the server
const PORT = process.env.PORT || 3000
app.listen(PORT, async () => {
  console.log(`Knowledge Generation Server running on http://localhost:${PORT}`)
})
