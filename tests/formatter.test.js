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
    expect(content.length).toBeGreaterThan(0)
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
