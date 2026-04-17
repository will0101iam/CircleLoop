import type { ThreadMessage } from '../app/runMessages'
import type { SqliteDatabase } from './sqlite'
import { applyMigrations } from './migrations'

export type ChatSummaryRecord = { id: string; title: string; workspacePath: string | null }

export function createChatThreadStore(deps?: {
  db?: SqliteDatabase
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
    async loadAll(): Promise<{ chats: ChatSummaryRecord[]; chatMessages: Record<string, ThreadMessage[]> }> {
      await ensureDbReady()
      const rows =
        (await deps?.db?.query<Array<{ id: string; title: string; workspacePath: string | null; messagesJson: string }>[number]>(
          'select id, title, workspace_path as workspacePath, messages_json as messagesJson from chat_threads order by updated_at desc',
          [],
        )) ?? []

      const chats = rows.map((row) => ({ id: row.id, title: row.title, workspacePath: row.workspacePath ?? null }))
      const chatMessages = Object.fromEntries(
        rows.map((row) => {
          let parsed: ThreadMessage[] = []
          try {
            parsed = JSON.parse(row.messagesJson) as ThreadMessage[]
          } catch {
            parsed = []
          }
          return [row.id, parsed]
        }),
      )
      return { chats, chatMessages }
    },

    async saveAll(input: { chats: ChatSummaryRecord[]; chatMessages: Record<string, ThreadMessage[]> }) {
      await ensureDbReady()
      if (!deps?.db) return
      const now = deps.now?.() ?? Date.now()
      const existingRows =
        (await deps.db.query<
          Array<{ id: string; title: string; workspacePath: string | null; messagesJson: string; createdAt: number; updatedAt: number }>[number]
        >(
          'select id, title, workspace_path as workspacePath, messages_json as messagesJson, created_at as createdAt, updated_at as updatedAt from chat_threads',
          [],
        )) ?? []
      const existingById = new Map(existingRows.map((row) => [row.id, row]))
      const nextIds = new Set(input.chats.map((chat) => chat.id))

      for (const existing of existingRows) {
        if (!nextIds.has(existing.id)) {
          await deps.db.run('delete from chat_threads where id = ?', [existing.id])
        }
      }

      for (const chat of input.chats) {
        const messagesJson = JSON.stringify(input.chatMessages[chat.id] ?? [])
        const existing = existingById.get(chat.id)
        const unchanged =
          existing &&
          existing.title === chat.title &&
          existing.workspacePath === chat.workspacePath &&
          existing.messagesJson === messagesJson
        const createdAt = existing?.createdAt ?? now
        const updatedAt = unchanged ? existing.updatedAt : now
        await deps.db.run(
          'insert or replace into chat_threads (id, title, workspace_path, messages_json, created_at, updated_at) values (?, ?, ?, ?, ?, ?)',
          [chat.id, chat.title, chat.workspacePath, messagesJson, createdAt, updatedAt],
        )
      }
    },
  }
}
