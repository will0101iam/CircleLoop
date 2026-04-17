import { describe, expect, it } from 'vitest'

import { createThinkStreamParser } from './thinkStreamParser'

describe('thinkStreamParser', () => {
  it('never leaks think content into answer while streaming', () => {
    const p = createThinkStreamParser()
    p.pushDelta('Hello ')
    p.pushDelta('<thi')
    p.pushDelta('nk>')
    p.pushDelta('plan 1')
    p.pushDelta('</thi')
    p.pushDelta('nk>')
    p.pushDelta('World')

    expect(p.getAnswerText()).toBe('Hello World')
    expect(p.getThinkingText()).toBe('plan 1')
  })

  it('supports whitespace inside tags like <think >', () => {
    const p = createThinkStreamParser()
    p.pushDelta('<think >a</think >b')
    expect(p.getThinkingText()).toBe('a')
    expect(p.getAnswerText()).toBe('b')
  })

  it('keeps partial tags in internal buffer (not visible)', () => {
    const p = createThinkStreamParser()
    p.pushDelta('X<')
    expect(p.getAnswerText()).toBe('X')
    expect(p.getThinkingText()).toBe('')
  })
})

