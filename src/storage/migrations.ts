export async function applyMigrations(deps: {
  run: (sql: string, params?: unknown[]) => Promise<void>
  query?: <T>(sql: string, params?: unknown[]) => Promise<T[]>
}) {
  await deps.run(
    'create table if not exists sessions (id text primary key, title text not null, workspace_path text, status text not null, storage text not null, created_at integer not null)',
    [],
  )
  await deps.run(
    'create table if not exists context_summaries (id text primary key, chat_id text not null, summary_json text not null, source_message_count integer not null, created_at integer not null)',
    [],
  )
  await deps.run(
    'create table if not exists chat_threads (id text primary key, title text not null, workspace_path text, messages_json text not null, created_at integer not null, updated_at integer not null)',
    [],
  )

  if (!deps.query) return

  const chatThreadColumns = await deps.query<Array<{ name: string }>[number]>('pragma table_info(chat_threads)', [])
  const hasWorkspacePath = chatThreadColumns.some((column) => column.name === 'workspace_path')
  if (!hasWorkspacePath) {
    await deps.run('alter table chat_threads add column workspace_path text', [])
  }

  const sessionColumns = await deps.query<Array<{ name: string; notnull: number }>[number]>('pragma table_info(sessions)', [])
  const workspacePathColumn = sessionColumns.find((column) => column.name === 'workspace_path')
  if (workspacePathColumn?.notnull === 1) {
    await deps.run('alter table sessions rename to sessions_legacy_workspace_required', [])
    await deps.run(
      'create table sessions (id text primary key, title text not null, workspace_path text, status text not null, storage text not null, created_at integer not null)',
      [],
    )
    await deps.run(
      'insert into sessions (id, title, workspace_path, status, storage, created_at) select id, title, workspace_path, status, storage, created_at from sessions_legacy_workspace_required',
      [],
    )
    await deps.run('drop table sessions_legacy_workspace_required', [])
  }
}
