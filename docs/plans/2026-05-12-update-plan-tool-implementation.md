# Update Plan Tool Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add an `update_plan` tool so the model can actively update the run-level task checklist.

**Architecture:** Implement `update_plan` as a safe registered tool that validates and returns normalized plan steps. Teach `runEngine` to emit `plan_updated` timeline events when this tool succeeds, then map those engine events into UI `RunEvent` values already rendered by the plan checklist.

**Tech Stack:** TypeScript, React, Vitest, Testing Library.

---

### Task 1: Add Update Plan Tool

**Files:**
- Create: `src/tools/updatePlanTool.ts`
- Create: `src/tools/updatePlanTool.test.ts`

**Steps:**
1. Write failing tests for valid payload normalization and invalid status rejection.
2. Implement `createUpdatePlanTool()`.
3. Run `pnpm test src/tools/updatePlanTool.test.ts`.

### Task 2: Register Tool

**Files:**
- Modify: `src/runtime/runtime.ts`
- Modify: `src/runtime/runtime.test.ts`

**Steps:**
1. Write failing runtime test asserting `update_plan` is registered.
2. Register `update_plan` as a safe tool.
3. Run `pnpm test src/runtime/runtime.test.ts`.

### Task 3: Emit Engine Plan Events

**Files:**
- Modify: `src/agent/runEngine.ts`
- Modify: `src/agent/runEngine.test.ts`

**Steps:**
1. Write failing test where the model calls `update_plan` and the engine timeline includes `plan_updated`.
2. Extend `EngineTimelineEvent` with `plan_updated`.
3. Emit `plan_updated` only when `update_plan` returns `ok: true`.
4. Run `pnpm test src/agent/runEngine.test.ts`.

### Task 4: Map To UI Run Events

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/app/app-ui.test.tsx`

**Steps:**
1. Write failing UI test for an engine `plan_updated` event updating the visible checklist.
2. Map engine `plan_updated` into app `RunEvent`.
3. Run `pnpm test src/app/app-ui.test.tsx`.

### Task 5: Verification

Run:

```bash
pnpm test src/tools/updatePlanTool.test.ts src/runtime/runtime.test.ts src/agent/runEngine.test.ts src/app/app-ui.test.tsx src/app/runMessages.test.ts
```

Then run diagnostics for changed source files.
