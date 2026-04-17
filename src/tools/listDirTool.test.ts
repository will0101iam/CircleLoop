import { describe, expect, it, vi } from 'vitest'
import { createListDirTool } from './listDirTool'

describe('list dir tool', () => {
  it('lists a directory under workspace', async () => {
    const listDir = vi.fn().mockResolvedValue([{ name: 'src', isDir: true }])
    const tool = createListDirTool({
      workspacePath: '/tmp/ws',
      fileOps: { listDir, readTextFile: vi.fn() },
    })

    const result = await tool.handler({ path: '.' })
    expect(result.ok).toBe(true)
    expect(listDir).toHaveBeenCalledWith('/tmp/ws')
  })

  it('rejects absolute paths', async () => {
    const listDir = vi.fn()
    const tool = createListDirTool({
      workspacePath: '/tmp/ws',
      fileOps: { listDir, readTextFile: vi.fn() },
    })

    const result = await tool.handler({ path: '/etc' })
    expect(result.ok).toBe(false)
    expect(result.ok === false && result.error.code).toBe('INVALID_PATH')
  })
})

