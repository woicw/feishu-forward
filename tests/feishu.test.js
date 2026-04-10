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
    const result = generateSign('test-secret', 1599360473)
    expect(result.timestamp).toBe('1599360473')
    expect(result.sign).toMatch(/^[A-Za-z0-9+/]+=*$/) // base64 format
  })
})
