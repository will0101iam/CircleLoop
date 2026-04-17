export type MinimaxConfigStatus = {
  configured: boolean
  configPath: string | null
  provider: string | null
  baseUrl: string | null
  model: string | null
  getApiKey: () => string | null
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

function emptyStatus(configPath: string | null): MinimaxConfigStatus {
  return {
    configured: false,
    configPath,
    provider: null,
    baseUrl: null,
    model: null,
    getApiKey: () => null,
  }
}

function parseMinimaxConfig(jsonText: string): {
  provider: string | null
  baseUrl: string | null
  model: string | null
  apiKey: string | null
} | null {
  try {
    const raw = JSON.parse(jsonText) as unknown
    if (!raw || typeof raw !== 'object') return null
    const obj = raw as Record<string, unknown>

    const provider = typeof obj.provider === 'string' ? obj.provider : 'minimax'
    const baseUrl = typeof obj.baseUrl === 'string' ? obj.baseUrl : null
    const model = typeof obj.model === 'string' ? obj.model : null
    const apiKey = typeof obj.apiKey === 'string' ? obj.apiKey : null

    return { provider, baseUrl, model, apiKey }
  } catch {
    return null
  }
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
  if (!configPath) return emptyStatus(null)

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
    return emptyStatus(configPath)
  }

  const parsed = parseMinimaxConfig(text)
  if (!parsed) return emptyStatus(configPath)

  const configured = Boolean(parsed.apiKey && parsed.baseUrl && parsed.model)

  return {
    configured,
    configPath,
    provider: parsed.provider,
    baseUrl: parsed.baseUrl,
    model: parsed.model,
    getApiKey: () => parsed.apiKey,
  }
}

export async function saveMinimaxConfig(
  input: { baseUrl: string; apiKey: string; model: string; provider?: string },
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
  await writeTextFile(
    'circleloop/config.json',
    JSON.stringify(
      {
        provider: input.provider ?? 'minimax',
        baseUrl: input.baseUrl,
        apiKey: input.apiKey,
        model: input.model,
      },
      null,
      2,
    ),
    { baseDir: fs.BaseDirectory.AppConfig },
  )
}
