import type { ToolResult } from './toolRegistry'
import type { FileOps } from './fileOps'
import { resolveWorkspacePath } from '../workspace/relativePath'

export function createReadFileTool(deps: { workspacePath: string; fileOps: FileOps }) {
  return {
    name: 'read_file',
    description: 'Read a UTF-8 text file under the current workspace.',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string' },
      },
      required: ['path'],
      additionalProperties: false,
    },
    policy: { riskLevel: 'safe' as const, requiresWorkspace: true, pathArgKeys: ['path'] },
    async handler(args: { path: string }): Promise<ToolResult> {
      try {
        const fullPath = resolveWorkspacePath(deps.workspacePath, args.path)
        const content = await deps.fileOps.readTextFile(fullPath)
        return { ok: true, data: { path: fullPath, content } }
      } catch {
        return { ok: false, error: { code: 'INVALID_PATH' } }
      }
    },
  }
}
