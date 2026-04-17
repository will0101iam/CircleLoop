import { describe, expect, it } from 'vitest'
import { createToolRegistry } from './toolRegistry'

describe('tool registry', () => {
  it('registers and executes a tool by name', async () => {
    const registry = createToolRegistry()
    registry.register({
      name: 'ping',
      handler: async (args: { value: string }) => ({ ok: true as const, data: args.value }),
    })

    const result = await registry.execute('ping', { value: 'pong' })
    expect(result.ok).toBe(true)
    expect(result.ok && result.data).toBe('pong')
  })

  it('returns an error when tool does not exist', async () => {
    const registry = createToolRegistry()
    const result = await registry.execute('missing', {})
    expect(result.ok).toBe(false)
    expect(result.ok === false && result.error.code).toBe('TOOL_NOT_FOUND')
  })
})

