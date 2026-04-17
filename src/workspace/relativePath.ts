function normalizeWorkspaceRoot(root: string) {
  if (root.length > 1 && root.endsWith('/')) return root.slice(0, -1)
  return root
}

function normalizeRelativePath(rel: string) {
  const raw = rel.trim()
  if (raw === '' || raw === '.') return ''

  if (raw.startsWith('/')) {
    throw new Error('ABSOLUTE_PATH_NOT_ALLOWED')
  }

  const parts = raw.split('/').filter((p) => p.length > 0 && p !== '.')
  for (const part of parts) {
    if (part === '..') {
      throw new Error('PARENT_TRAVERSAL_NOT_ALLOWED')
    }
  }

  return parts.join('/')
}

export function resolveWorkspacePath(workspaceRoot: string, relPath: string) {
  const root = normalizeWorkspaceRoot(workspaceRoot)
  const rel = normalizeRelativePath(relPath)
  return rel.length === 0 ? root : `${root}/${rel}`
}

