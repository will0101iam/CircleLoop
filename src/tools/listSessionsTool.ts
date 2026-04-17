import type { SessionRecord } from '../domain/session'
import type { ToolResult } from './toolRegistry'

export function createListSessionsTool(deps: {
  store: { list: (input: { limit: number }) => Promise<SessionRecord[]> }
}) {
  return {
    name: 'list_sessions',
    description: 'List recent sessions in descending creation time.',
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'number' },
      },
      additionalProperties: false,
    },
    policy: { riskLevel: 'safe' as const },
    async handler(args: { limit?: number }): Promise<ToolResult> {
      const limit = args.limit ?? 50
      const sessions = await deps.store.list({ limit })
      return { ok: true, data: { sessions } }
    },
  }
}
