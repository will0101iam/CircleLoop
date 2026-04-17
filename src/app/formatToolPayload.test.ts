import { describe, expect, it } from 'vitest'
import { formatToolPayloadFull, formatToolPayloadPreview } from './formatToolPayload'

describe('formatToolPayload', () => {
  it('redacts sensitive keys (apiKey/token/authorization)', () => {
    const payload = { apiKey: 'k', nested: { token: 't', ok: true }, Authorization: 'Bearer abc' }
    const full = formatToolPayloadFull(payload)
    expect(full).not.toContain('"apiKey": "k"')
    expect(full).not.toContain('"token": "t"')
    expect(full).toContain('"apiKey": "***"')
    expect(full).toContain('"token": "***"')
  })

  it('redacts Bearer tokens in strings', () => {
    const payload = { header: 'Authorization: Bearer abc.def.ghi' }
    const full = formatToolPayloadFull(payload)
    expect(full).toContain('Bearer ***')
    expect(full).not.toContain('abc.def.ghi')
  })

  it('limits preview to maxPreviewChars', () => {
    const payload = { text: 'x'.repeat(5000) }
    const preview = formatToolPayloadPreview(payload, { maxPreviewChars: 800 })
    expect(preview.previewText.length).toBeLessThanOrEqual(801) // allow trailing ellipsis
    expect(preview.hasMore).toBe(true)
  })
})
