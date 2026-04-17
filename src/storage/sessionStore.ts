import type { CreateSessionInput, SessionRecord } from '../domain/session'
import type { SqliteDatabase } from './sqlite'
import { applyMigrations } from './migrations'

export function createSessionStore(deps?: {
  db?: SqliteDatabase
  createId?: () => string
  now?: () => number
}) {
  let ensured = false

  async function ensureDbReady() {
    if (ensured) return
    if (!deps?.db) return
    await applyMigrations({ run: deps.db.run, query: deps.db.query })
    ensured = true
  }

  return {
    async create(input: CreateSessionInput): Promise<SessionRecord> {
      await ensureDbReady()

      const session: SessionRecord = {
        id: deps?.createId?.() ?? 'session-1',
        title: input.title,
        workspacePath: input.workspacePath,
        status: 'idle',
        storage: 'sqlite',
        createdAt: deps?.now?.() ?? Date.now(),
      }

      await deps?.db?.run(
        'insert into sessions (id, title, workspace_path, status, storage, created_at) values (?, ?, ?, ?, ?, ?)',
        [
          session.id,
          session.title,
          session.workspacePath,
          session.status,
          session.storage,
          session.createdAt,
        ],
      )

      return session
    },

    async list(input?: { limit?: number }): Promise<SessionRecord[]> {
      await ensureDbReady()
      const limit = input?.limit ?? 50
      const rows = await deps?.db?.query<SessionRecord>(
        'select id, title, workspace_path as workspacePath, status, storage, created_at as createdAt from sessions order by created_at desc limit ?',
        [limit],
      )
      return rows ?? []
    },
  }
}
