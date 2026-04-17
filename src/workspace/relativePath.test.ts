import { describe, expect, it } from 'vitest'
import { resolveWorkspacePath } from './relativePath'

describe('resolveWorkspacePath', () => {
  it('resolves a normal relative path under workspace', () => {
    expect(resolveWorkspacePath('/tmp/ws', 'src/index.ts')).toBe('/tmp/ws/src/index.ts')
  })

  it('rejects absolute paths', () => {
    expect(() => resolveWorkspacePath('/tmp/ws', '/etc/passwd')).toThrow('ABSOLUTE_PATH_NOT_ALLOWED')
  })

  it('rejects parent traversal', () => {
    expect(() => resolveWorkspacePath('/tmp/ws', '../x')).toThrow('PARENT_TRAVERSAL_NOT_ALLOWED')
    expect(() => resolveWorkspacePath('/tmp/ws', 'a/../../x')).toThrow('PARENT_TRAVERSAL_NOT_ALLOWED')
  })
})

