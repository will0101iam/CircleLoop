import type { CreateSessionInput, SessionRecord } from '../domain/session'
import type { ToolResult } from './toolRegistry'

export function createCreateSessionTool(deps: {
  store: { create: (input: CreateSessionInput) => Promise<SessionRecord> }
}) {
  return {
    name: 'create_session',
    description: 'Create a new session. workspacePath may be null until a workspace is selected.',
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        workspacePath: { type: ['string', 'null'] },
      },
      required: ['title'],
      additionalProperties: false,
    },
    policy: { riskLevel: 'safe' as const },
    async handler(args: CreateSessionInput): Promise<ToolResult> {
      const session = await deps.store.create(args)
      return { ok: true, data: session }
    },
  }
}
