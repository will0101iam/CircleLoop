import { describe, expect, it, vi } from 'vitest'
import { createTavilySearchTool } from './tavilySearchTool'

describe('createTavilySearchTool', () => {
  it('calls Tavily search with bearer auth and normalized parameters', async () => {
    const fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          query: 'latest agent tooling',
          answer: 'Agent tooling is evolving quickly.',
          results: [
            {
              title: 'Agent tools',
              url: 'https://example.com/tools',
              content: 'A useful overview.',
              score: 0.92,
              raw_content: 'Raw page content',
              favicon: 'https://example.com/favicon.ico',
            },
          ],
          response_time: 1.23,
          request_id: 'req_123',
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    )

    const tool = createTavilySearchTool({ apiKey: 'tvly-secret', fetch })
    const result = await tool.handler({
      query: 'latest agent tooling',
      maxResults: 3,
      searchDepth: 'advanced',
      topic: 'news',
      includeAnswer: true,
      includeRawContent: true,
      includeDomains: ['example.com'],
      excludeDomains: ['spam.example'],
    })

    expect(fetch).toHaveBeenCalledWith(
      'https://api.tavily.com/search',
      expect.objectContaining({
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer tvly-secret',
        },
      }),
    )
    const body = JSON.parse(fetch.mock.calls[0][1].body)
    expect(body).toEqual({
      query: 'latest agent tooling',
      max_results: 3,
      search_depth: 'advanced',
      topic: 'news',
      include_answer: true,
      include_raw_content: true,
      include_domains: ['example.com'],
      exclude_domains: ['spam.example'],
    })
    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error('expected ok')
    expect(result.data.results[0]).toEqual({
      title: 'Agent tools',
      url: 'https://example.com/tools',
      content: 'A useful overview.',
      score: 0.92,
      rawContent: 'Raw page content',
      favicon: 'https://example.com/favicon.ico',
    })
    expect(result.data.sources).toEqual([
      {
        title: 'Agent tools',
        url: 'https://example.com/tools',
      },
    ])
    expect(JSON.stringify(result.data)).not.toContain('tvly-secret')
  })

  it('rejects empty queries before calling Tavily', async () => {
    const fetch = vi.fn()
    const tool = createTavilySearchTool({ apiKey: 'tvly-secret', fetch })

    const result = await tool.handler({ query: '   ' })

    expect(result).toEqual({ ok: false, error: { code: 'INVALID_QUERY', message: 'query is required' } })
    expect(fetch).not.toHaveBeenCalled()
  })
})
