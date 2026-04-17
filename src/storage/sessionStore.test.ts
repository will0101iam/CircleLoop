import { describe, expect, it, vi } from 'vitest'
import { createSessionStore } from './sessionStore'

describe('session store', () => {
  it('creates an idle session even when workspace is not bound yet', async () => {
    const store = createSessionStore()

    const session = await store.create({
      title: 'Discuss architecture',
      workspacePath: null,
    })

    expect(session.status).toBe('idle')
    expect(session.workspacePath).toBeNull()
    expect(session.storage).toBe('sqlite')
  })

  it('creates an idle session bound to a workspace and marks sqlite as storage', async () => {
    const store = createSessionStore()

    const session = await store.create({
      title: 'Fix search',
      workspacePath: '/tmp/demo',
    })

    expect(session.status).toBe('idle')
    expect(session.workspacePath).toBe('/tmp/demo')
    expect(session.storage).toBe('sqlite')
    expect(typeof session.createdAt).toBe('number')
  })

  it('persists a new session through the sqlite adapter', async () => {
    const run = vi.fn().mockResolvedValue(undefined)
    const query = vi.fn().mockResolvedValueOnce([{ name: 'workspace_path' }]).mockResolvedValueOnce([{ name: 'workspace_path', notnull: 0 }])
    const store = createSessionStore({
      db: { run, query },
      createId: () => 'session-42',
      now: () => 1710000000000,
    })

    await store.create({
      title: 'Refactor loop',
      workspacePath: '/tmp/project',
    })

    expect(run).toHaveBeenNthCalledWith(
      1,
      'create table if not exists sessions (id text primary key, title text not null, workspace_path text, status text not null, storage text not null, created_at integer not null)',
      [],
    )
    expect(run).toHaveBeenNthCalledWith(
      2,
      'create table if not exists context_summaries (id text primary key, chat_id text not null, summary_json text not null, source_message_count integer not null, created_at integer not null)',
      [],
    )
    expect(run).toHaveBeenNthCalledWith(
      3,
      'create table if not exists chat_threads (id text primary key, title text not null, workspace_path text, messages_json text not null, created_at integer not null, updated_at integer not null)',
      [],
    )
    expect(run).toHaveBeenNthCalledWith(
      4,
      'insert into sessions (id, title, workspace_path, status, storage, created_at) values (?, ?, ?, ?, ?, ?)',
      ['session-42', 'Refactor loop', '/tmp/project', 'idle', 'sqlite', 1710000000000],
    )
  })

  it('persists null workspace_path when session is created before binding', async () => {
    const run = vi.fn().mockResolvedValue(undefined)
    const query = vi.fn().mockResolvedValueOnce([{ name: 'workspace_path' }]).mockResolvedValueOnce([{ name: 'workspace_path', notnull: 0 }])
    const store = createSessionStore({
      db: { run, query },
      createId: () => 'session-unbound',
      now: () => 1710000001000,
    })

    await store.create({
      title: 'Discuss architecture',
      workspacePath: null,
    })

    expect(run).toHaveBeenNthCalledWith(
      4,
      'insert into sessions (id, title, workspace_path, status, storage, created_at) values (?, ?, ?, ?, ?, ?)',
      ['session-unbound', 'Discuss architecture', null, 'idle', 'sqlite', 1710000001000],
    )
  })

  it('lists sessions ordered by created_at desc', async () => {
    const run = vi.fn().mockResolvedValue(undefined)
    const query = vi.fn().mockResolvedValueOnce([
      { name: 'workspace_path' },
    ]).mockResolvedValueOnce([
      { name: 'workspace_path', notnull: 0 },
    ]).mockResolvedValueOnce([
      {
        id: 'session-2',
        title: 'B',
        workspacePath: '/tmp/b',
        status: 'idle',
        storage: 'sqlite',
        createdAt: 2,
      },
      {
        id: 'session-1',
        title: 'A',
        workspacePath: '/tmp/a',
        status: 'idle',
        storage: 'sqlite',
        createdAt: 1,
      },
    ])

    const store = createSessionStore({
      db: { run, query },
    })

    const sessions = await store.list({ limit: 2 })

    expect(run).toHaveBeenNthCalledWith(
      1,
      'create table if not exists sessions (id text primary key, title text not null, workspace_path text, status text not null, storage text not null, created_at integer not null)',
      [],
    )
    expect(run).toHaveBeenNthCalledWith(
      2,
      'create table if not exists context_summaries (id text primary key, chat_id text not null, summary_json text not null, source_message_count integer not null, created_at integer not null)',
      [],
    )
    expect(run).toHaveBeenNthCalledWith(
      3,
      'create table if not exists chat_threads (id text primary key, title text not null, workspace_path text, messages_json text not null, created_at integer not null, updated_at integer not null)',
      [],
    )
    expect(query).toHaveBeenCalledWith(
      'select id, title, workspace_path as workspacePath, status, storage, created_at as createdAt from sessions order by created_at desc limit ?',
      [2],
    )
    expect(sessions[0]?.id).toBe('session-2')
  })
})
