import { describe, expect, it, vi } from 'vitest'
import { createTauriFileOps } from './tauriFileOps'

describe('createTauriFileOps', () => {
  it('adapts readTextFile, writeTextFile, readDir into FileOps', async () => {
    const readTextFile = vi.fn().mockResolvedValue('hello')
    const writeTextFile = vi.fn().mockResolvedValue(undefined)
    const readDir = vi.fn().mockResolvedValue([{ name: 'src', children: [] }])

    const ops = await createTauriFileOps({ readTextFile, writeTextFile, readDir })

    const text = await ops.readTextFile('/tmp/ws/README.md')
    expect(text).toBe('hello')

    await ops.writeTextFile('/tmp/ws/test.txt', 'content')
    expect(writeTextFile).toHaveBeenCalledWith('/tmp/ws/test.txt', 'content')

    const entries = await ops.listDir('/tmp/ws')
    expect(entries[0]?.name).toBe('src')
    expect(entries[0]?.isDir).toBe(true)
  })
})

