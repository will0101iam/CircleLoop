import type { ToolResult } from './toolRegistry'
import type { CommandOps } from './fileOps'

export function createExecuteCommandTool(deps: { commandOps: CommandOps }) {
  return {
    name: 'execute_command',
    description:
      'Execute a shell command in the working directory and return stdout/stderr. Useful for running build tools, package managers, tests, git operations, etc. Prefer specific file tools when available.',
    inputSchema: {
      type: 'object',
      properties: {
        command: { type: 'string', description: 'The command to execute (e.g., "npm", "git", "python")' },
        args: {
          type: 'array',
          items: { type: 'string' },
          description: 'Arguments to pass to the command',
        },
      },
      required: ['command'],
      additionalProperties: false,
    },
    policy: { riskLevel: 'ask' as const, requiresWorkspace: true, commandArgKey: 'command' },
    async handler(args: { command: string; args?: string[] }): Promise<ToolResult> {
      if (!args.command || typeof args.command !== 'string' || args.command.trim().length === 0) {
        return { ok: false, error: { code: 'INVALID_COMMAND', message: 'command is required and must be a non-empty string' } }
      }

      try {
        const result = await deps.commandOps.execute(args.command, args.args)

        if (result.code === 0) {
          return {
            ok: true,
            data: {
              exitCode: result.code,
              stdout: result.stdout,
              stderr: result.stderr,
            },
          }
        }

        return {
          ok: false,
          error: {
            code: 'COMMAND_FAILED',
            message: `Exit code ${result.code}${result.stderr ? `\nstderr: ${result.stderr.slice(0, 500)}` : ''}`,
          },
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        return { ok: false, error: { code: 'EXECUTION_ERROR', message } }
      }
    },
  }
}
