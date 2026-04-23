import { describe, expect, it, vi } from 'vitest'
import { createRuntime } from './runtime'

describe('runtime file tools', () => {
  it('still exposes workspace-required tools before workspace is bound', async () => {
    const run = vi.fn().mockResolvedValue(undefined)
    const query = vi.fn().mockResolvedValue([])
    const createAppDb = vi.fn().mockResolvedValue({ run, query })

    const rt = await createRuntime({
      createAppDb,
      fileOps: {
        exists: vi.fn().mockResolvedValue(false),
        listDir: vi.fn(),
        readTextFile: vi.fn(),
        writeTextFile: vi.fn(),
        createDir: vi.fn(),
        remove: vi.fn(),
      },
    })

    expect(rt.tools.get('list_dir')?.policy?.requiresWorkspace).toBe(true)
    expect(rt.tools.get('read_file')?.policy?.requiresWorkspace).toBe(true)
  })

  it('registers file tools only when workspacePath and fileOps are provided', async () => {
    const run = vi.fn().mockResolvedValue(undefined)
    const query = vi.fn().mockResolvedValue([])
    const createAppDb = vi.fn().mockResolvedValue({ run, query })

    const listDir = vi.fn(async (path: string) =>
      path === '/tmp/ws' ? [{ name: 'README.md', isDir: false }] : [],
    )
    const readTextFile = vi.fn().mockResolvedValue('hello')

    const rt = await createRuntime({
      createAppDb,
      workspacePath: '/tmp/ws',
      fileOps: {
        exists: vi.fn().mockResolvedValue(true),
        listDir,
        readTextFile,
        writeTextFile: vi.fn(),
        createDir: vi.fn(),
        remove: vi.fn(),
      },
    })

    const listed = await rt.tools.execute('list_dir', { path: '.' })
    expect(listed.ok).toBe(true)
    expect(listDir).toHaveBeenCalledWith('/tmp/ws')

    const read = await rt.tools.execute('read_file', { path: 'README.md' })
    expect(read.ok).toBe(true)
    expect(readTextFile).toHaveBeenCalledWith('/tmp/ws/README.md')

    const searched = await rt.tools.execute('search_code', { path: '.', query: 'hello' })
    expect(searched.ok).toBe(true)
  })
})
