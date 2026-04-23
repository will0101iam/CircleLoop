# Approval Anchor Scroll Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Always scroll to the currently requested approval step when a new approval appears, even if normal stream auto-follow was previously interrupted by user scrolling.

**Architecture:** Keep existing message and process rendering intact. Introduce a dedicated approval-anchor scroll path with higher priority than ordinary token follow, and keep the ordinary follow interruption logic unchanged for non-approval updates.

**Tech Stack:** React 19, TypeScript, Vitest, Testing Library

---

### Task 1: Lock approval-anchor behavior with failing tests

**Files:**
- Modify: `src/app/app-ui.test.tsx`
- Modify: `src/app/threadFollowPolicy.test.ts`

**Step 1: Write a failing policy test**

Add a focused policy test that proves:
- ordinary stream follow can be interrupted for a run
- a newly requested approval still qualifies for anchor scrolling

**Step 2: Write a failing UI test**

Add a UI test that:
- starts a running chat
- simulates user manual scroll interruption
- injects a new `approval_requested`
- asserts the thread container still scrolls to the approval step

**Step 3: Run tests to verify they fail**

Run:

```bash
pnpm test src/app/app-ui.test.tsx src/app/threadFollowPolicy.test.ts
```

Expected: FAIL because current logic treats manual interruption as stronger than approval visibility.

### Task 2: Add explicit approval-anchor state

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/app/threadFollowPolicy.ts`

**Step 1: Extend follow policy**

Add a helper that says approval anchor scrolling is allowed when:
- the approval belongs to the active run
- the approval is newly requested

This must be independent from ordinary stream-follow interruption.

**Step 2: Track pending approval anchor**

In `App.tsx`, introduce a dedicated ref for the latest approval anchor target. This should be separate from:
- send anchor
- final completion scroll
- ordinary stream follow

### Task 3: Wire approval_requested to anchor scrolling

**Files:**
- Modify: `src/App.tsx`

**Step 1: Set anchor on approval request**

When `approval_requested` arrives in either:
- initial run
- approval resume flow

record the corresponding run/process-step target so the thread container scrolls to it immediately.

**Step 2: Give approval anchor highest priority**

In the thread scroll effect:
- approval anchor scroll runs before ordinary follow and final scroll
- it can still happen even if ordinary follow for that run was interrupted by user scrolling

**Step 3: Preserve user interruption semantics**

After scrolling to the approval anchor, ordinary token follow should still remain disabled if the user had already interrupted it. Only the approval jump is exempt.

### Task 4: Verify regression safety

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/app/app-ui.test.tsx`
- Modify: `src/app/threadFollowPolicy.ts`
- Modify: `src/app/threadFollowPolicy.test.ts`

**Step 1: Run focused regression**

Run:

```bash
pnpm test src/app/app-ui.test.tsx src/app/threadFollowPolicy.test.ts
```

Expected: PASS

**Step 2: Run broader regression**

Run:

```bash
pnpm test src/app/app-ui.test.tsx src/app/runMessages.test.ts src/app/app-shell.test.tsx src/app/renderAssistantBlocks.test.tsx src/app/threadFollowPolicy.test.ts
```

Expected: PASS

**Step 3: Check diagnostics**

Use IDE diagnostics on edited files and fix newly introduced issues.
