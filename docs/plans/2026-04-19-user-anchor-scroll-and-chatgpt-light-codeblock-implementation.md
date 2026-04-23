# User Anchor Scroll And ChatGPT Light Codeblock Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Scroll to the just-sent user message immediately, keep auto-follow active only until the user manually scrolls during that run, and refine code blocks to a ChatGPT-like light style without inner nested background.

**Architecture:** Keep the current run creation flow unchanged and adjust only the viewport-follow logic and assistant code block presentation. Use the thread container as the single scroll authority, track one per-run auto-follow flag that disables permanently after user scroll interruption, and keep the code block structure simple: one outer light card, one toolbar, one plain code surface.

**Tech Stack:** React 19, TypeScript, Vitest, Testing Library

---

### Task 1: Lock the user-anchor scroll behavior with failing tests

**Files:**
- Modify: `src/app/app-ui.test.tsx`

**Step 1: Write the failing test for send anchor**

Add a focused test that:
- renders an empty chat
- sends a new prompt
- spies on the thread container `scrollTo`
- asserts the send flow scrolls the thread container rather than calling `scrollIntoView` on the run node

**Step 2: Run test to verify it fails**

Run: `pnpm test src/app/app-ui.test.tsx`

Expected: FAIL because current code still uses `scrollIntoView`.

**Step 3: Write the failing test for manual interruption**

Add a test that:
- starts a running chat with a visible thread container
- simulates user scroll during streaming
- triggers another UI update in the same run
- asserts auto-follow does not resume during that same run

**Step 4: Run test to verify it fails**

Run: `pnpm test src/app/app-ui.test.tsx`

Expected: FAIL because current code only checks near-bottom and does not persist a per-run interruption state.

### Task 2: Lock the ChatGPT light code block presentation with failing tests

**Files:**
- Modify: `src/app/app-ui.test.tsx`
- Modify: `src/app/renderAssistantBlocks.test.tsx`

**Step 1: Write the failing test for single-surface code block**

Assert that rendered code blocks include:
- toolbar with language label
- `Copy code`
- one outer code block container
- no extra nested tinted content wrapper inside the code area

**Step 2: Run test to verify it fails**

Run: `pnpm test src/app/app-ui.test.tsx src/app/renderAssistantBlocks.test.tsx`

Expected: FAIL because current code block still has styling that produces an inner tinted surface look.

### Task 3: Implement thread-container scroll anchoring

**Files:**
- Modify: `src/App.tsx`

**Step 1: Track the just-sent user message**

When send/retry creates a new user message and run, remember the new user message ID as the immediate scroll anchor.

**Step 2: Replace `scrollIntoView` path**

Use `threadRef.current.scrollTo({ top })` with a calculated offset based on the target element’s position relative to the thread container.

**Step 3: Add per-run interruption state**

Track whether the current running chat has been manually scrolled by the user. Once interrupted, disable auto-follow for the rest of that run. Reset only when the next send/retry begins.

**Step 4: Run tests**

Run: `pnpm test src/app/app-ui.test.tsx`

Expected: PASS

### Task 4: Refine code blocks to ChatGPT light style

**Files:**
- Modify: `src/app/renderAssistantBlocks.tsx`
- Modify: `src/App.css`

**Step 1: Keep one outer card**

Preserve the toolbar and outer card, but ensure the code area itself uses the same card surface or a plain transparent surface, not an inner highlighted box.

**Step 2: Keep copy interaction minimal**

Do not add extra controls beyond:
- language label
- `Copy code`
- transient copied state

**Step 3: Run tests**

Run: `pnpm test src/app/app-ui.test.tsx src/app/renderAssistantBlocks.test.tsx`

Expected: PASS

### Task 5: Run regression and diagnostics

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/App.css`
- Modify: `src/app/app-ui.test.tsx`
- Modify: `src/app/renderAssistantBlocks.tsx`
- Modify: `src/app/renderAssistantBlocks.test.tsx`

**Step 1: Run regression suite**

Run:

```bash
pnpm test src/app/app-ui.test.tsx src/app/runMessages.test.ts src/app/app-shell.test.tsx src/app/renderAssistantBlocks.test.tsx
```

Expected: PASS

**Step 2: Check diagnostics**

Use IDE diagnostics on all edited files and fix newly introduced issues.

**Step 3: Commit**

```bash
git add docs/plans/2026-04-19-user-anchor-scroll-and-chatgpt-light-codeblock-implementation.md src/App.tsx src/App.css src/app/app-ui.test.tsx src/app/renderAssistantBlocks.tsx src/app/renderAssistantBlocks.test.tsx
git commit -m "refactor: anchor send scroll and refine code blocks"
```
