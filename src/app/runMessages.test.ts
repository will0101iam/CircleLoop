import { describe, expect, it } from 'vitest'
import {
  appendRunMessages,
  appendRunAnswerMarker,
  appendRunAnswerText,
  appendRunEvent,
  completeRunMessage,
  createAssistantMessage,
  createPendingRunMessage,
  createUserMessage,
  type RunEvent,
} from './runMessages'

describe('runMessages', () => {
  it('appends user message followed by pending run message', () => {
    const messages = appendRunMessages([], createUserMessage('u1', 'hello', '10:00'), createPendingRunMessage('r1', '10:00'))

    expect(messages).toHaveLength(2)
    expect(messages[0]).toMatchObject({ kind: 'user', text: 'hello' })
    expect(messages[1]).toMatchObject({ kind: 'run', status: 'pending' })
  })

  it('completes the matching run message inline', () => {
    const initial = appendRunMessages([], createUserMessage('u1', 'task', '10:00'), createPendingRunMessage('r1', '10:00'))
    const events: RunEvent[] = [{ id: 'e1', kind: 'tool_execute', phase: 'thinking', name: 'list_dir', args: { path: '.' } }]

    const updated = completeRunMessage(initial, 'r1', {
      status: 'completed',
      thinkText: 'plan',
      events,
      finalText: 'done',
    })

    expect(updated[1]).toMatchObject({
      kind: 'run',
      status: 'completed',
      thinkText: 'plan',
      finalText: 'done',
    })
    expect((updated[1] as Extract<(typeof updated)[number], { kind: 'run' }>).events).toEqual(events)
  })

  it('keeps assistant text messages separate from run messages', () => {
    const messages = [
      createUserMessage('u1', 'hello', '10:00'),
      createAssistantMessage('a1', 'plain reply', '10:01'),
      createPendingRunMessage('r1', '10:02'),
    ]

    expect(messages.map((m) => m.kind)).toEqual(['user', 'assistant', 'run'])
  })

  it('creates deep research pending runs with the correct mode', () => {
    const run = createPendingRunMessage('r1', '10:00', 'deep_research')

    expect(run.mode).toBe('deep_research')
    expect(run.events).toEqual([])
  })

  it('appends phase-aware events to the matching run message', () => {
    const initial = appendRunMessages([], createUserMessage('u1', 'task', '10:00'), createPendingRunMessage('r1', '10:00'))

    const updated = appendRunEvent(initial, 'r1', {
      id: 'e1',
      kind: 'tool_result',
      phase: 'answer',
      name: 'search_code',
      ok: true,
      payload: { files: 2 },
      anchor: 'answer',
    })

    expect((updated[1] as Extract<(typeof updated)[number], { kind: 'run' }>).events).toEqual([
      expect.objectContaining({ kind: 'tool_result', phase: 'answer', anchor: 'answer' }),
    ])
  })

  it('builds answer segments in the exact order of text and tool markers', () => {
    const initial = appendRunMessages([], createUserMessage('u1', 'task', '10:00'), createPendingRunMessage('r1', '10:00'))

    const withText = appendRunAnswerText(initial, 'r1', '先解释第一步。')
    const withTool = appendRunAnswerMarker(withText, 'r1', {
      id: 'seg-tool-1',
      kind: 'tool',
      eventId: 'e1',
    })
    const withMoreText = appendRunAnswerText(withTool, 'r1', '然后继续解释第二步。')

    expect((withMoreText[1] as Extract<(typeof withMoreText)[number], { kind: 'run' }>).answerSegments).toEqual([
      { id: 'r1:text:1', kind: 'text', text: '先解释第一步。' },
      { id: 'seg-tool-1', kind: 'tool', eventId: 'e1' },
      { id: 'r1:text:3', kind: 'text', text: '然后继续解释第二步。' },
    ])
  })

  it('trims leading blank lines from the first answer text segment', () => {
    const initial = appendRunMessages([], createUserMessage('u1', 'task', '10:00'), createPendingRunMessage('r1', '10:00'))
    const updated = appendRunAnswerText(initial, 'r1', '\n\n\n抱歉，document.md 实际上没有创建成功。')

    expect((updated[1] as Extract<(typeof updated)[number], { kind: 'run' }>).answerSegments).toEqual([
      { id: 'r1:text:1', kind: 'text', text: '抱歉，document.md 实际上没有创建成功。' },
    ])
  })
})
