import { describe, expect, it } from 'vitest'
import { getApprovalStatusText, isApprovalInteractive } from './approvalUiState'

describe('approvalUiState', () => {
  it('maps pending, resolving and resolved states to user-facing labels', () => {
    expect(getApprovalStatusText({ status: 'pending' })).toBe('需要确认')
    expect(getApprovalStatusText({ status: 'resolving_approved' })).toBe('已同意，继续执行中…')
    expect(getApprovalStatusText({ status: 'resolving_denied' })).toBe('已拒绝，继续执行中…')
    expect(getApprovalStatusText({ status: 'resolved_approved' })).toBe('已同意')
    expect(getApprovalStatusText({ status: 'resolved_denied' })).toBe('已拒绝')
  })

  it('only keeps buttons interactive while approval is pending', () => {
    expect(isApprovalInteractive({ status: 'pending' })).toBe(true)
    expect(isApprovalInteractive({ status: 'resolving_approved' })).toBe(false)
    expect(isApprovalInteractive({ status: 'resolved_denied' })).toBe(false)
  })
})
