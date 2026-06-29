import { describe, expect, it } from 'vitest'
import { extractToolSources } from './toolSources'

describe('extractToolSources', () => {
  it('extracts Tavily source URLs from a successful tool result payload', () => {
    expect(
      extractToolSources('tavily_search', {
        ok: true,
        data: {
          results: [
            { title: 'A', url: 'https://example.com/a' },
            { title: 'B', url: 'https://example.com/b' },
          ],
        },
      }),
    ).toEqual([
      { title: 'A', url: 'https://example.com/a' },
      { title: 'B', url: 'https://example.com/b' },
    ])
  })

  it('ignores non-search tools and failed payloads', () => {
    expect(extractToolSources('read_file', { ok: true, data: { results: [{ title: 'A', url: 'https://example.com/a' }] } })).toEqual([])
    expect(extractToolSources('tavily_search', { ok: false, error: { code: 'FAILED' } })).toEqual([])
  })
})
