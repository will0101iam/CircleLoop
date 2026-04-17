import type { FileOps } from './fileOps'
import type { ToolResult } from './toolRegistry'
import { resolveWorkspacePath } from '../workspace/relativePath'

function escapeRegex(input: string) {
  return input.replace(/[|\\{}()[\]^$+?.]/g, '\\$&')
}

function globToRegex(pattern: string) {
  let output = '^'
  for (let i = 0; i < pattern.length; i += 1) {
    const char = pattern[i]
    const next = pattern[i + 1]
    const nextNext = pattern[i + 2]
    if (char === '*' && next === '*' && nextNext === '/') {
      output += '(?:.*/)?'
      i += 2
      continue
    }
    if (char === '*' && next === '*') {
      output += '.*'
      i += 1
      continue
    }
    if (char === '*') {
      output += '[^/]*'
      continue
    }
    output += escapeRegex(char)
  }
  output += '$'
  return new RegExp(output)
}

export function createGlobFilesTool(deps: { workspacePath: string; fileOps: FileOps }) {
  return {
    name: 'glob_files',
    description: 'Find files under the current workspace using a glob pattern.',
    inputSchema: {
      type: 'object',
      properties: {
        pattern: { type: 'string' },
        path: { type: 'string' },
        maxResults: { type: 'number' },
      },
      required: ['pattern'],
      additionalProperties: false,
    },
    policy: { riskLevel: 'safe' as const, requiresWorkspace: true, pathArgKeys: ['path'] },
    async handler(args: { pattern: string; path?: string; maxResults?: number }): Promise<ToolResult<{ files: string[] }>> {
      const root = resolveWorkspacePath(deps.workspacePath, args.path ?? '.')
      const matcher = globToRegex(args.pattern)
      const maxResults = typeof args.maxResults === 'number' && Number.isFinite(args.maxResults) ? Math.max(1, Math.trunc(args.maxResults)) : 200
      const results: string[] = []
      const queue = [root]

      while (queue.length > 0 && results.length < maxResults) {
        const current = queue.shift()!
        let entries: Array<{ name: string; isDir: boolean }>
        try {
          entries = await deps.fileOps.listDir(current)
        } catch {
          continue
        }

        for (const entry of entries) {
          const childPath = `${current}/${entry.name}`
          const relative = childPath.slice(deps.workspacePath.length + 1)
          if (entry.isDir) {
            queue.push(childPath)
            continue
          }
          if (matcher.test(relative)) {
            results.push(childPath)
            if (results.length >= maxResults) break
          }
        }
      }

      return { ok: true, data: { files: results } }
    },
  }
}
