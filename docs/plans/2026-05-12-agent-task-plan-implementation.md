# Agent Task Plan Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a lightweight run-level task plan checklist for CircleLoop engineering-agent runs.

**Architecture:** Store plan state as run events in `RunThreadMessage.events`, render those events as a checklist before the existing process steps, and seed a simple default plan when a run starts. Do not change provider runtime, tool execution semantics, approval logic, or storage schema.

**Tech Stack:** React, TypeScript, Vitest, Testing Library, CSS.

---

### Task 1: Lock Run Event Model

**Files:**
- Modify: `src/app/runMessages.test.ts`
- Modify: `src/app/runMessages.ts`

**Step 1: Write failing tests**

Add a test that creates a run message with `createPendingRunMessage`, appends a `plan_created` event, and asserts the event is retained in order.

**Step 2: Run test**

Run:

```bash
pnpm test src/app/runMessages.test.ts
```

Expected: fail because `RunEvent` does not include plan event types yet.

**Step 3: Implement types and helper**

Add:

- `PlanStepStatus`
- `PlanStep`
- `PlanEvent`
- `createDefaultTaskPlanEvents()`

**Step 4: Run test**

Run:

```bash
pnpm test src/app/runMessages.test.ts
```

Expected: pass.

### Task 2: Render Plan Checklist

**Files:**
- Modify: `src/app/app-ui.test.tsx`
- Modify: `src/App.tsx`
- Modify: `src/App.css`

**Step 1: Write failing UI test**

Seed a run message with plan events and assert:

- heading `计划` appears
- plan steps render in order
- completed and active statuses render
- existing process step rendering still works

**Step 2: Run test**

Run:

```bash
pnpm test src/app/app-ui.test.tsx
```

Expected: fail because the UI does not render plan events.

**Step 3: Implement rendering**

Add a small plan view-model builder in `App.tsx` and render it before `renderProcessSteps()`.

**Step 4: Add minimal styles**

Add compact checklist styles to `App.css`.

**Step 5: Run test**

Run:

```bash
pnpm test src/app/app-ui.test.tsx
```

Expected: pass.

### Task 3: Seed Default Plan On Send/Retry

**Files:**
- Modify: `src/app/app-ui.test.tsx`
- Modify: `src/App.tsx`

**Step 1: Write failing UI test**

Submit a prompt and assert the new pending run includes the default plan checklist:

- `理解需求`
- `收集上下文`
- `执行任务`
- `验证并总结`

**Step 2: Run test**

Run:

```bash
pnpm test src/app/app-ui.test.tsx
```

Expected: fail because new runs do not seed plan events.

**Step 3: Implement default plan seeding**

When creating a pending run message, append the default plan events immediately.

**Step 4: Run test**

Run:

```bash
pnpm test src/app/app-ui.test.tsx
```

Expected: pass.

### Task 4: Verification

**Files:**
- Test: `src/app/runMessages.test.ts`
- Test: `src/app/app-ui.test.tsx`
- Test: `src/app/app-shell.test.tsx`
- Test: `src/agent/runEngine.test.ts`

**Step 1: Run focused tests**

```bash
pnpm test src/app/runMessages.test.ts src/app/app-ui.test.tsx src/app/app-shell.test.tsx src/agent/runEngine.test.ts
```

**Step 2: Run diagnostics**

Check:

- `src/app/runMessages.ts`
- `src/App.tsx`
- `src/App.css`
- `src/app/app-ui.test.tsx`

Expected: no new diagnostics.
