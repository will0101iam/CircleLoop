import { describe, expect, it } from 'vitest'
import { getPathGuardDecision } from './pathGuard'

describe('pathGuard', () => {
  it('rejects path traversal outside the workspace', () => {
    const result = getPathGuardDecision({
      workspacePath: '/tmp/ws',
      toolName: 'read_file',
      relativePath: '../etc/passwd',
    })

    expect(result.ok).toBe(false)
    expect(result.ok === false && result.error.code).toBe('PATH_NOT_ALLOWED')
  })

  it('rejects deleting the workspace root', () => {
    const result = getPathGuardDecision({
      workspacePath: '/tmp/ws',
      toolName: 'delete_file',
      relativePath: '.',
    })

    expect(result.ok).toBe(false)
    expect(result.ok === false && result.error.code).toBe('DANGEROUS_PATH_TARGET')
  })
})
