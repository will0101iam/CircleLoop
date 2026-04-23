import { describe, expect, it } from 'vitest'
import type { FileOps } from '../tools/fileOps'
import { createJournaledFileOps, rollbackEntries, type FileRollbackEntry } from './fileRollback'

function createMemFs() {
  const files = new Map<string, string>()
  const dirs = new Set<string>()

  const ops: FileOps = {
    async exists(path: string) {
      return files.has(path) || dirs.has(path)
    },
    async readTextFile(path: string) {
      const v = files.get(path)
      if (v === undefined) throw new Error('ENOENT')
      return v
    },
    async writeTextFile(path: string, content: string) {
      files.set(path, content)
    },
    async listDir(_path: string) {
      return []
    },
    async createDir(path: string) {
      dirs.add(path)
    },
    async remove(path: string) {
      files.delete(path)
      dirs.delete(path)
    },
  }

  return { ops, files, dirs }
}

describe('file rollback journal', () => {
  it('rolls back writeTextFile overwrite to previous content', async () => {
    const { ops, files } = createMemFs()
    files.set('/ws/a.txt', 'before')

    const journal: Record<string, FileRollbackEntry[]> = {}
    let activeRunId: string | null = 'r1'
    const wrapped = createJournaledFileOps({
      base: ops,
      getActiveRunId: () => activeRunId,
      journal,
    })

    await wrapped.writeTextFile('/ws/a.txt', 'after')
    expect(files.get('/ws/a.txt')).toBe('after')
    expect(journal.r1?.length).toBe(1)

    await rollbackEntries({ base: ops, entries: journal.r1 ?? [] })
    expect(files.get('/ws/a.txt')).toBe('before')
  })

  it('rolls back writeTextFile create by deleting the new file', async () => {
    const { ops, files } = createMemFs()
    const journal: Record<string, FileRollbackEntry[]> = {}
    let activeRunId: string | null = 'r1'
    const wrapped = createJournaledFileOps({
      base: ops,
      getActiveRunId: () => activeRunId,
      journal,
    })

    await wrapped.writeTextFile('/ws/new.txt', 'content')
    expect(files.get('/ws/new.txt')).toBe('content')

    await rollbackEntries({ base: ops, entries: journal.r1 ?? [] })
    expect(files.has('/ws/new.txt')).toBe(false)
  })

  it('rolls back delete of a text file by restoring content', async () => {
    const { ops, files } = createMemFs()
    files.set('/ws/del.txt', 'keep')

    const journal: Record<string, FileRollbackEntry[]> = {}
    let activeRunId: string | null = 'r1'
    const wrapped = createJournaledFileOps({
      base: ops,
      getActiveRunId: () => activeRunId,
      journal,
    })

    await wrapped.remove('/ws/del.txt')
    expect(files.has('/ws/del.txt')).toBe(false)

    await rollbackEntries({ base: ops, entries: journal.r1 ?? [] })
    expect(files.get('/ws/del.txt')).toBe('keep')
  })

  it('rolls back createDir by removing newly created directory', async () => {
    const { ops, dirs } = createMemFs()
    const journal: Record<string, FileRollbackEntry[]> = {}
    let activeRunId: string | null = 'r1'
    const wrapped = createJournaledFileOps({
      base: ops,
      getActiveRunId: () => activeRunId,
      journal,
    })

    await wrapped.createDir('/ws/newdir')
    expect(dirs.has('/ws/newdir')).toBe(true)

    await rollbackEntries({ base: ops, entries: journal.r1 ?? [] })
    expect(dirs.has('/ws/newdir')).toBe(false)
  })
})

