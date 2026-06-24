import type { ToolDefinition, ToolResult } from './toolRegistry'

export type UpdatePlanStepStatus = 'pending' | 'active' | 'completed' | 'failed'

export type UpdatePlanStep = {
  id: string
  title: string
  status: UpdatePlanStepStatus
  summary?: string
}

export type UpdatePlanInput = {
  steps: UpdatePlanStep[]
}

const VALID_STATUSES = new Set<UpdatePlanStepStatus>(['pending', 'active', 'completed', 'failed'])

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function validateStep(value: unknown, index: number): ToolResult<UpdatePlanStep> {
  if (!isRecord(value)) {
    return { ok: false, error: { code: 'INVALID_PLAN_STEP', message: `steps[${index}] must be an object` } }
  }
  const id = typeof value.id === 'string' ? value.id.trim() : ''
  const title = typeof value.title === 'string' ? value.title.trim() : ''
  const status = typeof value.status === 'string' ? value.status : ''
  if (!id) return { ok: false, error: { code: 'INVALID_PLAN_STEP_ID', message: `steps[${index}].id is required` } }
  if (!title) return { ok: false, error: { code: 'INVALID_PLAN_STEP_TITLE', message: `steps[${index}].title is required` } }
  if (!VALID_STATUSES.has(status as UpdatePlanStepStatus)) {
    return { ok: false, error: { code: 'INVALID_PLAN_STEP_STATUS', message: `steps[${index}].status is invalid` } }
  }
  const summary = typeof value.summary === 'string' && value.summary.trim() ? value.summary.trim() : undefined
  return { ok: true, data: { id, title, status: status as UpdatePlanStepStatus, ...(summary ? { summary } : {}) } }
}

export function createUpdatePlanTool(): ToolDefinition<UpdatePlanInput, { steps: UpdatePlanStep[] }> {
  return {
    name: 'update_plan',
    description: 'Update the visible task plan checklist for the current run. Use this when your plan changes or step status changes.',
    inputSchema: {
      type: 'object',
      properties: {
        steps: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              title: { type: 'string' },
              status: { type: 'string', enum: ['pending', 'active', 'completed', 'failed'] },
              summary: { type: 'string' },
            },
            required: ['id', 'title', 'status'],
            additionalProperties: false,
          },
        },
      },
      required: ['steps'],
      additionalProperties: false,
    },
    policy: { riskLevel: 'safe' },
    async handler(args: UpdatePlanInput): Promise<ToolResult<{ steps: UpdatePlanStep[] }>> {
      if (!isRecord(args) || !Array.isArray(args.steps)) {
        return { ok: false, error: { code: 'INVALID_PLAN_STEPS', message: 'steps must be an array' } }
      }
      const steps: UpdatePlanStep[] = []
      for (const [index, rawStep] of args.steps.entries()) {
        const result = validateStep(rawStep, index)
        if (!result.ok) return result
        steps.push(result.data)
      }
      return { ok: true, data: { steps } }
    },
  }
}
