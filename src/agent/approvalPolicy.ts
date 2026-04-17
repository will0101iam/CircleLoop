import { getCommandPolicyDecision } from './commandPolicy'
import { getPathGuardDecision } from './pathGuard'
import type { ToolDefinition } from '../tools/toolRegistry'

export type ApprovalDecision =
  | { decision: 'allow' }
  | { decision: 'ask'; reason: string; summary: string }
  | { decision: 'deny'; code: string; message: string }

function firstStringArg(args: unknown, keys: string[]) {
  if (!args || typeof args !== 'object') return null
  const record = args as Record<string, unknown>
  for (const key of keys) {
    if (typeof record[key] === 'string') return record[key]
  }
  return null
}

export function getApprovalDecision(input: {
  tool?: Pick<ToolDefinition, 'name' | 'policy'>
  args: unknown
  workspacePath?: string
}): ApprovalDecision {
  const tool = input.tool
  if (!tool) {
    return { decision: 'deny', code: 'TOOL_NOT_FOUND', message: 'Tool metadata not found' }
  }

  if (tool.policy?.requiresWorkspace && !input.workspacePath) {
    return {
      decision: 'ask',
      reason: 'This action requires a workspace so I can access local files safely.',
      summary: 'Select workspace folder',
    }
  }

  const pathArg = firstStringArg(input.args, tool.policy?.pathArgKeys ?? [])
  if (pathArg && input.workspacePath) {
    const pathDecision = getPathGuardDecision({
      workspacePath: input.workspacePath,
      toolName: tool.name,
      relativePath: pathArg,
    })
    if (pathDecision.ok === false) {
      const pathError = pathDecision.error
      return {
        decision: 'deny',
        code: pathError.code,
        message: pathError.message ?? pathError.code,
      }
    }
  }

  if (tool.policy?.commandArgKey && input.args && typeof input.args === 'object') {
    const record = input.args as Record<string, unknown>
    const command = record[tool.policy.commandArgKey]
    const cmdArgs = Array.isArray(record.args) ? record.args.filter((item): item is string => typeof item === 'string') : []
    if (typeof command === 'string') {
      const commandDecision = getCommandPolicyDecision({ command, args: cmdArgs })
      if (commandDecision.decision === 'deny') {
        return {
          decision: 'deny',
          code: commandDecision.code,
          message: commandDecision.message ?? commandDecision.code,
        }
      }
      if (commandDecision.decision === 'ask') {
        return {
          decision: 'ask',
          reason: commandDecision.reason,
          summary: `Execute command: ${command}${cmdArgs.length ? ` ${cmdArgs.join(' ')}` : ''}`,
        }
      }
    }
  }

  const riskLevel = tool.policy?.riskLevel ?? 'safe'
  if (riskLevel === 'deny') {
    return { decision: 'deny', code: 'TOOL_DENIED', message: `Tool ${tool.name} is denied by policy` }
  }
  if (riskLevel === 'ask') {
    return {
      decision: 'ask',
      reason: `Tool ${tool.name} requires user confirmation`,
      summary: pathArg ? `${tool.name}: ${pathArg}` : `Run ${tool.name}`,
    }
  }

  return { decision: 'allow' }
}
