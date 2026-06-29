import { describe, expect, it, vi } from 'vitest'
import { createRuntime } from './runtime'

describe('runtime', () => {
  it('creates db and exposes tool execution through registry', async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce([{ id: 'session-1' }])
      .mockResolvedValueOnce([{ name: 'workspace_path' }])
      .mockResolvedValueOnce([{ name: 'workspace_path', notnull: 0 }])
      .mockResolvedValueOnce([
        {
          id: 'session-2',
          title: 'B',
          workspacePath: '/tmp/b',
          status: 'idle',
          storage: 'sqlite',
          createdAt: 2,
        },
      ])
    const run = vi.fn().mockResolvedValue(undefined)

    const createAppDb = vi.fn().mockResolvedValue({ query, run })
    const rt = await createRuntime({ createAppDb, createId: () => 'session-2', now: () => 2 })

    const result = await rt.tools.execute('query_sql', {
      sql: 'select id from sessions limit 1',
    })

    expect(createAppDb).toHaveBeenCalled()
    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error('expected ok')
    expect((result.data as { rows: Array<{ id: string }> }).rows[0]?.id).toBe('session-1')

    const created = await rt.tools.execute('create_session', {
      title: 'B',
      workspacePath: '/tmp/b',
    })
    expect(created.ok).toBe(true)

    const listed = await rt.tools.execute('list_sessions', {})
    expect(listed.ok).toBe(true)
    if (!listed.ok) throw new Error('expected ok')
    expect((listed.data as { sessions: Array<{ id: string }> }).sessions[0]?.id).toBe('session-2')
  })

  it('registers update_plan as a safe runtime tool', async () => {
    const createAppDb = vi.fn().mockResolvedValue({ query: vi.fn().mockResolvedValue([]), run: vi.fn().mockResolvedValue(undefined) })
    const rt = await createRuntime({ createAppDb })

    const tool = rt.tools.get('update_plan')
    expect(tool?.policy?.riskLevel).toBe('safe')

    const result = await rt.tools.execute('update_plan', {
      steps: [{ id: 'verify', title: 'Run tests', status: 'active' }],
    })
    expect(result.ok).toBe(true)
  })

  it('registers tavily_search when Tavily tool config is enabled', async () => {
    const createAppDb = vi.fn().mockResolvedValue({ query: vi.fn().mockResolvedValue([]), run: vi.fn().mockResolvedValue(undefined) })
    const rt = await createRuntime({
      createAppDb,
      toolSettings: {
        tavily: {
          enabled: true,
          apiKey: 'tvly-secret',
        },
      },
    })

    const tool = rt.tools.get('tavily_search')
    expect(tool?.policy?.riskLevel).toBe('safe')
    expect(tool?.inputSchema).toMatchObject({
      type: 'object',
      required: ['query'],
    })
  })

  it('does not expose tavily_search without a Tavily api key', async () => {
    const createAppDb = vi.fn().mockResolvedValue({ query: vi.fn().mockResolvedValue([]), run: vi.fn().mockResolvedValue(undefined) })
    const rt = await createRuntime({
      createAppDb,
      toolSettings: {
        tavily: {
          enabled: true,
          apiKey: null,
        },
      },
    })

    expect(rt.tools.get('tavily_search')).toBeUndefined()
  })
})
