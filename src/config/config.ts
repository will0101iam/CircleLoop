export type LlmProviderId =
  | 'minimax'
  | 'openai'
  | 'openrouter'
  | 'deepseek'
  | 'glm'
  | 'ollama'
  | 'custom'

export type LlmProviderConfig = {
  label: string
  baseUrl: string | null
  apiKey?: string | null
  models: string[]
  defaultModel: string | null
  enabled?: boolean
}

export type LlmDefaults = {
  provider: string | null
  model: string | null
}

export type MinimaxConfigStatus = {
  configured: boolean
  configPath: string | null
  provider: string | null
  baseUrl: string | null
  model: string | null
  defaults: LlmDefaults
  providers: Record<string, LlmProviderConfig>
  getApiKey: (providerId?: string | null) => string | null
  toJSON?: () => Record<string, unknown>
}

type TauriPathApi = {
  appConfigDir: () => Promise<string>
  join: (...paths: string[]) => Promise<string> | string
}

type ReadTextFileFn = (path: string) => Promise<string>
type WriteTextFileFn = (path: string, contents: string, options?: unknown) => Promise<void>
type MkdirFn = (path: string, options?: unknown) => Promise<void>

async function defaultGetConfigPath(): Promise<string | null> {
  try {
    const pathApi = (await import('@tauri-apps/api/path')) as unknown as TauriPathApi
    const dir = await pathApi.appConfigDir()
    return await Promise.resolve(pathApi.join(dir, 'circleloop', 'config.json'))
  } catch {
    return null
  }
}

export function createEmptyMinimaxConfigStatus(configPath: string | null = null): MinimaxConfigStatus {
  return {
    configured: false,
    configPath,
    provider: null,
    baseUrl: null,
    model: null,
    defaults: {
      provider: null,
      model: null,
    },
    providers: defaultProviders(),
    getApiKey: () => null,
    toJSON() {
      return {
        configured: false,
        configPath,
        provider: null,
        baseUrl: null,
        model: null,
        defaults: { provider: null, model: null },
        providers: stripProviderSecrets(defaultProviders()),
      }
    },
  }
}

function getProviderLabel(providerId: string): string {
  switch (providerId) {
    case 'minimax':
      return 'MiniMax'
    case 'openai':
      return 'OpenAI'
    case 'openrouter':
      return 'OpenRouter'
    case 'anthropic-official':
      return 'Anthropic'
    case 'anthropic-thirdparty':
      return 'Anthropic Third-party API'
    case 'glm-cn':
      return 'GLM (CN)'
    case 'glm-global':
      return 'GLM (Global)'
    case 'kimi':
      return 'Kimi Coding Plan'
    case 'moonshot':
      return 'Moonshot'
    case 'minimax-cn':
      return 'MiniMax (CN)'
    case 'minimax-global':
      return 'MiniMax (Global)'
    case 'volcengine':
      return 'Volcengine Ark'
    case 'xiaomi-mimo':
      return 'Xiaomi MiMo'
    case 'xiaomi-mimo-token-plan':
      return 'Xiaomi MiMo Token Plan'
    case 'bailian':
      return 'Aliyun Bailian'
    case 'bedrock':
      return 'AWS Bedrock'
    case 'vertex':
      return 'Google Vertex'
    case 'deepseek':
      return 'DeepSeek'
    case 'glm':
      return 'GLM'
    case 'ollama':
      return 'Ollama'
    case 'custom':
      return 'Custom OpenAI-Compatible'
    case 'litellm':
      return 'LiteLLM'
    default:
      return providerId
  }
}

function defaultProviders(): Record<string, LlmProviderConfig> {
  return {
    minimax: {
      label: 'MiniMax',
      baseUrl: 'https://api.minimaxi.com/v1',
      apiKey: null,
      models: [],
      defaultModel: null,
    },
    openai: {
      label: 'OpenAI',
      baseUrl: 'https://api.openai.com/v1',
      apiKey: null,
      models: [],
      defaultModel: null,
    },
    openrouter: {
      label: 'OpenRouter',
      baseUrl: 'https://openrouter.ai/api/v1',
      apiKey: null,
      models: [],
      defaultModel: null,
    },
    'anthropic-official': {
      label: 'Anthropic',
      baseUrl: 'https://api.anthropic.com',
      apiKey: null,
      models: [],
      defaultModel: null,
    },
    'anthropic-thirdparty': {
      label: 'Anthropic Third-party API',
      baseUrl: null,
      apiKey: null,
      models: [],
      defaultModel: null,
    },
    'glm-cn': {
      label: 'GLM (CN)',
      baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
      apiKey: null,
      models: [],
      defaultModel: null,
    },
    'glm-global': {
      label: 'GLM (Global)',
      baseUrl: 'https://api.z.ai/api/paas/v4',
      apiKey: null,
      models: [],
      defaultModel: null,
    },
    kimi: {
      label: 'Kimi Coding Plan',
      baseUrl: 'https://api.moonshot.cn/v1',
      apiKey: null,
      models: [],
      defaultModel: null,
    },
    moonshot: {
      label: 'Moonshot',
      baseUrl: 'https://api.moonshot.cn/v1',
      apiKey: null,
      models: [],
      defaultModel: null,
    },
    'minimax-cn': {
      label: 'MiniMax (CN)',
      baseUrl: 'https://api.minimaxi.com/v1',
      apiKey: null,
      models: [],
      defaultModel: null,
    },
    'minimax-global': {
      label: 'MiniMax (Global)',
      baseUrl: 'https://api.minimax.io/v1',
      apiKey: null,
      models: [],
      defaultModel: null,
    },
    volcengine: {
      label: 'Volcengine Ark',
      baseUrl: 'https://ark.cn-beijing.volces.com/api/v3',
      apiKey: null,
      models: [],
      defaultModel: null,
    },
    'xiaomi-mimo': {
      label: 'Xiaomi MiMo',
      baseUrl: 'https://api.xiaomimimo.com/v1',
      apiKey: null,
      models: [],
      defaultModel: null,
    },
    'xiaomi-mimo-token-plan': {
      label: 'Xiaomi MiMo Token Plan',
      baseUrl: 'https://token-plan-cn.xiaomimimo.com/v1',
      apiKey: null,
      models: [],
      defaultModel: null,
    },
    bailian: {
      label: 'Aliyun Bailian',
      baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
      apiKey: null,
      models: [],
      defaultModel: null,
    },
    bedrock: {
      label: 'AWS Bedrock',
      baseUrl: null,
      apiKey: null,
      models: [],
      defaultModel: null,
    },
    vertex: {
      label: 'Google Vertex',
      baseUrl: null,
      apiKey: null,
      models: [],
      defaultModel: null,
    },
    deepseek: {
      label: 'DeepSeek',
      baseUrl: 'https://api.deepseek.com',
      apiKey: null,
      models: [],
      defaultModel: null,
    },
    glm: {
      label: 'GLM',
      baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
      apiKey: null,
      models: [],
      defaultModel: null,
    },
    ollama: {
      label: 'Ollama',
      baseUrl: 'http://localhost:11434/v1',
      apiKey: null,
      models: [],
      defaultModel: null,
    },
    custom: {
      label: 'Custom OpenAI-Compatible',
      baseUrl: null,
      apiKey: null,
      models: [],
      defaultModel: null,
    },
    litellm: {
      label: 'LiteLLM',
      baseUrl: 'http://localhost:4000/v1',
      apiKey: null,
      models: [],
      defaultModel: null,
    },
  }
}

function parseProviderConfig(raw: Record<string, unknown>): LlmProviderConfig {
  return {
    label: typeof raw.label === 'string' ? raw.label : getProviderLabel('custom'),
    baseUrl: typeof raw.baseUrl === 'string' ? raw.baseUrl : null,
    apiKey: typeof raw.apiKey === 'string' ? raw.apiKey : null,
    models: Array.isArray(raw.models) ? raw.models.filter((value): value is string => typeof value === 'string') : [],
    defaultModel: typeof raw.defaultModel === 'string' ? raw.defaultModel : null,
    enabled: typeof raw.enabled === 'boolean' ? raw.enabled : undefined,
  }
}

function normalizeProviderRegistry(
  rawProviders: Record<string, unknown>,
  defaultsInput?: { provider: string | null; model: string | null },
): { defaults: LlmDefaults; providers: Record<string, LlmProviderConfig> } {
  const providers = defaultProviders()
  for (const [providerId, value] of Object.entries(rawProviders)) {
    if (!value || typeof value !== 'object') continue
    const parsed = parseProviderConfig(value as Record<string, unknown>)
    providers[providerId] = {
      ...providers[providerId],
      ...parsed,
      label: typeof (value as Record<string, unknown>).label === 'string' ? parsed.label : getProviderLabel(providerId),
    }
  }

  const provider = defaultsInput?.provider ?? null
  const providerConfig = provider ? providers[provider] : null
  const model = defaultsInput?.model ?? providerConfig?.defaultModel ?? null
  return {
    defaults: {
      provider,
      model,
    },
    providers,
  }
}

function parseMinimaxConfig(jsonText: string): {
  defaults: LlmDefaults
  providers: Record<string, LlmProviderConfig>
} | null {
  try {
    const raw = JSON.parse(jsonText) as unknown
    if (!raw || typeof raw !== 'object') return null
    const obj = raw as Record<string, unknown>

    if (obj.providers && typeof obj.providers === 'object' && obj.defaults && typeof obj.defaults === 'object') {
      const defaultsObj = obj.defaults as Record<string, unknown>
      return normalizeProviderRegistry(obj.providers as Record<string, unknown>, {
        provider: typeof defaultsObj.provider === 'string' ? defaultsObj.provider : null,
        model: typeof defaultsObj.model === 'string' ? defaultsObj.model : null,
      })
    }

    const provider = typeof obj.provider === 'string' ? obj.provider : 'minimax'
    const baseUrl = typeof obj.baseUrl === 'string' ? obj.baseUrl : null
    const model = typeof obj.model === 'string' ? obj.model : null
    const apiKey = typeof obj.apiKey === 'string' ? obj.apiKey : null

    return normalizeProviderRegistry(
      {
        [provider]: {
          label: getProviderLabel(provider),
          baseUrl,
          apiKey,
          models: model ? [model] : [],
          defaultModel: model,
        },
      },
      { provider, model },
    )
  } catch {
    return null
  }
}

function providerRequiresApiKey(providerId: string | null): boolean {
  switch (providerId) {
    case 'ollama':
    case 'custom':
      return false
    default:
      return true
  }
}

function stripProviderSecrets(providers: Record<string, LlmProviderConfig>): Record<string, LlmProviderConfig> {
  return Object.fromEntries(
    Object.entries(providers).map(([providerId, config]) => [
      providerId,
      {
        ...config,
        apiKey: config.apiKey ? '***' : null,
      },
    ]),
  )
}

export async function getConfigPath(deps?: {
  isTauri?: () => boolean
  appConfigDir?: () => Promise<string>
  join?: (...paths: string[]) => Promise<string> | string
}): Promise<string | null> {
  if (!deps) return defaultGetConfigPath()
  if (!deps.isTauri?.()) return null

  const dir = await deps.appConfigDir!()
  return await Promise.resolve(deps.join!(dir, 'circleloop', 'config.json'))
}

export async function loadMinimaxConfig(deps?: {
  isTauri?: () => boolean
  readTextFile?: ReadTextFileFn
  appConfigDir?: () => Promise<string>
  join?: (...paths: string[]) => Promise<string> | string
  getConfigPath?: () => Promise<string | null>
}): Promise<MinimaxConfigStatus> {
  const configPath = await (async () => {
    if (deps?.getConfigPath) return deps.getConfigPath()
    if (deps?.isTauri) {
      return getConfigPath({
        isTauri: deps.isTauri,
        appConfigDir: deps.appConfigDir,
        join: deps.join,
      })
    }
    return defaultGetConfigPath()
  })()
  if (!configPath) return createEmptyMinimaxConfigStatus(null)

  const readTextFile =
    deps?.readTextFile ??
    (async (path: string) => {
      const fs = await import('@tauri-apps/plugin-fs')
      try {
        return await fs.readTextFile(path)
      } catch {
        // Prefer baseDir usage to avoid path/scope issues across platforms.
        return fs.readTextFile('circleloop/config.json', { baseDir: fs.BaseDirectory.AppConfig })
      }
    })

  let text: string
  try {
    text = await readTextFile(configPath)
  } catch {
    return createEmptyMinimaxConfigStatus(configPath)
  }

  const parsed = parseMinimaxConfig(text)
  if (!parsed) return createEmptyMinimaxConfigStatus(configPath)

  const selectedProvider = parsed.defaults.provider
  const selectedConfig = selectedProvider ? parsed.providers[selectedProvider] : null
  const configured = Boolean(
    selectedProvider &&
      selectedConfig?.baseUrl &&
      parsed.defaults.model &&
      (!providerRequiresApiKey(selectedProvider) || selectedConfig.apiKey),
  )

  return {
    configured,
    configPath,
    provider: parsed.defaults.provider,
    baseUrl: selectedConfig?.baseUrl ?? null,
    model: parsed.defaults.model,
    defaults: parsed.defaults,
    providers: parsed.providers,
    getApiKey: (providerId?: string | null) => {
      const targetProvider = providerId ?? parsed.defaults.provider
      if (!targetProvider) return null
      return parsed.providers[targetProvider]?.apiKey ?? null
    },
    toJSON() {
      return {
        configured,
        configPath,
        provider: parsed.defaults.provider,
        baseUrl: selectedConfig?.baseUrl ?? null,
        model: parsed.defaults.model,
        defaults: parsed.defaults,
        providers: stripProviderSecrets(parsed.providers),
      }
    },
  }
}

export async function saveMinimaxConfig(
  input:
    | { baseUrl: string; apiKey: string; model: string; provider?: string }
    | { defaults: LlmDefaults; providers: Record<string, LlmProviderConfig> },
  deps?: {
    isTauri?: () => boolean
    mkdir?: MkdirFn
    writeTextFile?: WriteTextFileFn
  },
): Promise<void> {
  if (deps?.isTauri && !deps.isTauri()) return
  // In production we only support saving from Tauri.
  const fs = await import('@tauri-apps/plugin-fs')
  const mkdir = deps?.mkdir ?? ((p: string, o?: unknown) => fs.mkdir(p, o as any))
  const writeTextFile =
    deps?.writeTextFile ?? ((p: string, c: string, o?: unknown) => fs.writeTextFile(p, c, o as any))

  await mkdir('circleloop', { baseDir: fs.BaseDirectory.AppConfig, recursive: true })
  const normalized =
    'defaults' in input
      ? input
      : {
          defaults: {
            provider: input.provider ?? 'minimax',
            model: input.model,
          },
          providers: normalizeProviderRegistry(
            {
              [input.provider ?? 'minimax']: {
                label: getProviderLabel(input.provider ?? 'minimax'),
                baseUrl: input.baseUrl,
                apiKey: input.apiKey,
                models: input.model ? [input.model] : [],
                defaultModel: input.model,
              },
            },
            {
              provider: input.provider ?? 'minimax',
              model: input.model,
            },
          ).providers,
        }
  await writeTextFile(
    'circleloop/config.json',
    JSON.stringify(
      normalized,
      null,
      2,
    ),
    { baseDir: fs.BaseDirectory.AppConfig },
  )
}
