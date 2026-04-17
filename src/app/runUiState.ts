export function isThinkingExpanded(
  run: { status: 'pending' | 'waiting_approval' | 'completed' | 'error'; hasStartedAnswer: boolean },
  manuallyExpanded: boolean,
) {
  if (run.status === 'waiting_approval') return true
  if (run.status === 'completed' && !run.hasStartedAnswer) return true
  return manuallyExpanded
}
