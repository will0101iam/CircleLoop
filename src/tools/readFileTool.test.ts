import { describe, expect, it, vi } from 'vitest'
import { createReadFileTool } from './readFileTool'

describe('read file tool', () => {
  it('reads a file under workspace', async () => {
    const readTextFile = vi.fn().mockResolvedValue('hello')
    const tool = createReadFileTool({
      workspacePath: '/tmp/ws',
      fileOps: { exists: vi.fn().mockResolvedValue(true), readTextFile, listDir: vi.fn() } as any,
    })

    const result = await tool.handler({ path: 'README.md' })
    expect(result.ok).toBe(true)
    expect(readTextFile).toHaveBeenCalledWith('/tmp/ws/README.md')
  })

  it('rejects path traversal', async () => {
    const readTextFile = vi.fn()
    const tool = createReadFileTool({
      workspacePath: '/tmp/ws',
      fileOps: { exists: vi.fn().mockResolvedValue(true), readTextFile, listDir: vi.fn() } as any,
    })

    const result = await tool.handler({ path: '../secret' })
    expect(result.ok).toBe(false)
    expect(result.ok === false && result.error.code).toBe('INVALID_PATH')
  })
})
