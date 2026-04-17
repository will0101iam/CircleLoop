import { describe, expect, it, vi } from 'vitest'
import { createSqliteDatabase } from './sqlite'

describe('sqlite database', () => {
  it('loads the tauri sqlite database and exposes run and query helpers', async () => {
    const execute = vi.fn().mockResolvedValue({ rowsAffected: 1 })
    const select = vi.fn().mockResolvedValue([{ id: 'session-1' }])
    const load = vi.fn().mockResolvedValue({ execute, select })

    const db = await createSqliteDatabase({
      load,
      path: 'sqlite:circleloop.db',
    })

    await db.run('create table if not exists sessions (id text)', [])
    const rows = await db.query<{ id: string }>('select id from sessions')

    expect(load).toHaveBeenCalledWith('sqlite:circleloop.db')
    expect(execute).toHaveBeenCalledWith(
      'create table if not exists sessions (id text)',
      [],
    )
    expect(rows[0]?.id).toBe('session-1')
  })
})
