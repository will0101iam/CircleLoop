import { describe, expect, it, vi } from 'vitest'

import {
  getAvailableProviderIds,
  getConfiguredProviderIds,
  getModelPickerProviderIds,
  isProviderDraftConfigured,
  parseModelsText,
  testProviderConnection,
  validateProviderSettingsSave,
  type ProviderSettingsDraft,
} from './providerSettings'

function draft(input?: Partial<ProviderSettingsDraft>): ProviderSettingsDraft {
  return {
    label: 'OpenRouter',
    baseUrl: 'https://openrouter.ai/api/v1',
    apiKey: 'secret',
    defaultModel: 'gpt-4o-mini',
    modelsText: 'gpt-4o-mini\ndeepseek-chat',
    ...input,
  }
}

describe('providerSettings', () => {
  it('parses models text as one trimmed model per line', () => {
    expect(parseModelsText(' gpt-4o-mini \n\n deepseek-chat \n')).toEqual(['gpt-4o-mini', 'deepseek-chat'])
  })

  it('treats ollama as configured without api key when base url and model exist', () => {
    expect(
      isProviderDraftConfigured(
        'ollama',
        draft({
          label: 'Ollama',
          apiKey: '',
          baseUrl: 'http://localhost:11434/v1',
          defaultModel: 'llama3.1',
          modelsText: 'llama3.1',
        }),
      ),
    ).toBe(true)
  })

  it('keeps an expanded new provider visible even before it becomes fully configured', () => {
    const providerIds = ['openrouter', 'ollama']
    const drafts = {
      openrouter: draft(),
      ollama: draft({
        label: 'Ollama',
        apiKey: '',
        baseUrl: 'http://localhost:11434/v1',
        defaultModel: '',
        modelsText: '',
      }),
    }

    expect(getConfiguredProviderIds(providerIds, drafts)).toEqual(['openrouter'])
    expect(getConfiguredProviderIds(providerIds, drafts, 'ollama')).toEqual(['openrouter', 'ollama'])
    expect(getAvailableProviderIds(providerIds, drafts)).toEqual(['ollama'])
  })

  it('returns only configured providers with non-empty models for the model picker', () => {
    const providerIds = ['minimax', 'openrouter', 'ollama']
    const drafts = {
      minimax: draft({ label: 'MiniMax', defaultModel: 'MiniMax-M2.7', modelsText: 'MiniMax-M2.7' }),
      openrouter: draft(),
      ollama: draft({
        label: 'Ollama',
        apiKey: '',
        baseUrl: 'http://localhost:11434/v1',
        defaultModel: '',
        modelsText: '',
      }),
    }
    const providers = {
      minimax: { label: 'MiniMax', baseUrl: 'https://api.minimaxi.com/v1', apiKey: 'k', models: ['MiniMax-M2.7'], defaultModel: 'MiniMax-M2.7' },
      openrouter: { label: 'OpenRouter', baseUrl: 'https://openrouter.ai/api/v1', apiKey: 'k', models: ['gpt-4o-mini'], defaultModel: 'gpt-4o-mini' },
      ollama: { label: 'Ollama', baseUrl: 'http://localhost:11434/v1', apiKey: null, models: [], defaultModel: null },
    }

    expect(getModelPickerProviderIds(providerIds, providers, drafts)).toEqual(['minimax', 'openrouter'])
  })

  it('rejects unusable default settings before save', () => {
    const drafts = {
      openrouter: draft(),
      ollama: draft({
        label: 'Ollama',
        apiKey: '',
        baseUrl: 'http://localhost:11434/v1',
        defaultModel: '',
        modelsText: '',
      }),
    }

    expect(
      validateProviderSettingsSave({
        defaults: { provider: 'ollama', model: 'llama3.1' },
        providerIds: ['openrouter', 'ollama'],
        drafts,
      }),
    ).toBe('默认渠道尚未配置完成，请先补全该渠道的地址、密钥和模型。')

    expect(
      validateProviderSettingsSave({
        defaults: { provider: 'openrouter', model: 'not-in-list' },
        providerIds: ['openrouter', 'ollama'],
        drafts,
      }),
    ).toBe('默认模型必须来自该渠道已配置的 models 列表。')
  })

  it('runs a request-based connection test when the provider is configured', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => ({
        choices: [{ message: { role: 'assistant', content: 'OK' } }],
      }),
    })

    const result = await testProviderConnection({
      providerId: 'openrouter',
      draft: draft(),
      fetch: fetchMock,
    })

    expect(result).toEqual({ ok: true })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})
