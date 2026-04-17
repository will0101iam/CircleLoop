import Database from '@tauri-apps/plugin-sql'

export interface SqliteDatabase {
  run: (sql: string, params?: unknown[]) => Promise<void>
  query: <T>(sql: string, params?: unknown[]) => Promise<T[]>
}

export async function createSqliteDatabase(deps?: {
  load?: (path: string) => Promise<{
    execute: (sql: string, params?: unknown[]) => Promise<unknown>
    select: <T>(sql: string, params?: unknown[]) => Promise<T[]>
  }>
  path?: string
}): Promise<SqliteDatabase> {
  const load = deps?.load ?? Database.load
  const path = deps?.path ?? 'sqlite:circleloop.db'
  const db = await load(path)

  return {
    async run(sql, params: unknown[] = []) {
      await db.execute(sql, params)
    },
    async query<T>(sql: string, params: unknown[] = []) {
      return db.select<T>(sql, params)
    },
  }
}
