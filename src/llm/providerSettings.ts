import { createChatCompletionOpenAICompat } from './openaiCompat'
import type { LlmProviderConfig } from '../config/config'

export type ProviderSettingsDraft = {
  label: string
  baseUrl: string
  apiKey: string
  defaultModel: string
  modelsText: string
}

export function parseModelsText(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
}

export function isProviderDraftConfigured(providerId: string, draft: ProviderSettingsDraft | undefined): boolean {
  if (!draft) return false
  const models = parseModelsText(draft.modelsText)
  const hasBaseUrl = draft.baseUrl.trim().length > 0
  const hasModel = draft.defaultModel.trim().length > 0 || models.length > 0
  const requiresApiKey = providerId !== 'ollama' && providerId !== 'custom'
  const hasApiKey = draft.apiKey.trim().length > 0
  return hasBaseUrl && hasModel && (!requiresApiKey || hasApiKey)
}

export function getConfiguredProviderIds(
  providerIds: string[],
  drafts: Record<string, ProviderSettingsDraft>,
  expandedProviderId?: string | null,
): string[] {
  const configured = providerIds.filter((providerId) => isProviderDraftConfigured(providerId, drafts[providerId]))
  if (expandedProviderId && !configured.includes(expandedProviderId) && drafts[expandedProviderId]) {
    return [...configured, expandedProviderId]
  }
  return configured
}

export function getAvailableProviderIds(providerIds: string[], drafts: Record<string, ProviderSettingsDraft>): string[] {
  return providerIds.filter((providerId) => !isProviderDraftConfigured(providerId, drafts[providerId]))
}

export function getModelPickerProviderIds(
  providerIds: string[],
  providers: Record<string, LlmProviderConfig>,
  drafts: Record<string, ProviderSettingsDraft>,
): string[] {
  return providerIds.filter((providerId) => {
    if (!isProviderDraftConfigured(providerId, drafts[providerId])) return false
    return (providers[providerId]?.models ?? []).length > 0
  })
}

export function validateProviderSettingsSave(input: {
  defaults: { provider: string; model: string }
  providerIds: string[]
  drafts: Record<string, ProviderSettingsDraft>
}): string | null {
  const providerId = input.defaults.provider.trim()
  const model = input.defaults.model.trim()
  if (!providerId || !model) return '请填写默认渠道和默认模型'

  const draft = input.drafts[providerId]
  if (!isProviderDraftConfigured(providerId, draft)) {
    return '默认渠道尚未配置完成，请先补全该渠道的地址、密钥和模型。'
  }

  const models = parseModelsText(draft?.modelsText ?? '')
  if (!models.includes(model)) {
    return '默认模型必须来自该渠道已配置的 models 列表。'
  }

  return null
}

export async function testProviderConnection(input: {
  providerId: string
  draft: ProviderSettingsDraft
  fetch?: typeof fetch
}): Promise<{ ok: true } | { ok: false; message: string }> {
  const configured = isProviderDraftConfigured(input.providerId, input.draft)
  if (!configured) {
    return {
      ok: false,
      message: '请先补全该渠道的地址、密钥和模型后再测试连接。',
    }
  }

  const models = parseModelsText(input.draft.modelsText)
  const model = input.draft.defaultModel.trim() || models[0] || ''

  try {
    await createChatCompletionOpenAICompat({
      baseUrl: input.draft.baseUrl.trim(),
      apiKey: input.draft.apiKey.trim() || null,
      model,
      messages: [{ role: 'user', content: 'Reply with OK only.' }],
      fetch: input.fetch,
    })
    return { ok: true }
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : '连接测试失败',
    }
  }
}
