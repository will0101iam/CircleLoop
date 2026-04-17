import type { ToolResult } from './toolRegistry'
import type { FileOps } from './fileOps'
import { resolveWorkspacePath } from '../workspace/relativePath'

export function createWriteFileTool(deps: { workspacePath: string; fileOps: FileOps }) {
  return {
    name: 'write_file',
    description:
      'Create or overwrite a UTF-8 text file under the current workspace. Use this for creating new files or completely replacing existing file content.',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Relative file path under workspace' },
        content: { type: 'string', description: 'Full file content to write' },
      },
      required: ['path', 'content'],
      additionalProperties: false,
    },
    policy: { riskLevel: 'ask' as const, requiresWorkspace: true, pathArgKeys: ['path'] },
    async handler(args: { path: string; content: string }): Promise<ToolResult> {
      try {
        const fullPath = resolveWorkspacePath(deps.workspacePath, args.path)
        await deps.fileOps.writeTextFile(fullPath, args.content)
        const lines = args.content.split('\n').length
        return { ok: true, data: { path: fullPath, bytesWritten: new TextEncoder().encode(args.content).length, lines } }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        return { ok: false, error: { code: 'WRITE_FAILED', message } }
      }
    },
  }
}
