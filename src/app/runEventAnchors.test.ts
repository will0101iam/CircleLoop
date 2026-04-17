import { describe, expect, it } from 'vitest'
import { filterRunEventsByLocation, getApprovalEventsByLocation } from './runEventAnchors'
import type { RunEvent } from './runMessages'

describe('runEventAnchors', () => {
  it('keeps thinking and answer events strictly separated', () => {
    const events: RunEvent[] = [
      {
        id: 't1',
        kind: 'tool_result',
        phase: 'thinking',
        name: 'delete_file',
        ok: true,
        payload: { ok: true },
        anchor: 'thinking',
        groupId: 'g1',
      },
      {
        id: 'a1',
        kind: 'tool_result',
        phase: 'answer',
        name: 'delete_file',
        ok: true,
        payload: { ok: true },
        anchor: 'answer',
        groupId: 'g1',
      },
    ]

    expect(filterRunEventsByLocation(events, 'thinking').map((event) => event.id)).toEqual(['t1'])
    expect(filterRunEventsByLocation(events, 'answer').map((event) => event.id)).toEqual(['a1'])
  })

  it('does not let thinking approval events leak into answer rendering', () => {
    const events: RunEvent[] = [
      {
        id: 'thinking-approval',
        kind: 'approval_resolved',
        phase: 'thinking',
        name: 'approval',
        approved: true,
        anchor: 'thinking',
        groupId: 'g1',
      },
      {
        id: 'answer-approval',
        kind: 'approval_resolved',
        phase: 'answer',
        name: 'approval',
        approved: true,
        anchor: 'answer',
        groupId: 'g2',
      },
    ]

    expect(getApprovalEventsByLocation(events, 'answer').map((event) => event.id)).toEqual(['answer-approval'])
  })
})
