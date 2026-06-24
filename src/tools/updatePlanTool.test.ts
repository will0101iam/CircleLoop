import { describe, expect, it } from 'vitest'
import { createUpdatePlanTool } from './updatePlanTool'

describe('update plan tool', () => {
  it('normalizes valid plan steps', async () => {
    const tool = createUpdatePlanTool()

    const result = await tool.handler({
      steps: [
        { id: 'context', title: 'Read files', status: 'active', summary: 'Checking App.tsx' },
        { id: 'verify', title: 'Run tests', status: 'pending' },
      ],
    })

    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error('expected ok')
    expect(result.data.steps).toEqual([
      { id: 'context', title: 'Read files', status: 'active', summary: 'Checking App.tsx' },
      { id: 'verify', title: 'Run tests', status: 'pending' },
    ])
  })

  it('rejects invalid step status', async () => {
    const tool = createUpdatePlanTool()

    const result = await tool.handler({
      steps: [{ id: 'context', title: 'Read files', status: 'running' }],
    })

    expect(result.ok).toBe(false)
    expect(result.ok === false && result.error.code).toBe('INVALID_PLAN_STEP_STATUS')
  })
})
