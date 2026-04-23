# Stable Run Step Timeline Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Refactor run process rendering into a stable step timeline ordered by first-seen tool call and separate it cleanly from the final answer.

**Architecture:** Keep the existing run event stream unchanged and replace only the UI assembly code in `src/App.tsx`. Build one normalized step list from all tool/approval/result events, render that list once in the process card, and keep the assistant answer body text-only.

**Tech Stack:** React 19, TypeScript, Vitest, Testing Library

---

### Task 1: Lock the new UX with failing tests

**Files:**
- Modify: `src/app/app-ui.test.tsx`

**Step 1: Write a failing test for stable step ordering**

Seed a run with three tool groups where:
- step A appears first and stays pending
- step B appears second, is approved, and finishes
- step C appears third and finishes

Assert the visible process order remains `A -> B -> C`, not "responded first".

**Step 2: Run test to verify it fails**

Run: `pnpm test src/app/app-ui.test.tsx`
Expected: FAIL because current code reorders groups based on response timing.

**Step 3: Write a failing test for status-in-place updates**

Seed one tool group with execute + approval request + approval resolved + tool result.

Assert:
- the step renders once
- it stays in the same slot
- its status changes from approval state to final result state instead of creating multiple scattered rows

**Step 4: Run test to verify it fails**

Run: `pnpm test src/app/app-ui.test.tsx`
Expected: FAIL because current UI still exposes low-level event rows.

### Task 2: Build a normalized process-step model

**Files:**
- Modify: `src/App.tsx`

**Step 1: Introduce a process step type**

Add a small type representing one stable user-facing step with:
- `key`
- `title`
- `status`
- `execute`
- `approvalRequested`
- `approvalResolved`
- `result`

**Step 2: Build steps from first-seen order**

Create a helper that walks the filtered event list once and:
- groups by `groupId ?? id`
- records the first index only for stable order
- never re-sorts by approval response timing

**Step 3: Derive one current status per step**

Implement a helper that maps the event combination to one visible status: `running`, `waiting_approval`, `approved`, `denied`, `done`, or `error`.

**Step 4: Run tests**

Run: `pnpm test src/app/app-ui.test.tsx`
Expected: still failing until the renderer is switched over.

### Task 3: Render one process timeline and keep final answer separate

**Files:**
- Modify: `src/App.tsx`

**Step 1: Replace split process renderers**

Remove the current process rendering that outputs `CALL / ASK / RESULT` as separate event rows and replace it with one stable step list in the details card.

**Step 2: Keep approval interaction in-step**

Only steps with `waiting_approval` should show `允许执行 / 拒绝执行`. Resolved or completed steps must be read-only.

**Step 3: Make final answer text-only**

Stop injecting tool or approval rows into the assistant answer body. The answer body should render only the final visible answer text.

**Step 4: Run tests**

Run: `pnpm test src/app/app-ui.test.tsx src/app/app-shell.test.tsx`
Expected: PASS

### Task 4: Verify nearby behavior remains intact

**Files:**
- Modify: `src/App.tsx`
- Test: `src/app/runMessages.test.ts`

**Step 1: Keep marker de-duplication unchanged**

Do not change run message marker logic unless required for type compatibility.

**Step 2: Run regression suite**

Run:

```bash
pnpm test src/app/runMessages.test.ts src/app/app-ui.test.tsx src/app/app-shell.test.tsx
```

Expected: PASS

### Task 5: Final diagnostics

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/app/app-ui.test.tsx`

**Step 1: Check diagnostics**

Use IDE diagnostics on edited files and remove any newly introduced errors or warnings where obvious.

**Step 2: Commit**

```bash
git add docs/plans/2026-04-19-stable-run-step-timeline-design.md docs/plans/2026-04-19-stable-run-step-timeline-implementation.md src/App.tsx src/app/app-ui.test.tsx
git commit -m "refactor: render stable run process timeline"
```
