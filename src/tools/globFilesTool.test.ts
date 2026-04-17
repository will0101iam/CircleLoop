import { describe, expect, it, vi } from 'vitest'
import { createGlobFilesTool } from './globFilesTool'

describe('globFilesTool', () => {
  it('matches files by glob pattern', async () => {
    const tree: Record<string, Array<{ name: string; isDir: boolean }>> = {
      '/tmp/ws': [
        { name: 'src', isDir: true },
        { name: 'README.md', isDir: false },
      ],
      '/tmp/ws/src': [
        { name: 'a.ts', isDir: false },
        { name: 'b.js', isDir: false },
      ],
    }

    const tool = createGlobFilesTool({
      workspacePath: '/tmp/ws',
      fileOps: {
        listDir: vi.fn(async (path: string) => tree[path] ?? []),
        readTextFile: vi.fn(),
      } as any,
    })

    const result = await tool.handler({ pattern: 'src/**/*.ts' })
    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error('expected ok')
    expect(result.data.files).toEqual(['/tmp/ws/src/a.ts'])
  })
})
