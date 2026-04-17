export type ApprovalUiState =
  | { status: 'pending' }
  | { status: 'resolving_approved' }
  | { status: 'resolving_denied' }
  | { status: 'resolved_approved' }
  | { status: 'resolved_denied' }

export function getApprovalStatusText(state: ApprovalUiState) {
  switch (state.status) {
    case 'pending':
      return '需要确认'
    case 'resolving_approved':
      return '已同意，继续执行中…'
    case 'resolving_denied':
      return '已拒绝，继续执行中…'
    case 'resolved_approved':
      return '已同意'
    case 'resolved_denied':
      return '已拒绝'
  }
}

export function isApprovalInteractive(state: ApprovalUiState) {
  return state.status === 'pending'
}
