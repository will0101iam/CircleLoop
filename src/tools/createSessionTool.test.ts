import { describe, expect, it, vi } from 'vitest'
import { createCreateSessionTool } from './createSessionTool'

describe('create session tool', () => {
  it('allows creating a session before workspace is bound', async () => {
    const create = vi.fn().mockResolvedValue({
      id: 'session-1',
      title: 'T',
      workspacePath: null,
      status: 'idle',
      storage: 'sqlite',
      createdAt: 1,
    })

    const tool = createCreateSessionTool({ store: { create } })
    const result = await tool.handler({ title: 'T', workspacePath: null })

    expect(result.ok).toBe(true)
    expect(create).toHaveBeenCalledWith({ title: 'T', workspacePath: null })
  })

  it('creates a session through the store', async () => {
    const create = vi.fn().mockResolvedValue({
      id: 'session-1',
      title: 'T',
      workspacePath: '/tmp/x',
      status: 'idle',
      storage: 'sqlite',
      createdAt: 1,
    })

    const tool = createCreateSessionTool({ store: { create } })
    const result = await tool.handler({ title: 'T', workspacePath: '/tmp/x' })

    expect(result.ok).toBe(true)
    expect(create).toHaveBeenCalledWith({ title: 'T', workspacePath: '/tmp/x' })
  })
})
