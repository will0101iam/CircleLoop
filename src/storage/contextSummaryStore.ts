import type { SqliteDatabase } from './sqlite'

export type ContextSummaryRecord = {
  id: string
  chatId: string
  summaryJson: string
  sourceMessageCount: number
  createdAt: number
}

export function createContextSummaryStore(deps?: {
  db?: SqliteDatabase
  createId?: () => string
  now?: () => number
}) {
  const db = deps?.db
  const createId = deps?.createId ?? (() => `summary-${Date.now()}-${Math.random().toString(16).slice(2)}`)
  const now = deps?.now ?? (() => Date.now())

  return {
    async save(input: { chatId: string; summaryJson: string; sourceMessageCount: number }) {
      if (!db) {
        return {
          id: createId(),
          chatId: input.chatId,
          summaryJson: input.summaryJson,
          sourceMessageCount: input.sourceMessageCount,
          createdAt: now(),
        }
      }

      const record: ContextSummaryRecord = {
        id: createId(),
        chatId: input.chatId,
        summaryJson: input.summaryJson,
        sourceMessageCount: input.sourceMessageCount,
        createdAt: now(),
      }

      await db.run('delete from context_summaries where chat_id = ?', [input.chatId])
      await db.run(
        'insert into context_summaries (id, chat_id, summary_json, source_message_count, created_at) values (?, ?, ?, ?, ?)',
        [record.id, record.chatId, record.summaryJson, record.sourceMessageCount, record.createdAt],
      )
      return record
    },

    async getLatest(chatId: string): Promise<ContextSummaryRecord | null> {
      if (!db) return null
      const rows = await db.query<ContextSummaryRecord>(
        'select id, chat_id as chatId, summary_json as summaryJson, source_message_count as sourceMessageCount, created_at as createdAt from context_summaries where chat_id = ? order by created_at desc limit 1',
        [chatId],
      )
      return rows[0] ?? null
    },
  }
}
