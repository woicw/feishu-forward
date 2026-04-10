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
