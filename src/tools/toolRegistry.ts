type ToolOk<T> = { ok: true; data: T }
type ToolErr = { ok: false; error: { code: string; message?: string } }

export type ToolResult<T = unknown> = ToolOk<T> | ToolErr

export type ToolRiskLevel = 'safe' | 'ask' | 'deny'

export type ToolPolicyMeta = {
  riskLevel?: ToolRiskLevel
  requiresWorkspace?: boolean
  pathArgKeys?: string[]
  commandArgKey?: string
}

export type ToolDefinition<TArgs = unknown, TData = unknown> = {
  name: string
  description?: string
  inputSchema?: unknown
  policy?: ToolPolicyMeta
  handler: (args: TArgs) => Promise<ToolResult<TData>>
}

export function createToolRegistry() {
  const tools = new Map<string, ToolDefinition<unknown, unknown>>()

  return {
    register<TArgs, TData>(tool: ToolDefinition<TArgs, TData>) {
      tools.set(tool.name, tool as unknown as ToolDefinition<unknown, unknown>)
    },
    async execute(name: string, args: unknown): Promise<ToolResult> {
      const tool = tools.get(name)
      if (!tool) {
        return { ok: false, error: { code: 'TOOL_NOT_FOUND', message: `Tool not found: ${name}` } }
      }
      return tool.handler(args)
    },
    get(name: string): ToolDefinition<unknown, unknown> | undefined {
      return tools.get(name)
    },
    list(): Array<ToolDefinition<unknown, unknown>> {
      return Array.from(tools.values())
    },
  }
}
