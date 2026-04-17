import type { RunEvent } from './runMessages'

export type RunEventLocation = 'thinking' | 'answer'

export function filterRunEventsByLocation(events: RunEvent[], location: RunEventLocation) {
  return events.filter((event) => (event.anchor ?? event.phase) === location)
}

export function getApprovalEventsByLocation(events: RunEvent[], location: RunEventLocation) {
  return filterRunEventsByLocation(events, location).filter(
    (event): event is Extract<RunEvent, { kind: 'approval_requested' | 'approval_resolved' }> =>
      event.kind === 'approval_requested' || event.kind === 'approval_resolved',
  )
}
