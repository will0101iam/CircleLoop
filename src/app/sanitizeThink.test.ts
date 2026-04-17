import { describe, expect, it } from 'vitest'
import { sanitizeThink } from './sanitizeThink'

describe('sanitizeThink', () => {
  it('strips <think> from visible text and returns thinkText', () => {
    const out = sanitizeThink('a<think>secret plan</think>b')
    expect(out.visibleText).toBe('ab')
    expect(out.thinkText).toContain('secret')
  })

  it('trims leftover blank lines after removing think block', () => {
    const out = sanitizeThink('<think>secret</think>\n\n\nhello')
    expect(out.visibleText).toBe('hello')
    expect(out.thinkText).toBe('secret')
  })

  it('shows partial think content before closing tag arrives', () => {
    const out = sanitizeThink('<think>planning in progress')
    expect(out.visibleText).toBe('')
    expect(out.thinkText).toBe('planning in progress')
  })

  it('does not leak a partial opening think tag into visible text', () => {
    const out = sanitizeThink('回答前缀\n<thi')
    expect(out.visibleText).toBe('回答前缀')
    expect(out.thinkText).toBeNull()
  })

  it('does not leak a partial closing think tag into visible text', () => {
    const out = sanitizeThink('<think>planning</thi')
    expect(out.visibleText).toBe('')
    expect(out.thinkText).toBe('planning')
  })

  it('handles missing think', () => {
    const out = sanitizeThink('hello')
    expect(out.visibleText).toBe('hello')
    expect(out.thinkText).toBeNull()
  })
})
