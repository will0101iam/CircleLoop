import type {
  OpenAICompatChatCompletionResult,
  OpenAICompatChatMessage,
  OpenAICompatTool,
  OpenAICompatToolCall,
} from '../llm/openaiCompat'
import { buildOpenAICompatTools } from '../llm/openaiTools'
import type { ToolDefinition, ToolResult } from '../tools/toolRegistry'
import { getApprovalDecision } from './approvalPolicy'

export type EngineTimelineEvent =
  | { type: 'llm_request'; messages: OpenAICompatChatMessage[]; tools?: OpenAICompatTool[] }
  | { type: 'llm_tool_calls'; tool_calls: OpenAICompatToolCall[] }
  | { type: 'tool_execute'; tool_call: OpenAICompatToolCall; args: unknown }
  | { type: 'tool_result'; tool_call_id: string; name: string; result: ToolResult }
  | { type: 'tool_denied'; tool_call_id: string; name: string; result: ToolResult }
  | { type: 'approval_requested'; tool_call: OpenAICompatToolCall; args: unknown; summary: string; reason: string }
  | { type: 'approval_resolved'; tool_call_id: string; approved: boolean }
  | { type: 'llm_content'; content: string }

export type ToolRegistryLike = {
  execute: (name: string, args: unknown) => Promise<ToolResult>
  get?: (name: string) => ToolDefinition<unknown, unknown> | undefined
  list: () => Array<Pick<ToolDefinition, 'name' | 'description' | 'inputSchema' | 'policy'>>
}

export type RunEngineResult =
  | { ok: true; content: string; messages: OpenAICompatChatMessage[]; timeline: EngineTimelineEvent[] }
  | {
      ok: false
      error: { code: 'MAX_TURNS_EXCEEDED'; message: string }
      messages: OpenAICompatChatMessage[]
      timeline: EngineTimelineEvent[]
    }
  | {
      ok: false
      error: { code: 'APPROVAL_REQUIRED'; message: string }
      messages: OpenAICompatChatMessage[]
      timeline: EngineTimelineEvent[]
      pendingApproval: PendingApprovalState
    }

export type PendingApprovalState = {
  turn: number
  maxTurns: number
  messages: OpenAICompatChatMessage[]
  toolCalls: OpenAICompatToolCall[]
  nextToolCallIndex: number
  toolCall: OpenAICompatToolCall
  args: unknown
  summary: string
  reason: string
}

type ContinueToolCallsResult =
  | { kind: 'continued'; messages: OpenAICompatChatMessage[] }
  | Extract<RunEngineResult, { ok: false; error: { code: 'APPROVAL_REQUIRED' } }>

function safeJsonParse(input: string): ToolResult<unknown> {
  try {
    return { ok: true as const, data: JSON.parse(input) as unknown }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Invalid JSON'
    return { ok: false as const, error: { code: 'INVALID_TOOL_ARGUMENTS', message } }
  }
}

async function continueFromToolCalls(input: {
  turn: number
  maxTurns: number
  messages: OpenAICompatChatMessage[]
  toolCalls: OpenAICompatToolCall[]
  nextToolCallIndex: number
  tools: ToolRegistryLike
  timeline: EngineTimelineEvent[]
  pushEvent: (event: EngineTimelineEvent) => void
  workspacePath?: string
}): Promise<ContinueToolCallsResult> {
  const messages = [...input.messages]

  for (let index = input.nextToolCallIndex; index < input.toolCalls.length; index += 1) {
    const toolCall = input.toolCalls[index]
    const parsed = safeJsonParse(toolCall.function.arguments)
    if (!parsed.ok) {
      const toolMessage = {
        role: 'tool' as const,
        tool_call_id: toolCall.id,
        content: JSON.stringify(parsed),
      }
      input.pushEvent({ type: 'tool_execute', tool_call: toolCall, args: toolCall.function.arguments })
      input.pushEvent({
        type: 'tool_result',
        tool_call_id: toolCall.id,
        name: toolCall.function.name,
        result: parsed,
      })
      messages.push(toolMessage)
      continue
    }

    input.pushEvent({ type: 'tool_execute', tool_call: toolCall, args: parsed.data })
    const toolDefinition = input.tools.get?.(toolCall.function.name)
    const decision = getApprovalDecision({
      tool: toolDefinition,
      args: parsed.data,
      workspacePath: input.workspacePath,
    })

    if (decision.decision === 'deny') {
      const deniedResult: ToolResult = { ok: false, error: { code: decision.code, message: decision.message } }
      input.pushEvent({
        type: 'tool_denied',
        tool_call_id: toolCall.id,
        name: toolCall.function.name,
        result: deniedResult,
      })
      input.pushEvent({
        type: 'tool_result',
        tool_call_id: toolCall.id,
        name: toolCall.function.name,
        result: deniedResult,
      })
      messages.push({
        role: 'tool',
        tool_call_id: toolCall.id,
        content: JSON.stringify(deniedResult),
      })
      continue
    }

    if (decision.decision === 'ask') {
      input.pushEvent({
        type: 'approval_requested',
        tool_call: toolCall,
        args: parsed.data,
        summary: decision.summary,
        reason: decision.reason,
      })
      return {
        ok: false,
        error: { code: 'APPROVAL_REQUIRED', message: decision.reason },
        messages,
        timeline: input.timeline,
        pendingApproval: {
          turn: input.turn,
          maxTurns: input.maxTurns,
          messages,
          toolCalls: input.toolCalls,
          nextToolCallIndex: index,
          toolCall,
          args: parsed.data,
          summary: decision.summary,
          reason: decision.reason,
        },
      }
    }

    const execResult = await input.tools.execute(toolCall.function.name, parsed.data)
    input.pushEvent({
      type: 'tool_result',
      tool_call_id: toolCall.id,
      name: toolCall.function.name,
      result: execResult,
    })
    messages.push({
      role: 'tool',
      tool_call_id: toolCall.id,
      content: JSON.stringify(execResult),
    })
  }

  return { kind: 'continued', messages }
}

async function runEngineLoop(input: {
  messages: OpenAICompatChatMessage[]
  tools: ToolRegistryLike
  chatCompletion: (args: {
    messages: OpenAICompatChatMessage[]
    tools?: OpenAICompatTool[]
  }) => Promise<OpenAICompatChatCompletionResult>
  chatCompletionStream?: (args: {
    messages: OpenAICompatChatMessage[]
    tools?: OpenAICompatTool[]
    onContentDelta?: (delta: string) => void
  }) => Promise<OpenAICompatChatCompletionResult>
  onContentDelta?: (delta: string) => void
  onTimelineEvent?: (event: EngineTimelineEvent) => void
  maxTurns?: number
  workspacePath?: string
  startTurn?: number
  initialTimeline?: EngineTimelineEvent[]
}): Promise<RunEngineResult> {
  const timeline: EngineTimelineEvent[] = [...(input.initialTimeline ?? [])]
  const pushEvent = (event: EngineTimelineEvent) => {
    timeline.push(event)
    input.onTimelineEvent?.(event)
  }
  const messages = [...input.messages]
  const maxTurns = input.maxTurns ?? 10

  const openAiTools = buildOpenAICompatTools(input.tools.list())
  const toolsParam = openAiTools.length > 0 ? openAiTools : undefined

  for (let turn = input.startTurn ?? 0; turn < maxTurns; turn += 1) {
    pushEvent({ type: 'llm_request', messages: [...messages], tools: toolsParam })
    const result = input.chatCompletionStream
      ? await input.chatCompletionStream({ messages, tools: toolsParam, onContentDelta: input.onContentDelta })
      : await input.chatCompletion({ messages, tools: toolsParam })

    if (result.kind === 'content') {
      messages.push({ role: 'assistant', content: result.content })
      pushEvent({ type: 'llm_content', content: result.content })
      return { ok: true, content: result.content, messages, timeline }
    }

    pushEvent({ type: 'llm_tool_calls', tool_calls: result.tool_calls })
    messages.push({ role: 'assistant', content: null, tool_calls: result.tool_calls })

    const toolRun = await continueFromToolCalls({
      turn,
      maxTurns,
      messages,
      toolCalls: result.tool_calls,
      nextToolCallIndex: 0,
      tools: input.tools,
      timeline,
      pushEvent,
      workspacePath: input.workspacePath,
    })
    if (!('kind' in toolRun)) return toolRun
    messages.splice(0, messages.length, ...toolRun.messages)
  }

  return {
    ok: false,
    error: { code: 'MAX_TURNS_EXCEEDED', message: `Max turns exceeded: ${maxTurns}` },
    messages,
    timeline,
  }
}

export async function runEngine(input: {
  messages: OpenAICompatChatMessage[]
  tools: ToolRegistryLike
  chatCompletion: (args: {
    messages: OpenAICompatChatMessage[]
    tools?: OpenAICompatTool[]
  }) => Promise<OpenAICompatChatCompletionResult>
  chatCompletionStream?: (args: {
    messages: OpenAICompatChatMessage[]
    tools?: OpenAICompatTool[]
    onContentDelta?: (delta: string) => void
  }) => Promise<OpenAICompatChatCompletionResult>
  onContentDelta?: (delta: string) => void
  onTimelineEvent?: (event: EngineTimelineEvent) => void
  maxTurns?: number
  workspacePath?: string
}): Promise<RunEngineResult> {
  return runEngineLoop(input)
}

export async function resumeRunEngineWithApproval(input: {
  pendingApproval: PendingApprovalState
  approved: boolean
  tools: ToolRegistryLike
  chatCompletion: (args: {
    messages: OpenAICompatChatMessage[]
    tools?: OpenAICompatTool[]
  }) => Promise<OpenAICompatChatCompletionResult>
  chatCompletionStream?: (args: {
    messages: OpenAICompatChatMessage[]
    tools?: OpenAICompatTool[]
    onContentDelta?: (delta: string) => void
  }) => Promise<OpenAICompatChatCompletionResult>
  onContentDelta?: (delta: string) => void
  onTimelineEvent?: (event: EngineTimelineEvent) => void
  workspacePath?: string
}): Promise<RunEngineResult> {
  const timeline: EngineTimelineEvent[] = []
  const pushEvent = (event: EngineTimelineEvent) => {
    timeline.push(event)
    input.onTimelineEvent?.(event)
  }
  const messages = [...input.pendingApproval.messages]
  pushEvent({
    type: 'approval_resolved',
    tool_call_id: input.pendingApproval.toolCall.id,
    approved: input.approved,
  })

  const toolResult: ToolResult = input.approved
    ? await input.tools.execute(input.pendingApproval.toolCall.function.name, input.pendingApproval.args)
    : { ok: false, error: { code: 'USER_DECLINED', message: 'User declined this action' } }

  pushEvent({
    type: 'tool_result',
    tool_call_id: input.pendingApproval.toolCall.id,
    name: input.pendingApproval.toolCall.function.name,
    result: toolResult,
  })
  messages.push({
    role: 'tool',
    tool_call_id: input.pendingApproval.toolCall.id,
    content: JSON.stringify(toolResult),
  })

  const continuedTools = await continueFromToolCalls({
    turn: input.pendingApproval.turn,
    maxTurns: input.pendingApproval.maxTurns,
    messages,
    toolCalls: input.pendingApproval.toolCalls,
    nextToolCallIndex: input.pendingApproval.nextToolCallIndex + 1,
    tools: input.tools,
    timeline,
    pushEvent,
    workspacePath: input.workspacePath,
  })
  if (!('kind' in continuedTools)) {
    return continuedTools
  }

  return runEngineLoop({
    messages: continuedTools.messages,
    tools: input.tools,
    chatCompletion: input.chatCompletion,
    chatCompletionStream: input.chatCompletionStream,
    onContentDelta: input.onContentDelta,
    onTimelineEvent: input.onTimelineEvent,
    maxTurns: input.pendingApproval.maxTurns,
    workspacePath: input.workspacePath,
    startTurn: input.pendingApproval.turn + 1,
    initialTimeline: timeline,
  })
}
