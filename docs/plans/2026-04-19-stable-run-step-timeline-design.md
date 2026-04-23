# Stable Run Step Timeline Design

**Goal:** Replace the current event-oriented tool/approval display with a stable, user-facing step timeline that stays in first-seen order and only updates each step's status and result in place.

## Problem

The current UI exposes low-level run events such as `tool_execute`, `approval_requested`, `approval_resolved`, and `tool_result` too directly. Even after grouping by `groupId`, the renderer still behaves like a debugging panel instead of a product timeline:

- steps can appear to "jump" because groups are re-sorted after user interaction
- approvals and results are understandable only if the user mentally reconstructs the event flow
- final answer content and process content are mixed together
- multi-tool runs become hard to follow because the interface shows event categories instead of stable task steps

## Target UX

Each run is rendered in two layers:

1. `Process`
   - a stable step timeline
   - each tool call occupies one fixed slot
   - slots are ordered by the first time the corresponding `groupId` appears
   - later approval updates and results modify that same slot in place

2. `Final Answer`
   - rendered after the process timeline
   - contains only the visible assistant answer text
   - does not mix tool/approval rows into the answer body

## Step Model

One tool call maps to one timeline step.

Each step stores:

- `key`: stable identifier, usually `groupId ?? id`
- `title`: user-facing action label
- `status`: one of `running`, `waiting_approval`, `approved`, `denied`, `done`, `error`
- `resultPreview`: compact result summary
- `details`: optional expanded payload preview for args/result
- `approvalActions`: interactive controls only when status is `waiting_approval`

## Ordering Rules

- Steps are always ordered by first appearance in the event stream.
- A step never changes vertical position after it first appears.
- User interaction updates only the status/result of that existing step.
- The UI never re-sorts process steps by "responded first" or by result arrival.

## Status Rules

Status is derived per step in this priority order:

1. `error` when a tool result exists with `ok === false`
2. `done` when a tool result exists with `ok === true`
3. `approved` / `denied` when approval has been resolved and no tool result exists yet
4. `waiting_approval` when approval is requested and still interactive
5. `running` when the tool has executed but no approval/result exists yet

This guarantees that each step has one visible current state instead of multiple competing state rows.

## Rendering Rules

Each step renders as one compact block:

```text
Write get_time.py
Waiting for approval
Result
```

or

```text
Select workspace folder
Approved
Result
```

or

```text
Search workspace
Done
Result
```

The exact styling can continue using the existing CSS primitives as long as the information hierarchy matches this design.

## Scope

This refactor intentionally changes only the presentation layer in `src/App.tsx` and related UI tests.

Out of scope:

- changing run engine event production
- changing tool back-end behavior
- changing message actions, topbar, session management, or branch behavior
- changing rollback or runtime logic

