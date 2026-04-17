import type { FileOps } from './fileOps'
import type { ToolResult } from './toolRegistry'
import { resolveWorkspacePath } from '../workspace/relativePath'

type SearchMatch = { file: string; line: number; preview: string }

type SearchCodeArgs = {
  query: string
  path?: string
  maxFiles?: number
  maxMatches?: number
  maxDirEntries?: number
  maxDepth?: number
  ignoreCase?: boolean
  maxPreviewChars?: number
  regex?: boolean
  fileExtensions?: string[]
}

function clampInt(n: unknown, fallback: number, min: number, max: number) {
  if (typeof n !== 'number' || !Number.isFinite(n)) return fallback
  const i = Math.trunc(n)
  if (i < min) return min
  if (i > max) return max
  return i
}

function buildPreview(line: string, maxChars: number) {
  const raw = line.replace(/\t/g, ' ').trim()
  if (raw.length <= maxChars) return raw
  return raw.slice(0, maxChars)
}

export function createSearchCodeTool(deps: { workspacePath: string; fileOps: FileOps }) {
  return {
    name: 'search_code',
    description: 'Search for a substring in text files under the current workspace (recursive).',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string' },
        path: { type: 'string' },
        maxFiles: { type: 'number' },
        maxMatches: { type: 'number' },
        maxDirEntries: { type: 'number' },
        maxDepth: { type: 'number' },
        ignoreCase: { type: 'boolean' },
        maxPreviewChars: { type: 'number' },
        regex: { type: 'boolean' },
        fileExtensions: { type: 'array', items: { type: 'string' } },
      },
      required: ['query'],
      additionalProperties: false,
    },
    policy: { riskLevel: 'safe' as const, requiresWorkspace: true, pathArgKeys: ['path'] },
    async handler(args: SearchCodeArgs): Promise<ToolResult<{ matches: SearchMatch[] }>> {
      if (typeof args.query !== 'string' || args.query.trim().length === 0) {
        return { ok: false, error: { code: 'INVALID_QUERY' } }
      }

      let root: string
      try {
        root = resolveWorkspacePath(deps.workspacePath, args.path ?? '.')
      } catch {
        return { ok: false, error: { code: 'INVALID_PATH' } }
      }

      const maxFiles = clampInt(args.maxFiles, 200, 1, 20_000)
      const maxMatches = clampInt(args.maxMatches, 200, 1, 20_000)
      const maxDirEntries = clampInt(args.maxDirEntries, 20_000, 1, 1_000_000)
      const maxDepth = clampInt(args.maxDepth, 25, 0, 1_000)
      const ignoreCase = args.ignoreCase === true
      const maxPreviewChars = clampInt(args.maxPreviewChars, 200, 1, 10_000)
      const regexEnabled = args.regex === true
      const fileExtensions = Array.isArray(args.fileExtensions)
        ? args.fileExtensions.filter((item): item is string => typeof item === 'string' && item.length > 0)
        : []

      const needle = ignoreCase ? args.query.toLowerCase() : args.query
      const regex = regexEnabled ? new RegExp(args.query, ignoreCase ? 'i' : undefined) : null
      const matches: SearchMatch[] = []

      const queue: Array<{ path: string; depth: number }> = [{ path: root, depth: 0 }]
      const visitedDirs = new Set<string>()
      let dirEntriesSeen = 0
      let filesRead = 0

      while (queue.length > 0) {
        if (matches.length >= maxMatches) break
        if (filesRead >= maxFiles) break
        if (dirEntriesSeen >= maxDirEntries) break

        const current = queue.shift()!
        if (current.depth > maxDepth) continue
        if (visitedDirs.has(current.path)) continue
        visitedDirs.add(current.path)

        let entries: Array<{ name: string; isDir: boolean }>
        try {
          entries = await deps.fileOps.listDir(current.path)
        } catch {
          continue
        }

        for (const entry of entries) {
          if (matches.length >= maxMatches) break
          if (filesRead >= maxFiles) break
          if (dirEntriesSeen >= maxDirEntries) break

          dirEntriesSeen += 1
          const childPath = `${current.path}/${entry.name}`
          if (entry.isDir) {
            if (current.depth + 1 <= maxDepth) {
              queue.push({ path: childPath, depth: current.depth + 1 })
            }
            continue
          }
          if (fileExtensions.length > 0 && !fileExtensions.some((ext) => childPath.endsWith(ext))) {
            continue
          }

          let content: string
          try {
            content = await deps.fileOps.readTextFile(childPath)
          } catch {
            continue
          }
          filesRead += 1

          const lines = content.split(/\r?\n/)
          for (let i = 0; i < lines.length; i += 1) {
            if (matches.length >= maxMatches) break
            const lineText = lines[i] ?? ''
            const hay = ignoreCase ? lineText.toLowerCase() : lineText
            const matched = regex ? regex.test(lineText) : hay.includes(needle)
            if (!matched) continue

            matches.push({
              file: childPath,
              line: i + 1,
              preview: buildPreview(lineText, maxPreviewChars),
            })
          }
        }
      }

      return { ok: true, data: { matches } }
    },
  }
}
