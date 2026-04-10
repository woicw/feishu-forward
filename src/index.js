import 'dotenv/config'
import { Hono } from 'hono'
import { serve } from '@hono/node-server'
import { formatPayload } from './formatter.js'
import { sendToFeishu } from './feishu.js'

const app = new Hono()

const WEBHOOK_URL = process.env.FEISHU_WEBHOOK_URL
const SECRET = process.env.FEISHU_SECRET || undefined
const PORT = Number(process.env.PORT) || 16168

// Health check
app.get('/', (c) => c.json({ status: 'ok', service: 'feishu-forward' }))

// Webhook receiver
app.post('/webhook', async (c) => {
  const payload = await c.req.json()
  const message = formatPayload(payload)

  if (!WEBHOOK_URL) {
    return c.json({ error: 'FEISHU_WEBHOOK_URL not configured' }, 500)
  }

  try {
    const result = await sendToFeishu(WEBHOOK_URL, SECRET, message)
    return c.json({ success: true, result })
  } catch (err) {
    console.error('Forward failed:', err.message)
    return c.json({ error: err.message }, 502)
  }
})

serve({ fetch: app.fetch, port: PORT }, (info) => {
  console.log(`Feishu Forward running on http://localhost:${info.port}`)
})
