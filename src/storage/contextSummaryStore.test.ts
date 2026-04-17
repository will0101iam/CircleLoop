import { describe, expect, it, vi } from 'vitest'
import { createContextSummaryStore } from './contextSummaryStore'

describe('context summary store', () => {
  it('replaces the previous summary for the same chat', async () => {
    const run = vi.fn().mockResolvedValue(undefined)
    const query = vi.fn().mockResolvedValue([
      {
        id: 'summary-2',
        chatId: 'chat-1',
        summaryJson: '{"nextStep":"continue"}',
        sourceMessageCount: 8,
        createdAt: 20,
      },
    ])

    const store = createContextSummaryStore({
      db: { run, query },
      createId: () => 'summary-2',
      now: () => 20,
    })

    await store.save({
      chatId: 'chat-1',
      summaryJson: '{"nextStep":"continue"}',
      sourceMessageCount: 8,
    })
    const latest = await store.getLatest('chat-1')

    expect(run).toHaveBeenNthCalledWith(1, 'delete from context_summaries where chat_id = ?', ['chat-1'])
    expect(run).toHaveBeenNthCalledWith(
      2,
      'insert into context_summaries (id, chat_id, summary_json, source_message_count, created_at) values (?, ?, ?, ?, ?)',
      ['summary-2', 'chat-1', '{"nextStep":"continue"}', 8, 20],
    )
    expect(latest?.chatId).toBe('chat-1')
  })
})
