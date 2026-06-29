import { describe, expect, it } from 'vitest'
import { buildSystemPrompt, formatCurrentDateForModel } from './systemPrompt'

describe('systemPrompt', () => {
  it('formats the current date for model context', () => {
    expect(formatCurrentDateForModel(new Date('2026-06-26T03:04:05Z'))).toBe('2026年06月26日')
  })

  it('includes the current date in the system prompt', () => {
    const prompt = buildSystemPrompt(new Date('2026-06-26T03:04:05Z'))

    expect(prompt).toContain('当前日期：2026年06月26日')
    expect(prompt).toContain('You are circleloop, a coding agent.')
  })
})
