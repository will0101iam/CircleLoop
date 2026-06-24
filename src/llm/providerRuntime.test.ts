import { describe, expect, it } from 'vitest'

import { resolveProviderRuntime } from './providerRuntime'

describe('providerRuntime', () => {
  const config = {
    defaults: {
      provider: 'openrouter',
      model: 'gpt-4o-mini',
    },
    providers: {
      minimax: {
        label: 'MiniMax',
        baseUrl: 'https://api.minimaxi.com/v1',
        apiKey: 'mini-key',
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
      ollama: {
        label: 'Ollama',
        baseUrl: 'http://localhost:11434/v1',
        apiKey: null,
        models: ['llama3.1'],
        defaultModel: 'llama3.1',
      },
    },
  }

  it('uses session-selected provider and model when present', () => {
    const runtime = resolveProviderRuntime({
      config,
      sessionProvider: 'ollama',
      sessionModel: 'llama3.1',
    })

    expect(runtime).toMatchObject({
      provider: 'ollama',
      providerLabel: 'Ollama',
      baseUrl: 'http://localhost:11434/v1',
      apiKey: null,
      model: 'llama3.1',
    })
  })

  it('falls back to global defaults when session selection is empty', () => {
    const runtime = resolveProviderRuntime({
      config,
      sessionProvider: null,
      sessionModel: null,
    })

    expect(runtime).toMatchObject({
      provider: 'openrouter',
      model: 'gpt-4o-mini',
      apiKey: 'or-key',
    })
  })

  it('returns an error when the selected provider is missing', () => {
    const runtime = resolveProviderRuntime({
      config,
      sessionProvider: 'custom',
      sessionModel: 'my-model',
    })

    expect(runtime).toEqual({
      ok: false,
      error: '当前会话选择的 LLM 渠道未配置，请先在设置中完成配置。',
    })
  })
})
