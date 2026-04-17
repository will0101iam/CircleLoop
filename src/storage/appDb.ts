import type { SqliteDatabase } from './sqlite'
import { createSqliteDatabase } from './sqlite'
import { applyMigrations } from './migrations'

export async function createAppDb(deps?: {
  createSqliteDatabase?: (deps?: { path?: string }) => Promise<SqliteDatabase>
  sqlitePath?: string
}): Promise<SqliteDatabase> {
  const sqlitePath = deps?.sqlitePath ?? 'sqlite:circleloop.db'
  const create = deps?.createSqliteDatabase ?? ((d?: { path?: string }) => createSqliteDatabase(d))
  const db = await create({ path: sqlitePath })

  await applyMigrations({ run: db.run, query: db.query })

  return db
}
