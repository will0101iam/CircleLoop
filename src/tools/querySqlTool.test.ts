import { describe, expect, it, vi } from 'vitest'
import { createQuerySqlTool } from './querySqlTool'

describe('query sql tool', () => {
  it('allows read-only select queries and rejects write queries', async () => {
    type Row = { id: string; title: string }
    const query = vi.fn<(sql: string) => Promise<Row[]>>().mockResolvedValue([
      { id: 'session-1', title: 'Fix search' },
    ])

    const tool = createQuerySqlTool({ db: { query } })

    const readResult = await tool.handler({
      sql: 'select id, title from sessions limit 1',
    })

    expect(readResult.ok).toBe(true)
    expect(query).toHaveBeenCalledWith('select id, title from sessions limit 1')
    if (!readResult.ok) throw new Error('expected ok result')
    expect((readResult.data.rows[0] as Row | undefined)?.id).toBe('session-1')

    const writeResult = await tool.handler({
      sql: 'delete from sessions',
    })

    expect(writeResult.ok).toBe(false)
    expect(writeResult.error?.code).toBe('READ_ONLY_SQL_REQUIRED')
  })
})
