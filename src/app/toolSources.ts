export type ToolSource = {
  title: string
  url: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function normalizeSource(value: unknown): ToolSource | null {
  if (!isRecord(value) || typeof value.url !== 'string' || !value.url.trim()) return null
  return {
    title: typeof value.title === 'string' && value.title.trim() ? value.title.trim() : value.url,
    url: value.url,
  }
}

export function extractToolSources(toolName: string, payload: unknown): ToolSource[] {
  if (toolName !== 'tavily_search') return []
  if (!isRecord(payload) || payload.ok !== true || !isRecord(payload.data)) return []

  const explicitSources = Array.isArray(payload.data.sources)
    ? payload.data.sources.map(normalizeSource).filter((source): source is ToolSource => Boolean(source))
    : []
  if (explicitSources.length > 0) return explicitSources

  if (!Array.isArray(payload.data.results)) return []
  return payload.data.results.map(normalizeSource).filter((source): source is ToolSource => Boolean(source))
}
