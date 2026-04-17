export function getPathGuardDecision(input: {
  workspacePath: string
  toolName: string
  relativePath: string
}):
  | { ok: true }
  | { ok: false; error: { code: 'PATH_NOT_ALLOWED' | 'DANGEROUS_PATH_TARGET'; message?: string } } {
  const rel = input.relativePath.trim()
  if (rel === '' || rel === '.' || rel === '..') {
    if (input.toolName === 'delete_file' || input.toolName === 'write_file' || input.toolName === 'edit_file') {
      return { ok: false, error: { code: 'DANGEROUS_PATH_TARGET', message: 'Refusing to mutate workspace root' } }
    }
  }
  if (rel.startsWith('/')) {
    return { ok: false, error: { code: 'PATH_NOT_ALLOWED', message: 'Absolute path not allowed' } }
  }
  if (rel.split('/').some((p) => p === '..')) {
    return { ok: false, error: { code: 'PATH_NOT_ALLOWED', message: 'Parent traversal not allowed' } }
  }
  return { ok: true }
}

