import type { FileOps } from '../tools/fileOps'

export type FileRollbackEntry =
  | { kind: 'write_text'; path: string; beforeExists: boolean; beforeContent: string | null }
  | { kind: 'delete_text'; path: string; beforeContent: string }
  | { kind: 'mkdir'; path: string; beforeExists: boolean }

export function createJournaledFileOps(input: {
  base: FileOps
  getActiveRunId: () => string | null
  journal: Record<string, FileRollbackEntry[]>
}): FileOps {
  const { base, getActiveRunId, journal } = input

  function push(entry: FileRollbackEntry) {
    const runId = getActiveRunId()
    if (!runId) return
    if (!journal[runId]) journal[runId] = []
    journal[runId]!.push(entry)
  }

  function getRunId() {
    return getActiveRunId()
  }

  return {
    exists: base.exists,
    readTextFile: base.readTextFile,
    async writeTextFile(path, content) {
      if (!getRunId()) {
        await base.writeTextFile(path, content)
        return
      }
      const beforeExists = await base.exists(path)
      const beforeContent = beforeExists ? await base.readTextFile(path).catch(() => null) : null
      await base.writeTextFile(path, content)
      push({ kind: 'write_text', path, beforeExists, beforeContent })
    },
    listDir: base.listDir,
    async createDir(path) {
      if (!getRunId()) {
        await base.createDir(path)
        return
      }
      const beforeExists = await base.exists(path)
      await base.createDir(path)
      push({ kind: 'mkdir', path, beforeExists })
    },
    async remove(path) {
      if (!getRunId()) {
        await base.remove(path)
        return
      }
      const existed = await base.exists(path)
      const beforeContent = existed ? await base.readTextFile(path).catch(() => null) : null
      await base.remove(path)
      if (beforeContent != null) {
        push({ kind: 'delete_text', path, beforeContent })
      }
    },
  }
}

export async function rollbackEntries(input: {
  base: FileOps
  entries: FileRollbackEntry[]
}) {
  const entries = [...input.entries].reverse()
  for (const entry of entries) {
    if (entry.kind === 'write_text') {
      if (!entry.beforeExists) {
        if (await input.base.exists(entry.path)) {
          await input.base.remove(entry.path)
        }
      } else if (entry.beforeContent != null) {
        await input.base.writeTextFile(entry.path, entry.beforeContent)
      }
    } else if (entry.kind === 'delete_text') {
      // Best-effort parent directory ensure for unix-style paths.
      const idx = entry.path.lastIndexOf('/')
      if (idx > 0) {
        const parent = entry.path.slice(0, idx)
        if (parent && !(await input.base.exists(parent))) {
          await input.base.createDir(parent)
        }
      }
      await input.base.writeTextFile(entry.path, entry.beforeContent)
    } else if (entry.kind === 'mkdir') {
      if (!entry.beforeExists && (await input.base.exists(entry.path))) {
        await input.base.remove(entry.path)
      }
    }
  }
}
