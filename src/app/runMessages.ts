export type RunMode = 'normal' | 'deep_research'
export type RunPhase = 'thinking' | 'answer'
export type RunAnchor = 'thinking' | 'answer'
export type PlanStepStatus = 'pending' | 'active' | 'completed' | 'failed'
export type PlanStep = {
  id: string
  title: string
  status: PlanStepStatus
  summary?: string
}

export type RunEvent =
  | { id: string; kind: 'reasoning'; phase: 'thinking'; text: string }
  | { id: string; kind: 'phase_change'; phase: RunPhase; label?: string }
  | { id: string; kind: 'status_note'; phase: RunPhase; text: string }
  | { id: string; kind: 'tool_execute'; phase: RunPhase; name: string; args: unknown; anchor?: RunAnchor; groupId?: string }
  | { id: string; kind: 'tool_result'; phase: RunPhase; name: string; ok: boolean; payload: unknown; anchor?: RunAnchor; groupId?: string }
  | { id: string; kind: 'approval_requested'; phase: RunPhase; name: string; summary: string; reason: string; anchor?: RunAnchor; groupId?: string }
  | { id: string; kind: 'approval_resolved'; phase: RunPhase; name: string; approved: boolean; anchor?: RunAnchor; groupId?: string }
  | { id: string; kind: 'plan_created'; phase: 'thinking'; steps: PlanStep[] }
  | { id: string; kind: 'plan_step_started'; phase: 'thinking'; stepId: string; summary?: string }
  | { id: string; kind: 'plan_step_completed'; phase: 'thinking'; stepId: string; summary?: string }
  | { id: string; kind: 'plan_step_failed'; phase: 'thinking'; stepId: string; summary?: string }
  | { id: string; kind: 'plan_updated'; phase: 'thinking'; steps: PlanStep[] }

export type AnswerSegment =
  | { id: string; kind: 'text'; text: string }
  | { id: string; kind: 'tool'; eventId: string }
  | { id: string; kind: 'approval'; eventId: string }

export type UserThreadMessage = {
  id: string
  kind: 'user'
  text: string
  time: string
}

export type AssistantThreadMessage = {
  id: string
  kind: 'assistant'
  text: string
  time: string
}

export type RunThreadMessage = {
  id: string
  kind: 'run'
  time: string
  mode: RunMode
  llmProvider?: string | null
  llmModel?: string | null
  status: 'pending' | 'waiting_approval' | 'completed' | 'error'
  thinkText: string | null
  events: RunEvent[]
  finalText: string | null
  answerSegments: AnswerSegment[]
}

export type ThreadMessage = UserThreadMessage | AssistantThreadMessage | RunThreadMessage

export function createUserMessage(id: string, text: string, time: string): UserThreadMessage {
  return { id, kind: 'user', text, time }
}

export function createAssistantMessage(id: string, text: string, time: string): AssistantThreadMessage {
  return { id, kind: 'assistant', text, time }
}

export function createPendingRunMessage(
  id: string,
  time: string,
  mode: RunMode = 'normal',
  llm?: { provider?: string | null; model?: string | null },
): RunThreadMessage {
  return {
    id,
    kind: 'run',
    time,
    mode,
    llmProvider: llm?.provider ?? null,
    llmModel: llm?.model ?? null,
    status: 'pending',
    thinkText: null,
    events: [],
    finalText: null,
    answerSegments: [],
  }
}

export function createDefaultTaskPlanEvents(runId: string): RunEvent[] {
  const steps: PlanStep[] = [
    { id: 'understand', title: '理解需求', status: 'active' },
    { id: 'context', title: '收集上下文', status: 'pending' },
    { id: 'execute', title: '执行任务', status: 'pending' },
    { id: 'verify', title: '验证并总结', status: 'pending' },
  ]

  return [
    { id: `${runId}:plan:created`, kind: 'plan_created', phase: 'thinking', steps },
    { id: `${runId}:plan:step:understand:start`, kind: 'plan_step_started', phase: 'thinking', stepId: 'understand' },
    {
      id: `${runId}:plan:step:understand:complete`,
      kind: 'plan_step_completed',
      phase: 'thinking',
      stepId: 'understand',
      summary: '已记录用户请求',
    },
    { id: `${runId}:plan:step:context:start`, kind: 'plan_step_started', phase: 'thinking', stepId: 'context' },
  ]
}

export function createRunEventFromEngineTimeline(args: {
  runId: string
  idPrefix?: string
  sequence: number
  event: { type: 'plan_updated'; steps: PlanStep[] }
}): RunEvent {
  const idPrefix = args.idPrefix ?? args.runId
  return {
    id: `${idPrefix}:plan-updated:${args.sequence}`,
    kind: 'plan_updated',
    phase: 'thinking',
    steps: args.event.steps,
  }
}

export function appendRunMessages(
  messages: ThreadMessage[],
  userMessage: UserThreadMessage,
  runMessage: RunThreadMessage,
): ThreadMessage[] {
  return [...messages, userMessage, runMessage]
}

export function completeRunMessage(
  messages: ThreadMessage[],
  runId: string,
  patch: Partial<Pick<RunThreadMessage, 'status' | 'thinkText' | 'events' | 'finalText' | 'mode' | 'answerSegments'>>,
): ThreadMessage[] {
  return messages.map((m) => {
    if (m.kind !== 'run' || m.id !== runId) return m
    return { ...m, ...patch }
  })
}

export function appendRunEvent(messages: ThreadMessage[], runId: string, event: RunEvent): ThreadMessage[] {
  return messages.map((m) => {
    if (m.kind !== 'run' || m.id !== runId) return m
    return { ...m, events: [...m.events, event] }
  })
}

export function appendRunAnswerText(messages: ThreadMessage[], runId: string, text: string): ThreadMessage[] {
  if (!text) return messages
  return messages.map((m) => {
    if (m.kind !== 'run' || m.id !== runId) return m
    const segments = [...m.answerSegments]
    const normalizedText =
      segments.length === 0
        ? text.replace(/^\s*\n+/, '').replace(/^\s+/, '')
        : text
    const last = segments[segments.length - 1]
    if (last?.kind === 'text') {
      segments[segments.length - 1] = { ...last, text: `${last.text}${normalizedText}` }
    } else {
      if (!normalizedText) return m
      segments.push({ id: `${runId}:text:${segments.length + 1}`, kind: 'text', text: normalizedText })
    }
    return { ...m, answerSegments: segments }
  })
}

export function appendRunAnswerMarker(
  messages: ThreadMessage[],
  runId: string,
  marker: Extract<AnswerSegment, { kind: 'tool' | 'approval' }>,
): ThreadMessage[] {
  return messages.map((m) => {
    if (m.kind !== 'run' || m.id !== runId) return m
    if (m.answerSegments.some((segment) => segment.kind === marker.kind && segment.eventId === marker.eventId)) return m
    return { ...m, answerSegments: [...m.answerSegments, marker] }
  })
}
