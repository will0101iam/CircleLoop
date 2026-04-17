import type { ToolResult } from './toolRegistry'
import type { FileOps } from './fileOps'
import { resolveWorkspacePath } from '../workspace/relativePath'

export function createCreateDirTool(deps: { workspacePath: string; fileOps: FileOps }) {
  return {
    name: 'create_dir',
    description: 'Create a directory (and any missing parent directories) under the current workspace.',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Relative directory path under workspace' },
      },
      required: ['path'],
      additionalProperties: false,
    },
    policy: { riskLevel: 'ask' as const, requiresWorkspace: true, pathArgKeys: ['path'] },
    async handler(args: { path: string }): Promise<ToolResult> {
      try {
        const fullPath = resolveWorkspacePath(deps.workspacePath, args.path)
        await deps.fileOps.createDir(fullPath)
        return { ok: true, data: { path: fullPath } }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        return { ok: false, error: { code: 'CREATE_DIR_FAILED', message } }
      }
    },
  }
}
