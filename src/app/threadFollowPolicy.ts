export type ThreadFollowState = {
  activeRunId: string | null
  interruptedRunId: string | null
}

export function beginRunFollow(runId: string): ThreadFollowState {
  return {
    activeRunId: runId,
    interruptedRunId: null,
  }
}

export function interruptRunFollow(state: ThreadFollowState, runId: string): ThreadFollowState {
  if (state.activeRunId !== runId) return state
  return {
    ...state,
    interruptedRunId: runId,
  }
}

export function shouldAutoFollowRun(state: ThreadFollowState, runId: string | null): boolean {
  if (!runId) return false
  return state.activeRunId === runId && state.interruptedRunId !== runId
}

export function shouldAutoFollowRunCompletion(state: ThreadFollowState, runId: string | null): boolean {
  if (!runId) return false
  return state.activeRunId === runId && state.interruptedRunId !== runId
}

export function shouldAutoAnchorApproval(state: ThreadFollowState, runId: string | null): boolean {
  if (!runId) return false
  return state.activeRunId === runId
}

export function shouldTriggerFinalScroll(input: {
  state: ThreadFollowState
  runId: string | null
  status: 'completed' | 'error' | 'waiting_approval' | 'pending'
}): boolean {
  if (input.status !== 'completed' && input.status !== 'error') return false
  return shouldAutoFollowRunCompletion(input.state, input.runId)
}
