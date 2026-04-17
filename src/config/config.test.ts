import { describe, expect, it, vi } from 'vitest'
import { loadMinimaxConfig, saveMinimaxConfig } from './config'

describe('loadMinimaxConfig', () => {
  it('returns configured=false when not in tauri', async () => {
    const readTextFile = vi.fn()
    const status = await loadMinimaxConfig({
      isTauri: () => false,
      readTextFile,
      appConfigDir: async () => '/Users/alice/Library/Application Support/com.example.app',
      join: (...parts) => parts.join('/'),
    })

    expect(status.configured).toBe(false)
    expect(status.configPath).toBe(null)
    expect(readTextFile).not.toHaveBeenCalled()
  })

  it('loads app config file in tauri and never exposes apiKey in JSON', async () => {
    const apiKey = 'secret-123'
    const readTextFile = vi.fn().mockResolvedValue(
      JSON.stringify({
        baseUrl: 'https://api.minimaxi.com/v1',
        apiKey,
        model: 'MiniMax-M2.7',
      }),
    )

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined)
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => undefined)
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined)

    try {
      const status = await loadMinimaxConfig({
        isTauri: () => true,
        readTextFile,
        appConfigDir: async () => '/Users/alice/Library/Application Support/com.example.app',
        join: (...parts) => parts.join('/'),
      })

      expect(status.configured).toBe(true)
      expect(status.configPath).toBe(
        '/Users/alice/Library/Application Support/com.example.app/circleloop/config.json',
      )
      expect(status.provider).toBe('minimax')
      expect(status.baseUrl).toBe('https://api.minimaxi.com/v1')
      expect(status.model).toBe('MiniMax-M2.7')
      expect(status.getApiKey()).toBe(apiKey)

      const json = JSON.stringify(status)
      expect(json).not.toContain(apiKey)
      expect(json).toContain('MiniMax-M2.7')

      expect(logSpy).not.toHaveBeenCalled()
      expect(infoSpy).not.toHaveBeenCalled()
      expect(warnSpy).not.toHaveBeenCalled()
      expect(errorSpy).not.toHaveBeenCalled()
    } finally {
      logSpy.mockRestore()
      infoSpy.mockRestore()
      warnSpy.mockRestore()
      errorSpy.mockRestore()
    }
  })

  it('returns configured=false on parse error', async () => {
    const readTextFile = vi.fn().mockResolvedValue('{ not valid json')

    const status = await loadMinimaxConfig({
      isTauri: () => true,
      readTextFile,
      appConfigDir: async () => '/Users/alice/Library/Application Support/com.example.app',
      join: (...parts) => parts.join('/'),
    })

    expect(status.configured).toBe(false)
    expect(status.configPath).toBe(
      '/Users/alice/Library/Application Support/com.example.app/circleloop/config.json',
    )
    expect(status.getApiKey()).toBe(null)
  })
})

describe('saveMinimaxConfig', () => {
  it('writes config to app config directory', async () => {
    const writeTextFile = vi.fn().mockResolvedValue(undefined)
    const mkdir = vi.fn().mockResolvedValue(undefined)

    await saveMinimaxConfig(
      {
        baseUrl: 'https://api.minimaxi.com/v1',
        apiKey: 'secret-999',
        model: 'MiniMax-M2.7',
      },
      {
        isTauri: () => true,
        mkdir,
        writeTextFile,
      },
    )

    expect(mkdir).toHaveBeenCalledWith('circleloop', expect.any(Object))
    expect(writeTextFile).toHaveBeenCalledWith('circleloop/config.json', expect.any(String), expect.any(Object))
  })
})
