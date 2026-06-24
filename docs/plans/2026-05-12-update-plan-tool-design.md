# Update Plan Tool Design

Date: 2026-05-12

## Goal

Let the model actively update CircleLoop's run-level task plan instead of only showing the default checklist created by the app.

## Design

Add an `update_plan` tool to the runtime. The tool is safe, has no workspace requirement, and accepts a full ordered list of plan steps. Each step includes:

- `id`
- `title`
- `status`: `pending | active | completed | failed`
- `summary?`

The tool handler validates the payload and returns the normalized plan.

## Engine Integration

`runEngine` already emits low-level `EngineTimelineEvent` values while executing tools. When it sees a successful `update_plan` call, it should also emit:

- `plan_updated`

The UI layer already renders `plan_updated` through the plan checklist renderer from the previous phase.

This keeps the model-facing capability as a normal tool while keeping the UI state driven by explicit plan events.

## Runtime Integration

Register `update_plan` in `createRuntime()` before workspace-specific tools.

## Scope

In scope:

- Add `update_plan` tool.
- Register it in runtime.
- Convert successful `update_plan` tool results into engine `plan_updated` timeline events.
- Convert engine `plan_updated` events into UI `RunEvent` values.
- Cover with unit and UI tests.

Out of scope:

- Persistent task board.
- Cross-run plan memory.
- Complex partial patch operations for one step.
- Forcing every model to call `update_plan`.

## Product Behavior

When the model calls `update_plan`, the visible `计划` card updates in place. This allows the model to:

- replace the default plan with a task-specific plan
- mark steps complete
- mark the current step active
- mark a step failed with a short summary

## Failure Behavior

Invalid `update_plan` payloads return a tool error. The engine should not emit `plan_updated` for invalid payloads.
