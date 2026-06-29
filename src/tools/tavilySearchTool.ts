import type { ToolDefinition, ToolResult } from './toolRegistry'

export type TavilySearchDepth = 'basic' | 'advanced' | 'fast' | 'ultra-fast'
export type TavilySearchTopic = 'general' | 'news' | 'finance'

export type TavilySearchArgs = {
  query: string
  maxResults?: number
  searchDepth?: TavilySearchDepth
  topic?: TavilySearchTopic
  includeAnswer?: boolean
  includeRawContent?: boolean
  includeDomains?: string[]
  excludeDomains?: string[]
}

export type TavilySearchResultItem = {
  title: string
  url: string
  content: string
  score?: number
  rawContent?: string | null
  favicon?: string
}

export type TavilySearchSource = {
  title: string
  url: string
}

export type TavilySearchResult = {
  query: string
  answer?: string
  results: TavilySearchResultItem[]
  sources: TavilySearchSource[]
  responseTime?: number
  requestId?: string
}

type FetchLike = typeof fetch

function clampInt(n: unknown, fallback: number, min: number, max: number) {
  if (typeof n !== 'number' || !Number.isFinite(n)) return fallback
  const i = Math.trunc(n)
  if (i < min) return min
  if (i > max) return max
  return i
}

function stringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined
  const items = value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
  return items.length > 0 ? items : undefined
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function normalizeResponse(raw: unknown): TavilySearchResult {
  const record = isRecord(raw) ? raw : {}
  const rawResults = Array.isArray(record.results) ? record.results : []
  const results = rawResults.filter(isRecord).map((item) => ({
    title: typeof item.title === 'string' ? item.title : '',
    url: typeof item.url === 'string' ? item.url : '',
    content: typeof item.content === 'string' ? item.content : '',
    ...(typeof item.score === 'number' ? { score: item.score } : {}),
    ...(typeof item.raw_content === 'string' || item.raw_content === null ? { rawContent: item.raw_content } : {}),
    ...(typeof item.favicon === 'string' ? { favicon: item.favicon } : {}),
  }))
  return {
    query: typeof record.query === 'string' ? record.query : '',
    ...(typeof record.answer === 'string' ? { answer: record.answer } : {}),
    results,
    sources: results
      .filter((item) => item.url)
      .map((item) => ({
        title: item.title || item.url,
        url: item.url,
      })),
    ...(typeof record.response_time === 'number' ? { responseTime: record.response_time } : {}),
    ...(typeof record.request_id === 'string' ? { requestId: record.request_id } : {}),
  }
}

export function createTavilySearchTool(deps: {
  apiKey: string
  fetch?: FetchLike
  baseUrl?: string
}): ToolDefinition<TavilySearchArgs, TavilySearchResult> {
  return {
    name: 'tavily_search',
    description: 'Search the live web with Tavily and return concise source results for current information.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string' },
        maxResults: { type: 'number', minimum: 1, maximum: 20 },
        searchDepth: { type: 'string', enum: ['basic', 'advanced', 'fast', 'ultra-fast'] },
        topic: { type: 'string', enum: ['general', 'news', 'finance'] },
        includeAnswer: { type: 'boolean' },
        includeRawContent: { type: 'boolean' },
        includeDomains: { type: 'array', items: { type: 'string' } },
        excludeDomains: { type: 'array', items: { type: 'string' } },
      },
      required: ['query'],
      additionalProperties: false,
    },
    policy: { riskLevel: 'safe' },
    async handler(args: TavilySearchArgs): Promise<ToolResult<TavilySearchResult>> {
      const query = typeof args.query === 'string' ? args.query.trim() : ''
      if (!query) {
        return { ok: false, error: { code: 'INVALID_QUERY', message: 'query is required' } }
      }

      const body: Record<string, unknown> = {
        query,
        max_results: clampInt(args.maxResults, 5, 1, 20),
        search_depth: args.searchDepth ?? 'basic',
        topic: args.topic ?? 'general',
        include_answer: args.includeAnswer === true,
        include_raw_content: args.includeRawContent === true,
      }
      const includeDomains = stringArray(args.includeDomains)
      const excludeDomains = stringArray(args.excludeDomains)
      if (includeDomains) body.include_domains = includeDomains
      if (excludeDomains) body.exclude_domains = excludeDomains

      const requestFetch = deps.fetch ?? fetch
      const response = await requestFetch(`${deps.baseUrl ?? 'https://api.tavily.com'}/search`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${deps.apiKey}`,
        },
        body: JSON.stringify(body),
      })

      if (!response.ok) {
        return {
          ok: false,
          error: {
            code: 'TAVILY_REQUEST_FAILED',
            message: `Tavily request failed: ${response.status}`,
          },
        }
      }

      return { ok: true, data: normalizeResponse(await response.json()) }
    },
  }
}
