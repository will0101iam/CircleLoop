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
      expect(status.defaults).toEqual({ provider: 'minimax', model: 'MiniMax-M2.7' })
      expect(status.providers.minimax?.models).toEqual(['MiniMax-M2.7'])

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

  it('loads multi-provider config and resolves defaults through provider registry', async () => {
    const readTextFile = vi.fn().mockResolvedValue(
      JSON.stringify({
        defaults: {
          provider: 'openrouter',
          model: 'gpt-4o-mini',
        },
        providers: {
          minimax: {
            label: 'MiniMax',
            baseUrl: 'https://api.minimaxi.com/v1',
            apiKey: 'mini-secret',
            models: ['MiniMax-M2.7'],
            defaultModel: 'MiniMax-M2.7',
          },
          openrouter: {
            label: 'OpenRouter',
            baseUrl: 'https://openrouter.ai/api/v1',
            apiKey: 'or-secret',
            models: ['gpt-4o-mini', 'deepseek-chat'],
            defaultModel: 'gpt-4o-mini',
          },
          ollama: {
            label: 'Ollama',
            baseUrl: 'http://localhost:11434/v1',
            models: ['llama3.1'],
            defaultModel: 'llama3.1',
          },
        },
      }),
    )

    const status = await loadMinimaxConfig({
      isTauri: () => true,
      readTextFile,
      appConfigDir: async () => '/Users/alice/Library/Application Support/com.example.app',
      join: (...parts) => parts.join('/'),
    })

    expect(status.configured).toBe(true)
    expect(status.provider).toBe('openrouter')
    expect(status.baseUrl).toBe('https://openrouter.ai/api/v1')
    expect(status.model).toBe('gpt-4o-mini')
    expect(status.getApiKey()).toBe('or-secret')
    expect(status.getApiKey('minimax')).toBe('mini-secret')
    expect(status.getApiKey('ollama')).toBe(null)
    expect(status.providers.openrouter?.models).toEqual(['gpt-4o-mini', 'deepseek-chat'])
    expect(status.providers.ollama?.defaultModel).toBe('llama3.1')
  })

  it('loads tool config and masks tool api keys in JSON', async () => {
    const readTextFile = vi.fn().mockResolvedValue(
      JSON.stringify({
        defaults: {
          provider: 'openrouter',
          model: 'gpt-4o-mini',
        },
        providers: {
          openrouter: {
            label: 'OpenRouter',
            baseUrl: 'https://openrouter.ai/api/v1',
            apiKey: 'or-secret',
            models: ['gpt-4o-mini'],
            defaultModel: 'gpt-4o-mini',
          },
        },
        tools: {
          tavily: {
            enabled: true,
            apiKey: 'tvly-secret',
          },
        },
      }),
    )

    const status = await loadMinimaxConfig({
      isTauri: () => true,
      readTextFile,
      appConfigDir: async () => '/Users/alice/Library/Application Support/com.example.app',
      join: (...parts) => parts.join('/'),
    })

    expect(status.tools.tavily).toEqual({ enabled: true, apiKey: 'tvly-secret' })
    expect(JSON.stringify(status)).not.toContain('tvly-secret')
  })
})

describe('saveMinimaxConfig', () => {
  it('writes multi-provider config to app config directory', async () => {
    const writeTextFile = vi.fn().mockResolvedValue(undefined)
    const mkdir = vi.fn().mockResolvedValue(undefined)

    await saveMinimaxConfig(
      {
        defaults: {
          provider: 'openrouter',
          model: 'gpt-4o-mini',
        },
        providers: {
          minimax: {
            label: 'MiniMax',
            baseUrl: 'https://api.minimaxi.com/v1',
            apiKey: 'secret-999',
            models: ['MiniMax-M2.7'],
            defaultModel: 'MiniMax-M2.7',
          },
          openrouter: {
            label: 'OpenRouter',
            baseUrl: 'https://openrouter.ai/api/v1',
            apiKey: 'or-key',
            models: ['gpt-4o-mini', 'deepseek-chat'],
            defaultModel: 'gpt-4o-mini',
          },
        },
      },
      {
        isTauri: () => true,
        mkdir,
        writeTextFile,
      },
    )

    expect(mkdir).toHaveBeenCalledWith('circleloop', expect.any(Object))
    expect(writeTextFile).toHaveBeenCalledWith('circleloop/config.json', expect.any(String), expect.any(Object))
    const savedJson = JSON.parse(writeTextFile.mock.calls[0][1])
    expect(savedJson.defaults.provider).toBe('openrouter')
    expect(savedJson.providers.openrouter.models).toEqual(['gpt-4o-mini', 'deepseek-chat'])
  })

  it('writes tool config alongside provider config', async () => {
    const writeTextFile = vi.fn().mockResolvedValue(undefined)
    const mkdir = vi.fn().mockResolvedValue(undefined)

    await saveMinimaxConfig(
      {
        defaults: {
          provider: 'openrouter',
          model: 'gpt-4o-mini',
        },
        providers: {},
        tools: {
          tavily: {
            enabled: true,
            apiKey: 'tvly-secret',
          },
        },
      },
      {
        isTauri: () => true,
        mkdir,
        writeTextFile,
      },
    )

    const savedJson = JSON.parse(writeTextFile.mock.calls[0][1])
    expect(savedJson.tools.tavily).toEqual({ enabled: true, apiKey: 'tvly-secret' })
  })
})
