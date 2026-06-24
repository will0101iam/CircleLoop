import type { LlmProviderConfig } from '../config/config'

type ProviderRegistryConfig = {
  defaults: {
    provider: string | null
    model: string | null
  }
  providers: Record<string, LlmProviderConfig>
}

type ResolveInput = {
  config: ProviderRegistryConfig
  sessionProvider: string | null
  sessionModel: string | null
}

export type ProviderRuntimeResult =
  | {
      ok: true
      provider: string
      providerLabel: string
      baseUrl: string
      apiKey: string | null
      model: string
    }
  | {
      ok: false
      error: string
    }

export function resolveProviderRuntime(input: ResolveInput): ProviderRuntimeResult {
  const providerId = input.sessionProvider ?? input.config.defaults.provider
  if (!providerId || !input.config.providers[providerId]) {
    return {
      ok: false,
      error: '当前会话选择的 LLM 渠道未配置，请先在设置中完成配置。',
    }
  }

  const provider = input.config.providers[providerId]
  const model = input.sessionModel ?? provider.defaultModel ?? input.config.defaults.model
  if (!provider.baseUrl || !model) {
    return {
      ok: false,
      error: '当前会话选择的 LLM 配置不完整，请先检查渠道地址和模型列表。',
    }
  }

  return {
    ok: true,
    provider: providerId,
    providerLabel: provider.label,
    baseUrl: provider.baseUrl,
    apiKey: provider.apiKey ?? null,
    model,
  }
}
