# Feishu Forward Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a lightweight Hono HTTP service that receives arbitrary webhook POST requests and forwards them as rich-text messages to a Feishu group bot.

**Architecture:** Single-process stateless HTTP server. `POST /webhook` receives JSON, formatter converts it to Feishu post format, feishu module handles signing and sending. Config via env vars.

**Tech Stack:** Node.js, JavaScript, Hono, @hono/node-server, dotenv, pnpm, vitest (testing)

---

### Task 1: Project Setup

**Files:**
- Modify: `package.json`
- Create: `.gitignore`
- Create: `.env.example`

**Step 1: Install dependencies**

```bash
cd /Users/woic/ifly/feishu-forward
pnpm add hono @hono/node-server dotenv
pnpm add -D vitest
```

**Step 2: Update package.json scripts**

Add to `package.json` scripts:
```json
{
  "scripts": {
    "start": "node src/index.js",
    "dev": "node --watch src/index.js",
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```

**Step 3: Create .gitignore**

```
node_modules
.env
dist
```

**Step 4: Create .env.example**

```
FEISHU_WEBHOOK_URL=https://open.feishu.cn/open-apis/bot/v2/hook/your-token-here
FEISHU_SECRET=
PORT=3000
```

**Step 5: Commit**

```bash
git add package.json pnpm-lock.yaml .gitignore .env.example
git commit -m "chore: project setup with hono, dotenv, vitest"
```

---

### Task 2: Feishu Signing Module

**Files:**
- Create: `src/feishu.js`
- Create: `tests/feishu.test.js`

**Step 1: Write the failing test**

Create `tests/feishu.test.js`:

```js
import { describe, it, expect } from 'vitest'
import { generateSign } from '../src/feishu.js'

describe('generateSign', () => {
  it('returns empty object when no secret provided', () => {
    const result = generateSign(undefined)
    expect(result).toEqual({})
  })

  it('returns timestamp and sign when secret provided', () => {
    const result = generateSign('test-secret')
    expect(result).toHaveProperty('timestamp')
    expect(result).toHaveProperty('sign')
    expect(typeof result.timestamp).toBe('string')
    expect(typeof result.sign).toBe('string')
  })

  it('generates valid HMAC-SHA256 signature', () => {
    // Known test vector: timestamp=1599360473, secret="test-secret"
    // stringToSign = "1599360473\ntest-secret"
    const result = generateSign('test-secret', 1599360473)
    expect(result.timestamp).toBe('1599360473')
    expect(result.sign).toMatch(/^[A-Za-z0-9+/]+=*$/) // base64 format
  })
})
```

**Step 2: Run test to verify it fails**

```bash
pnpm test
```
Expected: FAIL — `generateSign` not found

**Step 3: Write implementation**

Create `src/feishu.js`:

```js
import { createHmac } from 'node:crypto'

/**
 * Generate Feishu webhook signature.
 * Algorithm: Base64(HmacSHA256(timestamp + "\n" + secret))
 */
export function generateSign(secret, timestampSec) {
  if (!secret) return {}

  const timestamp = String(timestampSec ?? Math.floor(Date.now() / 1000))
  const stringToSign = `${timestamp}\n${secret}`
  const sign = createHmac('sha256', stringToSign)
    .update('')
    .digest('base64')

  return { timestamp, sign }
}

/**
 * Send a message to Feishu webhook.
 */
export async function sendToFeishu(webhookUrl, secret, message) {
  const signFields = generateSign(secret)
  const body = { ...signFields, ...message }

  const res = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  const data = await res.json()
  if (data.code !== 0) {
    throw new Error(`Feishu API error: code=${data.code}, msg=${data.msg}`)
  }
  return data
}
```

**Step 4: Run test to verify it passes**

```bash
pnpm test
```
Expected: PASS

**Step 5: Commit**

```bash
git add src/feishu.js tests/feishu.test.js
git commit -m "feat: add feishu signing and send module"
```

---

### Task 3: Payload Formatter

**Files:**
- Create: `src/formatter.js`
- Create: `tests/formatter.test.js`

**Step 1: Write the failing test**

Create `tests/formatter.test.js`:

```js
import { describe, it, expect } from 'vitest'
import { formatPayload } from '../src/formatter.js'

describe('formatPayload', () => {
  it('extracts title from payload.title', () => {
    const msg = formatPayload({ title: 'Deploy Success', status: 'ok' })
    expect(msg.content.post.zh_cn.title).toBe('Deploy Success')
  })

  it('falls back to "Webhook 通知" when no title field', () => {
    const msg = formatPayload({ foo: 'bar' })
    expect(msg.content.post.zh_cn.title).toBe('Webhook 通知')
  })

  it('tries text, message, subject as title fallbacks', () => {
    expect(formatPayload({ message: 'Hello' }).content.post.zh_cn.title).toBe('Hello')
    expect(formatPayload({ subject: 'Alert' }).content.post.zh_cn.title).toBe('Alert')
    expect(formatPayload({ text: 'Info' }).content.post.zh_cn.title).toBe('Info')
  })

  it('sets msg_type to post', () => {
    const msg = formatPayload({ foo: 'bar' })
    expect(msg.msg_type).toBe('post')
  })

  it('formats payload fields as rich text content lines', () => {
    const msg = formatPayload({ title: 'Test', status: 'ok', env: 'prod' })
    const content = msg.content.post.zh_cn.content
    // content is array of arrays (lines), each line has tag elements
    expect(content.length).toBeGreaterThan(0)
    // Should contain status and env info (title is extracted, not shown in body)
    const allText = content.flat().map(el => el.text || '').join('')
    expect(allText).toContain('status')
    expect(allText).toContain('ok')
  })

  it('handles non-object payload by showing JSON', () => {
    const msg = formatPayload('just a string')
    const content = msg.content.post.zh_cn.content
    expect(content.length).toBeGreaterThan(0)
  })
})
```

**Step 2: Run test to verify it fails**

```bash
pnpm test
```
Expected: FAIL — `formatPayload` not found

**Step 3: Write implementation**

Create `src/formatter.js`:

```js
const TITLE_KEYS = ['title', 'text', 'message', 'subject']

/**
 * Format an arbitrary webhook payload into a Feishu rich-text (post) message.
 */
export function formatPayload(payload) {
  // Extract title
  let title = 'Webhook 通知'
  let bodyData = payload

  if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
    for (const key of TITLE_KEYS) {
      if (typeof payload[key] === 'string' && payload[key].trim()) {
        title = payload[key]
        // Remove title field from body display
        const { [key]: _, ...rest } = payload
        bodyData = rest
        break
      }
    }
  }

  // Build rich text content lines
  const contentLines = buildContentLines(bodyData)

  return {
    msg_type: 'post',
    content: {
      post: {
        zh_cn: {
          title,
          content: contentLines,
        },
      },
    },
  }
}

function buildContentLines(data) {
  if (data === null || data === undefined) {
    return [[{ tag: 'text', text: '(empty)' }]]
  }

  if (typeof data !== 'object') {
    return [[{ tag: 'text', text: String(data) }]]
  }

  const lines = []
  for (const [key, value] of Object.entries(data)) {
    const displayValue = typeof value === 'object'
      ? JSON.stringify(value)
      : String(value)
    lines.push([
      { tag: 'text', text: `${key}: ` },
      { tag: 'text', text: displayValue },
    ])
  }

  return lines.length > 0 ? lines : [[{ tag: 'text', text: '(empty)' }]]
}
```

**Step 4: Run test to verify it passes**

```bash
pnpm test
```
Expected: PASS

**Step 5: Commit**

```bash
git add src/formatter.js tests/formatter.test.js
git commit -m "feat: add webhook payload formatter"
```

---

### Task 4: Hono Server & Routes

**Files:**
- Create: `src/index.js`

**Step 1: Write the server**

Create `src/index.js`:

```js
import 'dotenv/config'
import { Hono } from 'hono'
import { serve } from '@hono/node-server'
import { formatPayload } from './formatter.js'
import { sendToFeishu } from './feishu.js'

const app = new Hono()

const WEBHOOK_URL = process.env.FEISHU_WEBHOOK_URL
const SECRET = process.env.FEISHU_SECRET || undefined
const PORT = Number(process.env.PORT) || 3000

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
```

**Step 2: Verify server starts**

```bash
node src/index.js &
curl http://localhost:3000/
# Expected: {"status":"ok","service":"feishu-forward"}
kill %1
```

**Step 3: Commit**

```bash
git add src/index.js
git commit -m "feat: add hono server with webhook route"
```

---

### Task 5: End-to-End Verification

**Step 1: Create a .env file with real Feishu webhook URL**

```bash
cp .env.example .env
# Edit .env with actual FEISHU_WEBHOOK_URL and FEISHU_SECRET
```

**Step 2: Start the server**

```bash
pnpm start
```

**Step 3: Send a test webhook**

```bash
curl -X POST http://localhost:3000/webhook \
  -H "Content-Type: application/json" \
  -d '{"title": "测试通知", "status": "success", "env": "production", "message": "部署完成"}'
```

Expected: Message appears in the Feishu group chat as a rich-text card with title "测试通知".

**Step 4: Run all tests**

```bash
pnpm test
```
Expected: All tests pass.

**Step 5: Final commit (if any changes needed)**

```bash
git add -A
git commit -m "chore: final adjustments after e2e verification"
```
