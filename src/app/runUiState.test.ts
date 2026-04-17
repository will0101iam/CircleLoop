import { describe, expect, it } from 'vitest'
import { isThinkingExpanded } from './runUiState'

describe('runUiState', () => {
  it('auto-expands thinking while waiting for approval', () => {
    expect(isThinkingExpanded({ status: 'waiting_approval', hasStartedAnswer: false }, false)).toBe(true)
  })

  it('keeps thinking open after approval until the answer starts', () => {
    expect(isThinkingExpanded({ status: 'completed', hasStartedAnswer: false }, false)).toBe(true)
    expect(isThinkingExpanded({ status: 'completed', hasStartedAnswer: true }, false)).toBe(false)
    expect(isThinkingExpanded({ status: 'completed', hasStartedAnswer: true }, true)).toBe(true)
  })
})
