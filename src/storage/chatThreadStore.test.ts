import { describe, expect, it, vi } from 'vitest'
import { createAssistantMessage, createUserMessage, type ThreadMessage } from '../app/runMessages'
import { createChatThreadStore } from './chatThreadStore'

describe('chatThreadStore', () => {
  it('persists and restores chat threads with messages', async () => {
    const run = vi.fn().mockResolvedValue(undefined)
    const query = vi
      .fn()
      .mockResolvedValueOnce([
        { name: 'workspace_path' },
        { name: 'pinned_at' },
        { name: 'last_activated_at' },
        { name: 'llm_provider' },
        { name: 'llm_model' },
      ])
      .mockResolvedValueOnce([{ name: 'workspace_path', notnull: 0 }])
      .mockResolvedValueOnce([
        {
          id: 'c1',
          title: 'New Chat',
          workspacePath: null,
          pinnedAt: 12,
          lastActivatedAt: 34,
          llmProvider: 'openrouter',
          llmModel: 'gpt-4o-mini',
          messagesJson: JSON.stringify([
            createAssistantMessage('a1', 'hello', '10:00'),
            createUserMessage('u1', 'hi', '10:01'),
          ] satisfies ThreadMessage[]),
          createdAt: 1,
          updatedAt: 2,
        },
      ])

    const store = createChatThreadStore({
      db: { run, query },
      now: () => 2,
    })

    const loaded = await store.loadAll()

    expect(run).toHaveBeenCalledWith(
      'create table if not exists chat_threads (id text primary key, title text not null, workspace_path text, pinned_at integer, last_activated_at integer, llm_provider text, llm_model text, messages_json text not null, created_at integer not null, updated_at integer not null)',
      [],
    )
    expect(loaded.chats).toEqual([
      {
        id: 'c1',
        title: 'New Chat',
        workspacePath: null,
        pinnedAt: 12,
        lastActivatedAt: 34,
        llmProvider: 'openrouter',
        llmModel: 'gpt-4o-mini',
      },
    ])
    expect(loaded.chatMessages.c1?.[0]).toMatchObject({ kind: 'assistant', text: 'hello' })
  })

  it('replaces prior stored thread snapshot on save', async () => {
    const run = vi.fn().mockResolvedValue(undefined)
    const query = vi
      .fn()
      .mockResolvedValueOnce([
        { name: 'workspace_path' },
        { name: 'pinned_at' },
        { name: 'last_activated_at' },
        { name: 'llm_provider' },
        { name: 'llm_model' },
      ])
      .mockResolvedValueOnce([{ name: 'workspace_path', notnull: 0 }])
      .mockResolvedValueOnce([])
    const store = createChatThreadStore({
      db: { run, query },
      now: () => 3,
    })

    await store.saveAll({
      chats: [{ id: 'c1', title: 'Chat 1', workspacePath: null, pinnedAt: 99, lastActivatedAt: 123, llmProvider: 'openrouter', llmModel: 'gpt-4o-mini' }],
      chatMessages: {
        c1: [createUserMessage('u1', 'persist me', '10:00')],
      },
    })

    expect(run).toHaveBeenNthCalledWith(
      2,
      'create table if not exists context_summaries (id text primary key, chat_id text not null, summary_json text not null, source_message_count integer not null, created_at integer not null)',
      [],
    )
    expect(run).toHaveBeenNthCalledWith(
      3,
      'create table if not exists chat_threads (id text primary key, title text not null, workspace_path text, pinned_at integer, last_activated_at integer, llm_provider text, llm_model text, messages_json text not null, created_at integer not null, updated_at integer not null)',
      [],
    )
    expect(run).toHaveBeenNthCalledWith(
      4,
      'insert or replace into chat_threads (id, title, workspace_path, pinned_at, last_activated_at, llm_provider, llm_model, messages_json, created_at, updated_at) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      ['c1', 'Chat 1', null, 99, 123, 'openrouter', 'gpt-4o-mini', JSON.stringify([createUserMessage('u1', 'persist me', '10:00')]), 3, 3],
    )
  })

  it('persists pin metadata so reload keeps pinned and unpinned ordering inputs', async () => {
    const run = vi.fn().mockResolvedValue(undefined)
    const query = vi
      .fn()
      .mockResolvedValueOnce([
        { name: 'workspace_path' },
        { name: 'pinned_at' },
        { name: 'last_activated_at' },
        { name: 'llm_provider' },
        { name: 'llm_model' },
      ])
      .mockResolvedValueOnce([{ name: 'workspace_path', notnull: 0 }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          id: 'c1',
          title: 'Pinned',
          workspacePath: null,
          pinnedAt: 500,
          lastActivatedAt: 10,
          llmProvider: 'minimax',
          llmModel: 'MiniMax-M2.7',
          messagesJson: JSON.stringify([]),
          createdAt: 1,
          updatedAt: 20,
        },
        {
          id: 'c2',
          title: 'Recent',
          workspacePath: null,
          pinnedAt: null,
          lastActivatedAt: 400,
          llmProvider: 'ollama',
          llmModel: 'llama3.1',
          messagesJson: JSON.stringify([]),
          createdAt: 2,
          updatedAt: 19,
        },
      ])
    const store = createChatThreadStore({
      db: { run, query },
      now: () => 20,
    })

    await store.saveAll({
      chats: [
        { id: 'c1', title: 'Pinned', workspacePath: null, pinnedAt: 500, lastActivatedAt: 10, llmProvider: 'minimax', llmModel: 'MiniMax-M2.7' },
        { id: 'c2', title: 'Recent', workspacePath: null, pinnedAt: null, lastActivatedAt: 400, llmProvider: 'ollama', llmModel: 'llama3.1' },
      ],
      chatMessages: {
        c1: [],
        c2: [],
      },
    })

    const loaded = await store.loadAll()

    expect(loaded.chats).toEqual([
      { id: 'c1', title: 'Pinned', workspacePath: null, pinnedAt: 500, lastActivatedAt: 10, llmProvider: 'minimax', llmModel: 'MiniMax-M2.7' },
      { id: 'c2', title: 'Recent', workspacePath: null, pinnedAt: null, lastActivatedAt: 400, llmProvider: 'ollama', llmModel: 'llama3.1' },
    ])
  })

  it('only refreshes updated_at for changed chats and keeps latest changed chat first on reload', async () => {
    const run = vi.fn().mockResolvedValue(undefined)
    const query = vi
      .fn()
      .mockResolvedValueOnce([
        { name: 'workspace_path' },
        { name: 'pinned_at' },
        { name: 'last_activated_at' },
        { name: 'llm_provider' },
        { name: 'llm_model' },
      ])
      .mockResolvedValueOnce([{ name: 'workspace_path', notnull: 0 }])
      .mockResolvedValueOnce([
        {
          id: 'c1',
          title: 'Older',
          workspacePath: null,
          pinnedAt: null,
          lastActivatedAt: 1,
          messagesJson: JSON.stringify([createUserMessage('u1', 'same', '10:00')]),
          createdAt: 1,
          updatedAt: 1,
        },
        {
          id: 'c2',
          title: 'Recent',
          workspacePath: '/tmp/recent',
          pinnedAt: null,
          lastActivatedAt: 2,
          messagesJson: JSON.stringify([createUserMessage('u2', 'changed old', '10:01')]),
          createdAt: 2,
          updatedAt: 2,
        },
      ])
      .mockResolvedValueOnce([
        {
          id: 'c2',
          title: 'Recent',
          workspacePath: '/tmp/recent',
          pinnedAt: null,
          lastActivatedAt: 10,
          messagesJson: JSON.stringify([createUserMessage('u2', 'changed new', '10:02')]),
          createdAt: 2,
          updatedAt: 10,
        },
        {
          id: 'c1',
          title: 'Older',
          workspacePath: null,
          pinnedAt: null,
          lastActivatedAt: 1,
          messagesJson: JSON.stringify([createUserMessage('u1', 'same', '10:00')]),
          createdAt: 1,
          updatedAt: 1,
        },
      ])

    const store = createChatThreadStore({
      db: { run, query },
      now: () => 10,
    })

    await store.saveAll({
      chats: [
        { id: 'c1', title: 'Older', workspacePath: null },
        { id: 'c2', title: 'Recent', workspacePath: '/tmp/recent' },
      ],
      chatMessages: {
        c1: [createUserMessage('u1', 'same', '10:00')],
        c2: [createUserMessage('u2', 'changed new', '10:02')],
      },
    })

    const loaded = await store.loadAll()

    expect(loaded.chats.map((chat) => chat.id)).toEqual(['c2', 'c1'])
    expect(loaded.chats[0]?.workspacePath).toBe('/tmp/recent')
  })
})
