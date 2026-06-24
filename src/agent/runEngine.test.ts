import { describe, expect, it, vi } from 'vitest'
import type { OpenAICompatChatMessage } from '../llm/openaiCompat'
import { createToolRegistry } from '../tools/toolRegistry'
import { runEngine } from './runEngine'

describe('runEngine', () => {
  it('loops tool calls until LLM returns content and records timeline', async () => {
    const pingHandler = vi.fn(async (args: { value: string }) => ({ ok: true as const, data: args.value }))

    const tools = createToolRegistry()
    tools.register({
      name: 'ping',
      description: 'echo input',
      inputSchema: {
        type: 'object',
        properties: { value: { type: 'string' } },
        required: ['value'],
        additionalProperties: false,
      },
      handler: pingHandler,
    })

    const chatCompletion = vi
      .fn()
      .mockResolvedValueOnce({
        kind: 'tool_calls' as const,
        tool_calls: [
          { id: 'call_1', type: 'function' as const, function: { name: 'ping', arguments: '{"value":"pong"}' } },
        ],
      })
      .mockResolvedValueOnce({ kind: 'content' as const, content: 'done' })

    const messages: OpenAICompatChatMessage[] = [{ role: 'user', content: 'hi' }]

    const result = await runEngine({ messages, tools, chatCompletion, maxTurns: 5 })

    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error('expected ok')
    expect(result.content).toBe('done')

    expect(chatCompletion).toHaveBeenCalledTimes(2)
    expect(pingHandler).toHaveBeenCalledWith({ value: 'pong' })

    const firstCallArgs = chatCompletion.mock.calls[0]?.[0] as unknown
    expect(firstCallArgs && typeof firstCallArgs === 'object').toBe(true)
    const firstTools = (firstCallArgs as { tools?: unknown }).tools
    expect(Array.isArray(firstTools)).toBe(true)
    expect((firstTools as Array<{ type: string; function: { name: string } }>)[0]?.function.name).toBe('ping')

    const secondCallArgs = chatCompletion.mock.calls[1]?.[0] as { messages: OpenAICompatChatMessage[] }
    expect(secondCallArgs.messages.some((m) => m.role === 'tool')).toBe(true)

    const timelineTypes = result.timeline.map((e) => e.type)
    expect(timelineTypes).toContain('llm_request')
    expect(timelineTypes).toContain('llm_tool_calls')
    expect(timelineTypes).toContain('tool_execute')
    expect(timelineTypes).toContain('tool_result')
    expect(timelineTypes).toContain('llm_content')
  })

  it('turns invalid JSON tool arguments into a tool error without executing the tool', async () => {
    const pingHandler = vi.fn(async (args: { value: string }) => ({ ok: true as const, data: args.value }))

    const tools = createToolRegistry()
    tools.register({
      name: 'ping',
      description: 'echo input',
      inputSchema: { type: 'object', properties: { value: { type: 'string' } }, required: ['value'] },
      handler: pingHandler,
    })

    const chatCompletion = vi
      .fn()
      .mockResolvedValueOnce({
        kind: 'tool_calls' as const,
        tool_calls: [{ id: 'call_1', type: 'function' as const, function: { name: 'ping', arguments: '{bad' } }],
      })
      .mockResolvedValueOnce({ kind: 'content' as const, content: 'done' })

    const messages: OpenAICompatChatMessage[] = [{ role: 'user', content: 'hi' }]
    const result = await runEngine({ messages, tools, chatCompletion, maxTurns: 5 })

    expect(result.ok).toBe(true)
    expect(pingHandler).not.toHaveBeenCalled()

    if (!result.ok) throw new Error('expected ok')
    const toolMessage = result.messages.find((m) => m.role === 'tool')
    expect(toolMessage && typeof toolMessage.content === 'string').toBe(true)
    const parsed = JSON.parse(String(toolMessage?.content)) as { ok: boolean; error?: { code: string } }
    expect(parsed.ok).toBe(false)
    expect(parsed.error?.code).toBe('INVALID_TOOL_ARGUMENTS')
  })

  it('pauses before executing a tool that requires approval', async () => {
    const mutateHandler = vi.fn(async () => ({ ok: true as const, data: { changed: true } }))

    const tools = createToolRegistry()
    tools.register({
      name: 'write_file',
      description: 'write file',
      inputSchema: {
        type: 'object',
        properties: { path: { type: 'string' }, content: { type: 'string' } },
        required: ['path', 'content'],
        additionalProperties: false,
      },
      policy: { riskLevel: 'ask', pathArgKeys: ['path'] },
      handler: mutateHandler,
    } as any)

    const chatCompletion = vi.fn().mockResolvedValueOnce({
      kind: 'tool_calls' as const,
      tool_calls: [
        {
          id: 'call_approval',
          type: 'function' as const,
          function: { name: 'write_file', arguments: '{"path":"notes.txt","content":"hello"}' },
        },
      ],
    })

    const result = await runEngine({
      messages: [{ role: 'user', content: 'create notes.txt' }],
      tools,
      chatCompletion,
      maxTurns: 5,
    })

    expect(result.ok).toBe(false)
    expect(result.ok === false && result.error.code).toBe('APPROVAL_REQUIRED')
    expect(mutateHandler).not.toHaveBeenCalled()
    expect(result.timeline.some((event) => (event as any).type === 'approval_requested')).toBe(true)
  })

  it('asks user to bind a workspace before executing a tool that requires local files', async () => {
    const listDirHandler = vi.fn(async () => ({ ok: true as const, data: { entries: [] } }))

    const tools = createToolRegistry()
    tools.register({
      name: 'list_dir',
      description: 'list directory',
      inputSchema: {
        type: 'object',
        properties: { path: { type: 'string' } },
        required: ['path'],
        additionalProperties: false,
      },
      policy: { riskLevel: 'safe', requiresWorkspace: true, pathArgKeys: ['path'] },
      handler: listDirHandler,
    } as any)

    const chatCompletion = vi.fn().mockResolvedValueOnce({
      kind: 'tool_calls' as const,
      tool_calls: [
        {
          id: 'call_workspace',
          type: 'function' as const,
          function: { name: 'list_dir', arguments: '{"path":"."}' },
        },
      ],
    })

    const result = await runEngine({
      messages: [{ role: 'user', content: 'show current directory' }],
      tools,
      chatCompletion,
      maxTurns: 5,
    })

    expect(result.ok).toBe(false)
    expect(result.ok === false && result.error.code).toBe('APPROVAL_REQUIRED')
    expect(listDirHandler).not.toHaveBeenCalled()
    expect(result.timeline.some((event) => event.type === 'approval_requested')).toBe(true)
    if (result.ok || !('pendingApproval' in result)) throw new Error('expected approval required')
    expect(result.pendingApproval.reason).toContain('workspace')
    expect(result.pendingApproval.summary).toContain('workspace')
  })

  it('emits a plan_updated event when update_plan succeeds', async () => {
    const tools = createToolRegistry()
    tools.register({
      name: 'update_plan',
      description: 'update plan',
      inputSchema: {
        type: 'object',
        properties: {
          steps: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                title: { type: 'string' },
                status: { type: 'string' },
              },
              required: ['id', 'title', 'status'],
            },
          },
        },
        required: ['steps'],
      },
      policy: { riskLevel: 'safe' },
      handler: vi.fn(async (args) => ({ ok: true as const, data: args })),
    })

    const chatCompletion = vi
      .fn()
      .mockResolvedValueOnce({
        kind: 'tool_calls' as const,
        tool_calls: [
          {
            id: 'call_plan',
            type: 'function' as const,
            function: {
              name: 'update_plan',
              arguments: '{"steps":[{"id":"context","title":"Read files","status":"completed"}]}',
            },
          },
        ],
      })
      .mockResolvedValueOnce({ kind: 'content' as const, content: 'done' })

    const result = await runEngine({
      messages: [{ role: 'user', content: 'make a plan' }],
      tools,
      chatCompletion,
      maxTurns: 5,
    })

    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error('expected ok')
    expect(result.timeline).toContainEqual({
      type: 'plan_updated',
      steps: [{ id: 'context', title: 'Read files', status: 'completed' }],
    })
  })
})
