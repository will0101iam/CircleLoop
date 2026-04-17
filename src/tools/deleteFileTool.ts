import type { ToolResult } from './toolRegistry'
import type { FileOps } from './fileOps'
import { resolveWorkspacePath } from '../workspace/relativePath'

export function createDeleteFileTool(deps: { workspacePath: string; fileOps: FileOps }) {
  return {
    name: 'delete_file',
    description: 'Delete a file or directory (recursively) under the current workspace.',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Relative file or directory path under workspace' },
      },
      required: ['path'],
      additionalProperties: false,
    },
    policy: { riskLevel: 'ask' as const, requiresWorkspace: true, pathArgKeys: ['path'] },
    async handler(args: { path: string }): Promise<ToolResult> {
      try {
        const fullPath = resolveWorkspacePath(deps.workspacePath, args.path)
        await deps.fileOps.remove(fullPath)
        return { ok: true, data: { path: fullPath } }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        return { ok: false, error: { code: 'DELETE_FAILED', message } }
      }
    },
  }
}
