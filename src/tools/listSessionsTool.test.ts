import { describe, expect, it, vi } from 'vitest'
import { createListSessionsTool } from './listSessionsTool'

describe('list sessions tool', () => {
  it('lists sessions through the store with default limit', async () => {
    const list = vi.fn().mockResolvedValue([
      {
        id: 'session-1',
        title: 'T',
        workspacePath: '/tmp/x',
        status: 'idle',
        storage: 'sqlite',
        createdAt: 1,
      },
    ])

    const tool = createListSessionsTool({ store: { list } })
    const result = await tool.handler({})

    expect(result.ok).toBe(true)
    expect(list).toHaveBeenCalledWith({ limit: 50 })
  })
})

