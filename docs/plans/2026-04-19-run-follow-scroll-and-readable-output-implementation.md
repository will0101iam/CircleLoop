# Run Follow Scroll And Readable Output Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make new runs scroll into view immediately, render assistant output more compactly and readably, and present thinking-step labels in user-facing language.

**Architecture:** Keep run engine behavior unchanged and refactor only the presentation layer in `src/App.tsx` plus small supporting helpers. Use a lightweight in-repo renderer for assistant markdown-like output to avoid adding new dependencies, and make scrolling explicitly target the newly created run instead of relying only on bottom-follow heuristics.

**Tech Stack:** React 19, TypeScript, Vitest, Testing Library

---

### Task 1: Lock send-follow behavior with failing tests

**Files:**
- Modify: `src/app/app-ui.test.tsx`

**Step 1: Write the failing test**

Add a focused test for "send creates a new run and scrolls to it".

The test should:
- render enough prior content to require scrolling
- submit a new prompt
- assert the new run card is targeted for follow behavior immediately

Use a spy on `scrollIntoView` or `scrollTo` depending on the current implementation seam.

**Step 2: Run test to verify it fails**

Run: `pnpm test src/app/app-ui.test.tsx`

Expected: FAIL because sending currently relies on near-bottom auto-follow instead of explicit targeting.

### Task 2: Lock readable assistant output with failing tests

**Files:**
- Modify: `src/app/app-ui.test.tsx`

**Step 1: Write the failing test for fenced code**

Seed a completed run whose `finalText` contains:
- leading paragraph
- fenced code block
- trailing paragraph

Assert the rendered assistant body contains:
- a paragraph node for intro text
- a code-block container for fenced content
- no raw triple backticks

**Step 2: Write the failing test for compact spacing**

Seed a completed run with multiple blank lines between paragraphs and code.

Assert the rendered structure uses grouped blocks instead of one giant `pre-wrap` text blob.

**Step 3: Run test to verify it fails**

Run: `pnpm test src/app/app-ui.test.tsx`

Expected: FAIL because assistant body currently renders as raw text with `white-space: pre-wrap`.

### Task 3: Lock user-facing thinking labels with failing tests

**Files:**
- Modify: `src/app/app-ui.test.tsx`

**Step 1: Write the failing test**

Seed process steps for:
- `write_file`
- `search_code`
- `execute_command`

Assert the process titles render as user-facing labels such as:
- `正在写入 get_time.py`
- `正在搜索工作区`
- `正在运行命令`

Avoid asserting exact English tool names in the visible default label.

**Step 2: Run test to verify it fails**

Run: `pnpm test src/app/app-ui.test.tsx`

Expected: FAIL because current step titles still expose tool-centric names like `Run execute_command`.

### Task 4: Implement explicit run targeting and lightweight output rendering

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/App.css`
- Create: `src/app/renderAssistantBlocks.tsx`
- Create: `src/app/renderAssistantBlocks.test.tsx`

**Step 1: Add a lightweight assistant block renderer**

Create a helper that parses sanitized assistant text into simple blocks:
- paragraph
- unordered list
- fenced code block
- inline code remains plain text for now

Keep parsing intentionally small and deterministic.

**Step 2: Replace raw assistant body rendering**

In `App.tsx`, render assistant final text through the helper instead of raw text.

**Step 3: Add explicit run-follow targeting**

Track the latest created run ID and force one immediate scroll to that run card when send/retry starts.

After the initial jump, keep the current near-bottom follow logic for streaming updates.

**Step 4: Update thinking-step labels**

Refine `formatToolStepTitle()` and related helpers to produce user-facing language by default.

**Step 5: Run tests**

Run: `pnpm test src/app/app-ui.test.tsx src/app/renderAssistantBlocks.test.tsx`

Expected: PASS

### Task 5: Run full regression and diagnostics

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/App.css`
- Modify: `src/app/app-ui.test.tsx`
- Create: `src/app/renderAssistantBlocks.tsx`
- Create: `src/app/renderAssistantBlocks.test.tsx`

**Step 1: Run regression suite**

Run:

```bash
pnpm test src/app/app-ui.test.tsx src/app/runMessages.test.ts src/app/app-shell.test.tsx src/app/renderAssistantBlocks.test.tsx
```

Expected: PASS

**Step 2: Check diagnostics**

Use IDE diagnostics on all edited files and fix any newly introduced issues.

**Step 3: Commit**

```bash
git add docs/plans/2026-04-19-run-follow-scroll-and-readable-output-implementation.md src/App.tsx src/App.css src/app/app-ui.test.tsx src/app/renderAssistantBlocks.tsx src/app/renderAssistantBlocks.test.tsx
git commit -m "refactor: improve run follow and readable assistant output"
```
