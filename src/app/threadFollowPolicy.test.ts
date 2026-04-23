import { describe, expect, it } from 'vitest'

import {
  beginRunFollow,
  interruptRunFollow,
  shouldAutoAnchorApproval,
  shouldAutoFollowRun,
  shouldAutoFollowRunCompletion,
  shouldTriggerFinalScroll,
} from './threadFollowPolicy'

describe('threadFollowPolicy', () => {
  it('disables auto-follow for the rest of the current run after manual interruption', () => {
    const started = beginRunFollow('run-1')
    const interrupted = interruptRunFollow(started, 'run-1')

    expect(shouldAutoFollowRun(interrupted, 'run-1')).toBe(false)
  })

  it('resets interruption only when a new run begins', () => {
    const started = beginRunFollow('run-1')
    const interrupted = interruptRunFollow(started, 'run-1')
    const nextRun = beginRunFollow('run-2')

    expect(shouldAutoFollowRun(interrupted, 'run-1')).toBe(false)
    expect(shouldAutoFollowRun(nextRun, 'run-2')).toBe(true)
  })

  it('allows one final completion follow only if the current run was not interrupted', () => {
    const started = beginRunFollow('run-1')
    const interrupted = interruptRunFollow(started, 'run-1')

    expect(shouldAutoFollowRunCompletion(started, 'run-1')).toBe(true)
    expect(shouldAutoFollowRunCompletion(interrupted, 'run-1')).toBe(false)
  })

  it('does not trigger final completion follow for approval-required pauses', () => {
    const started = beginRunFollow('run-1')

    expect(shouldTriggerFinalScroll({ state: started, runId: 'run-1', status: 'waiting_approval' })).toBe(false)
    expect(shouldTriggerFinalScroll({ state: started, runId: 'run-1', status: 'pending' })).toBe(false)
    expect(shouldTriggerFinalScroll({ state: started, runId: 'run-1', status: 'completed' })).toBe(true)
  })

  it('still allows approval anchor scrolling for the active run even after ordinary follow was interrupted', () => {
    const started = beginRunFollow('run-1')
    const interrupted = interruptRunFollow(started, 'run-1')

    expect(shouldAutoFollowRun(interrupted, 'run-1')).toBe(false)
    expect(shouldAutoAnchorApproval(interrupted, 'run-1')).toBe(true)
    expect(shouldAutoAnchorApproval(interrupted, 'run-2')).toBe(false)
  })
})
