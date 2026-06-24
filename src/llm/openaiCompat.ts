export type OpenAICompatChatMessage =
  | { role: 'system'; content: string }
  | { role: 'user'; content: string }
  | { role: 'assistant'; content?: string | null; tool_calls?: OpenAICompatToolCall[] }
  | { role: 'tool'; content: string; tool_call_id: string }

export type OpenAICompatTool = {
  type: 'function'
  function: {
    name: string
    description?: string
    parameters?: unknown
  }
}

export type OpenAICompatToolCall = {
  id: string
  type: 'function'
  function: { name: string; arguments: string }
}

export type OpenAICompatChatCompletionResult =
  | { kind: 'tool_calls'; tool_calls: OpenAICompatToolCall[] }
  | { kind: 'content'; content: string }

function toReadableNetworkError(error: unknown): Error {
  if (error instanceof DOMException && error.name === 'AbortError') return error
  const message = error instanceof Error ? error.message : String(error)
  return new Error(`OpenAICompat network failed: ${message}`)
}

async function safeFetch(input: RequestInfo | URL, init: RequestInit, fetchImpl: typeof fetch) {
  try {
    return await fetchImpl(input, init)
  } catch (error) {
    throw toReadableNetworkError(error)
  }
}

export async function createChatCompletionOpenAICompat(input: {
  baseUrl: string
  apiKey?: string | null
  messages: OpenAICompatChatMessage[]
  model?: string
  tools?: OpenAICompatTool[]
  tool_choice?: 'auto' | 'none' | { type: 'function'; function: { name: string } }
  temperature?: number
  signal?: AbortSignal
  fetch?: typeof fetch
}): Promise<OpenAICompatChatCompletionResult> {
  const fetchImpl = input.fetch ?? fetch
  const baseUrl = input.baseUrl.replace(/\/+$/, '')
  const url = `${baseUrl}/chat/completions`

  const body: Record<string, unknown> = {
    model: input.model ?? 'MiniMax-M2.7',
    messages: input.messages,
  }
  if (input.tools) body.tools = input.tools
  if (input.tool_choice) body.tool_choice = input.tool_choice
  if (typeof input.temperature === 'number') body.temperature = input.temperature

  const response = await safeFetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(input.apiKey ? { Authorization: `Bearer ${input.apiKey}` } : {}),
    },
    body: JSON.stringify(body),
    signal: input.signal,
  }, fetchImpl)

  if (!response.ok) {
    let responseText = ''
    try {
      responseText = await response.text()
    } catch {
      responseText = ''
    }
    const statusText = response.statusText ? ` ${response.statusText}` : ''
    const suffix = responseText ? ` - ${responseText.slice(0, 200)}` : ''
    throw new Error(`OpenAICompat request failed: ${response.status}${statusText}${suffix}`)
  }

  const json = (await response.json()) as unknown
  if (!json || typeof json !== 'object') {
    throw new Error('OpenAICompat invalid JSON response')
  }

  const choices = (json as Record<string, unknown>)['choices']
  if (!Array.isArray(choices) || !choices[0] || typeof choices[0] !== 'object') {
    throw new Error('OpenAICompat response missing choices[0]')
  }

  const message = (choices[0] as Record<string, unknown>)['message']
  if (!message || typeof message !== 'object') {
    throw new Error('OpenAICompat response missing choices[0].message')
  }

  const toolCallsRaw = (message as Record<string, unknown>)['tool_calls']
  if (Array.isArray(toolCallsRaw) && toolCallsRaw.length > 0) {
    const tool_calls = toolCallsRaw.filter((x): x is OpenAICompatToolCall => {
      if (!x || typeof x !== 'object') return false
      const obj = x as Record<string, unknown>
      if (typeof obj.id !== 'string') return false
      if (obj.type !== 'function') return false
      const fn = obj.function
      if (!fn || typeof fn !== 'object') return false
      const fnObj = fn as Record<string, unknown>
      return typeof fnObj.name === 'string' && typeof fnObj.arguments === 'string'
    })

    if (tool_calls.length > 0) return { kind: 'tool_calls', tool_calls }
  }

  const content = (message as Record<string, unknown>)['content']
  if (typeof content === 'string' && content.length > 0) {
    return { kind: 'content', content }
  }

  throw new Error('OpenAICompat response missing tool_calls and content')
}

export async function createChatCompletionStreamOpenAICompat(input: {
  baseUrl: string
  apiKey?: string | null
  messages: OpenAICompatChatMessage[]
  model?: string
  tools?: OpenAICompatTool[]
  tool_choice?: 'auto' | 'none' | { type: 'function'; function: { name: string } }
  temperature?: number
  signal?: AbortSignal
  fetch?: typeof fetch
  onContentDelta?: (delta: string) => void
}): Promise<OpenAICompatChatCompletionResult> {
  const fetchImpl = input.fetch ?? fetch
  const baseUrl = input.baseUrl.replace(/\/+$/, '')
  const url = `${baseUrl}/chat/completions`
  const body: Record<string, unknown> = {
    model: input.model ?? 'MiniMax-M2.7',
    messages: input.messages,
    stream: true,
  }
  if (input.tools) body.tools = input.tools
  if (input.tool_choice) body.tool_choice = input.tool_choice
  if (typeof input.temperature === 'number') body.temperature = input.temperature

  const response = await safeFetch(
    url,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(input.apiKey ? { Authorization: `Bearer ${input.apiKey}` } : {}),
      },
      body: JSON.stringify(body),
      signal: input.signal,
    },
    fetchImpl,
  )

  if (!response.ok) {
    let responseText = ''
    try {
      responseText = await response.text()
    } catch {
      responseText = ''
    }
    const statusText = response.statusText ? ` ${response.statusText}` : ''
    const suffix = responseText ? ` - ${responseText.slice(0, 200)}` : ''
    throw new Error(`OpenAICompat request failed: ${response.status}${statusText}${suffix}`)
  }

  if (!response.body) {
    throw new Error('OpenAICompat streaming response missing body')
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let content = ''
  const toolCalls = new Map<number, OpenAICompatToolCall>()

  const processDataLine = (data: string) => {
    if (!data || data === '[DONE]') return
    const parsed = JSON.parse(data) as {
      choices?: Array<{
        delta?: {
          content?: string | null
          tool_calls?: Array<{
            index?: number
            id?: string
            type?: 'function'
            function?: { name?: string; arguments?: string }
          }>
        }
      }>
    }
    const choice = parsed.choices?.[0]
    const delta = choice?.delta
    if (!delta) return

    if (typeof delta.content === 'string' && delta.content.length > 0) {
      content += delta.content
      input.onContentDelta?.(delta.content)
    }

    if (Array.isArray(delta.tool_calls)) {
      for (const chunk of delta.tool_calls) {
        const index = typeof chunk.index === 'number' ? chunk.index : 0
        const current = toolCalls.get(index) ?? {
          id: '',
          type: 'function' as const,
          function: { name: '', arguments: '' },
        }
        toolCalls.set(index, {
          id: chunk.id ?? current.id,
          type: 'function',
          function: {
            name: chunk.function?.name ?? current.function.name,
            arguments: `${current.function.arguments}${chunk.function?.arguments ?? ''}`,
          },
        })
      }
    }
  }

  while (true) {
    const { done, value } = await reader.read()
    buffer += decoder.decode(value ?? new Uint8Array(), { stream: !done })

    let separatorIndex = buffer.indexOf('\n\n')
    while (separatorIndex !== -1) {
      const event = buffer.slice(0, separatorIndex)
      buffer = buffer.slice(separatorIndex + 2)

      const data = event
        .split(/\r?\n/)
        .filter((line) => line.startsWith('data:'))
        .map((line) => line.slice(5).trimStart())
        .join('\n')

      processDataLine(data)
      separatorIndex = buffer.indexOf('\n\n')
    }

    if (done) break
  }

  if (toolCalls.size > 0) {
    return {
      kind: 'tool_calls',
      tool_calls: [...toolCalls.entries()]
        .sort((a, b) => a[0] - b[0])
        .map(([, value]) => value),
    }
  }

  if (content.length > 0) return { kind: 'content', content }
  throw new Error('OpenAICompat streaming response missing tool_calls and content')
}
