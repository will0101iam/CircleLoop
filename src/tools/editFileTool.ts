import type { ToolResult } from './toolRegistry'
import type { FileOps } from './fileOps'
import { resolveWorkspacePath } from '../workspace/relativePath'

type EditOperation = {
  oldText: string
  newText: string
}

type EditFileArgs = {
  path: string
  edits: EditOperation[]
}

export function createEditFileTool(deps: { workspacePath: string; fileOps: FileOps }) {
  return {
    name: 'edit_file',
    description:
      'Apply one or more text replacements to an existing UTF-8 text file. Each edit replaces the first occurrence of oldText with newText. Edits are applied sequentially in order.',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Relative file path under workspace' },
        edits: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              oldText: { type: 'string', description: 'Exact text to find and replace' },
              newText: { type: 'string', description: 'Replacement text' },
            },
            required: ['oldText', 'newText'],
            additionalProperties: false,
          },
        },
      },
      required: ['path', 'edits'],
      additionalProperties: false,
    },
    policy: { riskLevel: 'ask' as const, requiresWorkspace: true, pathArgKeys: ['path'] },
    async handler(args: EditFileArgs): Promise<ToolResult> {
      try {
        const fullPath = resolveWorkspacePath(deps.workspacePath, args.path)
        let content = await deps.fileOps.readTextFile(fullPath)

        let applied = 0
        for (const edit of args.edits) {
          if (!content.includes(edit.oldText)) {
            return {
              ok: false,
              error: { code: 'EDIT_TEXT_NOT_FOUND', message: `oldText not found in file: "${edit.oldText.slice(0, 80)}"` },
            }
          }
          content = content.replace(edit.oldText, edit.newText)
          applied += 1
        }

        await deps.fileOps.writeTextFile(fullPath, content)
        return { ok: true, data: { path: fullPath, editsApplied: applied, newContentLength: content.length } }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        return { ok: false, error: { code: 'EDIT_FAILED', message } }
      }
    },
  }
}
