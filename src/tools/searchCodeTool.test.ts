import { describe, expect, it, vi } from 'vitest'
import { createSearchCodeTool } from './searchCodeTool'

function createFileOpsMock(input: { listDir: (path: string) => Promise<{ name: string; isDir: boolean }[]>; readTextFile: (path: string) => Promise<string> }) {
  return {
    listDir: input.listDir,
    readTextFile: input.readTextFile,
    writeTextFile: vi.fn(),
    createDir: vi.fn(),
    remove: vi.fn(),
  }
}

describe('search code tool', () => {
  it('searches recursively and returns file/line/preview', async () => {
    const tree: Record<string, Array<{ name: string; isDir: boolean }>> = {
      '/tmp/ws': [
        { name: 'a', isDir: true },
        { name: 'root.txt', isDir: false },
      ],
      '/tmp/ws/a': [{ name: 'nested.txt', isDir: false }],
    }

    const listDir = vi.fn(async (path: string) => tree[path] ?? [])
    const readTextFile = vi.fn(async (path: string) => {
      if (path === '/tmp/ws/root.txt') return 'nope\nhello world\nx'
      if (path === '/tmp/ws/a/nested.txt') return 'hello again'
      throw new Error('NOT_FOUND')
    })

    const tool = createSearchCodeTool({
      workspacePath: '/tmp/ws',
      fileOps: createFileOpsMock({ listDir, readTextFile }),
    })

    const result = await tool.handler({ path: '.', query: 'hello' })
    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error('expected ok')

    expect(result.data.matches).toEqual([
      { file: '/tmp/ws/root.txt', line: 2, preview: 'hello world' },
      { file: '/tmp/ws/a/nested.txt', line: 1, preview: 'hello again' },
    ])
  })

  it('respects maxMatches', async () => {
    const tree: Record<string, Array<{ name: string; isDir: boolean }>> = {
      '/tmp/ws': [{ name: 'a.txt', isDir: false }],
    }

    const listDir = vi.fn(async (path: string) => tree[path] ?? [])
    const readTextFile = vi.fn(async () => 'hello\nhello\nhello')

    const tool = createSearchCodeTool({
      workspacePath: '/tmp/ws',
      fileOps: createFileOpsMock({ listDir, readTextFile }),
    })

    const result = await tool.handler({ query: 'hello', maxMatches: 1 })
    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error('expected ok')

    expect(result.data.matches).toHaveLength(1)
    expect(result.data.matches[0]).toEqual({ file: '/tmp/ws/a.txt', line: 1, preview: 'hello' })
  })

  it('respects maxFiles', async () => {
    const tree: Record<string, Array<{ name: string; isDir: boolean }>> = {
      '/tmp/ws': [
        { name: 'a.txt', isDir: false },
        { name: 'b.txt', isDir: false },
      ],
    }

    const listDir = vi.fn(async (path: string) => tree[path] ?? [])
    const readTextFile = vi.fn(async () => 'hello')

    const tool = createSearchCodeTool({
      workspacePath: '/tmp/ws',
      fileOps: createFileOpsMock({ listDir, readTextFile }),
    })

    const result = await tool.handler({ query: 'hello', maxFiles: 1 })
    expect(result.ok).toBe(true)
    expect(readTextFile).toHaveBeenCalledTimes(1)
    expect(result.ok && result.data.matches).toHaveLength(1)
  })

  it('truncates preview to maxPreviewChars', async () => {
    const listDir = vi.fn(async (path: string) =>
      path === '/tmp/ws' ? [{ name: 'a.txt', isDir: false }] : [],
    )
    const readTextFile = vi.fn(async () => '   hello world   ')

    const tool = createSearchCodeTool({
      workspacePath: '/tmp/ws',
      fileOps: createFileOpsMock({ listDir, readTextFile }),
    })

    const result = await tool.handler({ query: 'hello', maxPreviewChars: 5 })
    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error('expected ok')

    expect(result.data.matches[0]?.preview).toBe('hello')
  })

  it('rejects absolute paths', async () => {
    const listDir = vi.fn()
    const tool = createSearchCodeTool({
      workspacePath: '/tmp/ws',
      fileOps: createFileOpsMock({ listDir, readTextFile: vi.fn(async () => '') }),
    })

    const result = await tool.handler({ query: 'x', path: '/etc' })
    expect(result.ok).toBe(false)
    expect(result.ok === false && result.error.code).toBe('INVALID_PATH')
  })

  it('supports regex queries and file extension filtering', async () => {
    const tree: Record<string, Array<{ name: string; isDir: boolean }>> = {
      '/tmp/ws': [
        { name: 'a.ts', isDir: false },
        { name: 'b.md', isDir: false },
      ],
    }

    const listDir = vi.fn(async (path: string) => tree[path] ?? [])
    const readTextFile = vi.fn(async (path: string) => {
      if (path === '/tmp/ws/a.ts') return 'const answer = 42'
      if (path === '/tmp/ws/b.md') return 'answer = 42'
      return ''
    })

    const tool = createSearchCodeTool({
      workspacePath: '/tmp/ws',
      fileOps: createFileOpsMock({ listDir, readTextFile }),
    })

    const result = await tool.handler({
      query: '^const\\s+answer\\s*=\\s*\\d+$',
      regex: true,
      fileExtensions: ['.ts'],
    } as any)

    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error('expected ok')

    expect(result.data.matches).toEqual([{ file: '/tmp/ws/a.ts', line: 1, preview: 'const answer = 42' }])
  })
})
