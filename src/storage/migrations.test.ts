import { describe, expect, it, vi } from 'vitest'
import { applyMigrations } from './migrations'

describe('migrations', () => {
  it('creates sessions table idempotently', async () => {
    const run = vi.fn().mockResolvedValue(undefined)

    await applyMigrations({
      run,
    })

    expect(run).toHaveBeenCalledWith(
      'create table if not exists sessions (id text primary key, title text not null, workspace_path text, status text not null, storage text not null, created_at integer not null)',
      [],
    )
  })

  it('adds workspace_path to legacy chat_threads tables', async () => {
    const run = vi.fn().mockResolvedValue(undefined)
    const query = vi
      .fn()
      .mockResolvedValueOnce([
        { name: 'id' },
        { name: 'title' },
        { name: 'messages_json' },
        { name: 'created_at' },
        { name: 'updated_at' },
      ])
      .mockResolvedValueOnce([{ name: 'workspace_path', notnull: 0 }])

    await applyMigrations({
      run,
      query,
    })

    expect(query).toHaveBeenCalledWith('pragma table_info(chat_threads)', [])
    expect(run).toHaveBeenCalledWith('alter table chat_threads add column workspace_path text', [])
  })


  it('adds pin metadata columns to legacy chat_threads tables', async () => {
    const run = vi.fn().mockResolvedValue(undefined)
    const query = vi
      .fn()
      .mockResolvedValueOnce([
        { name: 'id' },
        { name: 'title' },
        { name: 'workspace_path' },
        { name: 'messages_json' },
        { name: 'created_at' },
        { name: 'updated_at' },
      ])
      .mockResolvedValueOnce([{ name: 'workspace_path', notnull: 0 }])

    await applyMigrations({
      run,
      query,
    })

    expect(run).toHaveBeenCalledWith('alter table chat_threads add column pinned_at integer', [])
    expect(run).toHaveBeenCalledWith('alter table chat_threads add column last_activated_at integer', [])
  })
  it('rebuilds legacy sessions tables whose workspace_path is still not-null', async () => {
    const run = vi.fn().mockResolvedValue(undefined)
    const query = vi
      .fn()
      .mockResolvedValueOnce([{ name: 'workspace_path' }])
      .mockResolvedValueOnce([
        { name: 'id', notnull: 0 },
        { name: 'title', notnull: 1 },
        { name: 'workspace_path', notnull: 1 },
        { name: 'status', notnull: 1 },
        { name: 'storage', notnull: 1 },
        { name: 'created_at', notnull: 1 },
      ])

    await applyMigrations({
      run,
      query,
    })

    expect(query).toHaveBeenCalledWith('pragma table_info(sessions)', [])
    expect(run).toHaveBeenCalledWith('alter table sessions rename to sessions_legacy_workspace_required', [])
    expect(run).toHaveBeenCalledWith(
      'insert into sessions (id, title, workspace_path, status, storage, created_at) select id, title, workspace_path, status, storage, created_at from sessions_legacy_workspace_required',
      [],
    )
    expect(run).toHaveBeenCalledWith('drop table sessions_legacy_workspace_required', [])
  })
})
