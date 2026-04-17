import { describe, expect, it, vi } from 'vitest'
import { createAppDb } from './appDb'

describe('app db', () => {
  it('loads sqlite db and applies migrations', async () => {
    const run = vi.fn().mockResolvedValue(undefined)
    const query = vi.fn().mockResolvedValue([])
    const createSqliteDatabase = vi.fn().mockResolvedValue({ run, query })

    const db = await createAppDb({
      createSqliteDatabase,
      sqlitePath: 'sqlite:circleloop-test.db',
    })

    expect(createSqliteDatabase).toHaveBeenCalledWith({ path: 'sqlite:circleloop-test.db' })
    expect(run).toHaveBeenCalled()
    expect(db).toHaveProperty('run')
    expect(db).toHaveProperty('query')
  })
})

