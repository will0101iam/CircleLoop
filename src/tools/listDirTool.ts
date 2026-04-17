import type { ToolResult } from './toolRegistry'
import type { FileOps } from './fileOps'
import { resolveWorkspacePath } from '../workspace/relativePath'

export function createListDirTool(deps: { workspacePath: string; fileOps: FileOps }) {
  return {
    name: 'list_dir',
    description: 'List a directory under the current workspace.',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string' },
      },
      additionalProperties: false,
    },
    policy: { riskLevel: 'safe' as const, requiresWorkspace: true, pathArgKeys: ['path'] },
    async handler(args: { path?: string }): Promise<ToolResult> {
      try {
        const rel = args.path ?? '.'
        const fullPath = resolveWorkspacePath(deps.workspacePath, rel)
        const entries = await deps.fileOps.listDir(fullPath)
        return { ok: true, data: { path: fullPath, entries } }
      } catch {
        return { ok: false, error: { code: 'INVALID_PATH' } }
      }
    },
  }
}
