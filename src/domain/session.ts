export type SessionStatus = 'idle' | 'running' | 'done' | 'error'

export interface SessionRecord {
  id: string
  title: string
  workspacePath: string | null
  status: SessionStatus
  storage: 'sqlite'
  createdAt: number
}

export interface CreateSessionInput {
  title: string
  workspacePath: string | null
}
