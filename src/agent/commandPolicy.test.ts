import { describe, expect, it } from 'vitest'
import { getCommandPolicyDecision } from './commandPolicy'

describe('commandPolicy', () => {
  it('allows safe commands on the allowlist', () => {
    const result = getCommandPolicyDecision({ command: 'git', args: ['status'] })
    expect(result.decision).toBe('allow')
  })

  it('denies explicitly blocked commands', () => {
    const result = getCommandPolicyDecision({ command: 'rm', args: ['-rf', '.'] })
    expect(result.decision).toBe('deny')
    expect(result.decision === 'deny' && result.code).toBe('COMMAND_NOT_ALLOWED')
  })
})
