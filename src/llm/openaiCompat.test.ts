import { describe, expect, it, vi } from 'vitest'
import { createChatCompletionOpenAICompat, createChatCompletionStreamOpenAICompat } from './openaiCompat'

describe('openai compat', () => {
  it('posts to /chat/completions with bearer apiKey and returns content', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => ({
        choices: [{ message: { role: 'assistant', content: 'hello' } }],
      }),
    })

    const result = await createChatCompletionOpenAICompat({
      baseUrl: 'https://api.minimaxi.com/v1/',
      apiKey: 'k',
      messages: [{ role: 'user', content: 'hi' }],
      fetch: fetchMock,
    })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('https://api.minimaxi.com/v1/chat/completions')
    expect(init.method).toBe('POST')
    expect((init.headers as Record<string, string>)['Authorization']).toBe('Bearer k')

    const body = JSON.parse(String(init.body)) as Record<string, unknown>
    expect(body.model).toBe('MiniMax-M2.7')
    expect(body.messages).toEqual([{ role: 'user', content: 'hi' }])

    expect(result).toEqual({ kind: 'content', content: 'hello' })
  })

  it('returns tool_calls when present', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => ({
        choices: [
          {
            message: {
              role: 'assistant',
              tool_calls: [
                {
                  id: 'call_1',
                  type: 'function',
                  function: { name: 'list_dir', arguments: '{"path":"."}' },
                },
              ],
            },
          },
        ],
      }),
    })

    const result = await createChatCompletionOpenAICompat({
      baseUrl: 'https://api.minimaxi.com/v1',
      apiKey: 'k',
      messages: [{ role: 'user', content: 'hi' }],
      fetch: fetchMock,
    })

    expect(result.kind).toBe('tool_calls')
    if (result.kind !== 'tool_calls') throw new Error('expected tool_calls')
    expect(result.tool_calls[0]?.function.name).toBe('list_dir')
    expect(result.tool_calls[0]?.function.arguments).toBe('{"path":"."}')
  })

  it('maps low-level fetch failures to a readable network error', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new TypeError('Load failed'))

    await expect(
      createChatCompletionOpenAICompat({
        baseUrl: 'https://api.minimaxi.com/v1',
        apiKey: 'k',
        messages: [{ role: 'user', content: 'hi' }],
        fetch: fetchMock,
      }),
    ).rejects.toThrow('OpenAICompat network failed: Load failed')
  })

  it('passes abort signal to fetch', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => ({
        choices: [{ message: { role: 'assistant', content: 'hello' } }],
      }),
    })
    const controller = new AbortController()

    await createChatCompletionOpenAICompat({
      baseUrl: 'https://api.minimaxi.com/v1',
      apiKey: 'k',
      messages: [{ role: 'user', content: 'hi' }],
      signal: controller.signal,
      fetch: fetchMock,
    })

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(init.signal).toBe(controller.signal)
  })

  it('streams content deltas and returns final content', async () => {
    const encoder = new TextEncoder()
    const body = new ReadableStream({
      start(controller) {
        controller.enqueue(
          encoder.encode(
            [
              'data: {"choices":[{"delta":{"content":"<think>plan"},"index":0}]}',
              '',
              'data: {"choices":[{"delta":{"content":"</think>done"},"index":0}]}',
              '',
              'data: [DONE]',
              '',
            ].join('\n'),
          ),
        )
        controller.close()
      },
    })

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      body,
    })

    const deltas: string[] = []
    const result = await createChatCompletionStreamOpenAICompat({
      baseUrl: 'https://api.minimaxi.com/v1',
      apiKey: 'k',
      messages: [{ role: 'user', content: 'hi' }],
      fetch: fetchMock,
      onContentDelta: (delta) => deltas.push(delta),
    })

    expect(result).toEqual({ kind: 'content', content: '<think>plan</think>done' })
    expect(deltas).toEqual(['<think>plan', '</think>done'])
  })

  it('streams tool calls and assembles arguments', async () => {
    const encoder = new TextEncoder()
    const body = new ReadableStream({
      start(controller) {
        controller.enqueue(
          encoder.encode(
            [
              'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"id":"call_1","type":"function","function":{"name":"list_dir","arguments":"{\\"path\\":\\"" }}]},"index":0}]}',
              '',
              'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"function":{"arguments":"./src\\"}"}}],"content":null},"index":0}]}',
              '',
              'data: [DONE]',
              '',
            ].join('\n'),
          ),
        )
        controller.close()
      },
    })

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      body,
    })

    const result = await createChatCompletionStreamOpenAICompat({
      baseUrl: 'https://api.minimaxi.com/v1',
      apiKey: 'k',
      messages: [{ role: 'user', content: 'hi' }],
      fetch: fetchMock,
    })

    expect(result.kind).toBe('tool_calls')
    if (result.kind !== 'tool_calls') throw new Error('expected tool_calls')
    expect(result.tool_calls).toEqual([
      {
        id: 'call_1',
        type: 'function',
        function: { name: 'list_dir', arguments: '{"path":"./src"}' },
      },
    ])
  })
})
