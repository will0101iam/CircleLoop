# Agent Task Plan Design

Date: 2026-05-12

## Goal

Add a lightweight task plan layer to CircleLoop runs so engineering tasks can show a stable checklist of intended work, current progress, completed steps, and failures.

## Why This Comes First

CircleLoop already has a basic coding-agent loop: model calls tools, tools execute, approval can pause execution, and the UI renders a stable tool timeline. A Claude Code-style product needs a layer above raw tool execution: users should see what the agent is trying to do, which step is active, and where the work stopped.

This task plan layer becomes the foundation for later diff review, terminal session management, MCP integration, git workflows, and debugging loops.

## Scope

In scope:

- Store plan events inside a run message.
- Render a compact checklist inside the run process area.
- Keep step order stable.
- Allow steps to be pending, active, completed, or failed.
- Preserve existing tool timeline, approval flow, chat behavior, and provider runtime.

Out of scope for this phase:

- Persistent project-level task boards.
- Cross-session plan memory.
- A model-facing `update_plan` tool.
- Automatic high-quality plan generation by the model.
- Diff preview, terminal session management, MCP orchestration, and git workflows.

## Event Model

Add plan events to `RunEvent`:

- `plan_created`
- `plan_step_started`
- `plan_step_completed`
- `plan_step_failed`
- `plan_updated`

Each plan step has:

- `id`
- `title`
- `status`: `pending | active | completed | failed`
- `summary?`

The first implementation can create a simple local plan when a run starts. Later phases can allow the model to update the plan through a tool.

## UI Model

Render a `计划` card before the existing process/tool timeline inside each run's thinking/details area.

Checklist behavior:

- Pending: neutral marker.
- Active: emphasized marker and active text.
- Completed: completed marker.
- Failed: error marker plus optional summary.

The UI should not reorder steps after creation.

## Integration Points

- `src/app/runMessages.ts`
  - Add plan event types.
  - Add helper for appending plan events if needed.
- `src/App.tsx`
  - Create a basic task plan when a run starts.
  - Render plan events as a checklist before tool process steps.
- `src/app/app-ui.test.tsx`
  - Verify the plan card appears, step order is stable, and tool timeline remains visible.
- `src/app/runMessages.test.ts`
  - Verify run messages keep plan events.

## First-Phase Product Behavior

When a user sends a task, CircleLoop creates a small default plan:

1. Understand the request.
2. Gather relevant context.
3. Make the needed change or answer.
4. Verify and summarize.

This is intentionally generic. It gives the UI and event model a stable foundation without pretending that the model has produced a perfect custom plan.

Future work can replace the default plan with model-generated plan updates.

## Success Criteria

- A new run shows a `计划` checklist.
- Checklist state is stored in run events.
- Existing tool process timeline still renders.
- Approval actions still render.
- Regression tests pass.
