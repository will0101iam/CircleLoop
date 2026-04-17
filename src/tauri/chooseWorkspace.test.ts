import { describe, expect, it, vi } from 'vitest'
import { chooseWorkspace } from './chooseWorkspace'

describe('chooseWorkspace', () => {
  it('returns null when tauri is not available', async () => {
    const result = await chooseWorkspace()
    expect(result).toBe(null)
  })

  it('returns null when user cancels', async () => {
    const open = vi.fn().mockResolvedValue(null)
    const result = await chooseWorkspace({ open })
    expect(result).toBe(null)
  })

  it('returns a string path when directory is selected', async () => {
    const open = vi.fn().mockResolvedValue('/tmp/ws')
    const result = await chooseWorkspace({ open })
    expect(result).toBe('/tmp/ws')
  })
})
