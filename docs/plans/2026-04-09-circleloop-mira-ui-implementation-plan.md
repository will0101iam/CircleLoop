# circleloop Mira-Style Chat UI Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the current IDE-like UI with a Mira-style chat UI that shows a safe "Thinking completed" summary and renders tool calls/results as collapsible cards in the chat flow.

**Architecture:** Keep the existing runtime/tool-loop unchanged (`runEngine`, `ToolRegistry`, config + workspace logic). Only refactor `App.tsx` rendering + `App.css` to a responsive Mira-like layout and add a small `<think>` sanitizer that never shows raw hidden reasoning.

**Tech Stack:** React + Vite, Tauri v2 (dialog/fs/sql), Vitest + Testing Library, existing `runEngine.timeline`.

---

### Task 1: Update UI Tests To Target Mira Shell

**Files:**
- Modify: `/Users/bytedance/Desktop/1400/circleloop/src/app/app-ui.test.tsx`
- (Optional) Modify: `/Users/bytedance/Desktop/1400/circleloop/src/app/app-shell.test.tsx`

**Step 1: Write the failing test**

Change assertions from IDE shell to Mira shell.

Target minimal stable labels (avoid brittle CSS selectors):

- Left nav toggle (when collapsed): a button with accessible name `"Menu"` (or `"Mira"` if we use brand button).
- Composer input placeholder: `"Ask anything"` (or Chinese equivalent, but keep consistent).
- Primary action button: `"Send/Run"`.
- A visible config affordance: `"配置 MiniMax"` button.

**Step 2: Run test to verify it fails**

Run:

```bash
pnpm -C /Users/bytedance/Desktop/1400/circleloop test src/app/app-ui.test.tsx
```

Expected: FAIL (old IDE labels no longer exist after Task 2, or current test fails once we update it).

**Step 3: Minimal implementation**

No implementation in this task; only adjust tests.

**Step 4: Run test to verify it passes (later)**

Expected: PASS after Task 2.

---

### Task 2: Implement Mira Layout Shell (Responsive For 800x600)

**Files:**
- Modify: `/Users/bytedance/Desktop/1400/circleloop/src/App.tsx`
- Modify: `/Users/bytedance/Desktop/1400/circleloop/src/App.css`

**Step 1: Run current app-ui test baseline**

Run:

```bash
pnpm -C /Users/bytedance/Desktop/1400/circleloop test src/app/app-ui.test.tsx
```

Expected: FAIL after Task 1 updates (since UI not updated yet).

**Step 2: Implement the Mira shell (no behavioral changes yet)**

In `App.tsx`:

- Replace the `ide-*` layout with `mira-*` layout:
  - Sidebar area with brand + actions + recents list.
  - Main content with:
    - Top header (title + chips + buttons).
    - Scrollable message stream.
    - Bottom composer (fixed).
- Add `drawerOpen` state:
  - On small viewport, sidebar becomes a drawer overlay.
  - Provide a "Menu" button in header to toggle.
- Keep existing handlers and state:
  - `handlePickWorkspace`, `handleSendRun`, `handleSaveModelSettings`, modal for config.
  - No changes to runtime/tool execution yet; just rewire rendering.

In `App.css`:

- Introduce `mira-*` styles:
  - Two-column grid on wide screens.
  - On 800x600, sidebar collapses to drawer and main column uses full width.
  - Composer fixed bottom: ensure message list has `padding-bottom` equal to composer height.
  - Avoid horizontal overflow at 800px.

**Step 3: Run test to verify it passes**

Run:

```bash
pnpm -C /Users/bytedance/Desktop/1400/circleloop test src/app/app-ui.test.tsx
```

Expected: PASS (Mira shell labels exist).

---

### Task 3: Add `<think>` Sanitization (Never Show Raw Hidden Reasoning)

**Files:**
- Create: `/Users/bytedance/Desktop/1400/circleloop/src/app/sanitizeThink.ts`
- Create: `/Users/bytedance/Desktop/1400/circleloop/src/app/sanitizeThink.test.ts`
- Modify: `/Users/bytedance/Desktop/1400/circleloop/src/App.tsx`

**Step 1: Write failing unit tests**

```ts
import { describe, expect, it } from 'vitest'
import { sanitizeThink } from './sanitizeThink'

describe('sanitizeThink', () => {
  it('strips <think> from visible text and returns thinkText', () => {
    const out = sanitizeThink('a<think>secret plan</think>b')
    expect(out.visibleText).toBe('ab')
    expect(out.thinkText).toContain('secret')
  })

  it('handles missing think', () => {
    const out = sanitizeThink('hello')
    expect(out.visibleText).toBe('hello')
    expect(out.thinkText).toBeNull()
  })
})
```

**Step 2: Run test to verify it fails**

Run:

```bash
pnpm -C /Users/bytedance/Desktop/1400/circleloop test src/app/sanitizeThink.test.ts
```

Expected: FAIL (file/function missing).

**Step 3: Minimal implementation**

Implement `sanitizeThink(input)`:

- Extract first `<think>...</think>` block if present.
- `visibleText` = input with that block removed.
- `thinkText` = extracted content (trimmed) or null.
- Add a conservative truncation (e.g. max 1200 chars) to prevent giant renders.

**Step 4: Run test to verify it passes**

Run:

```bash
pnpm -C /Users/bytedance/Desktop/1400/circleloop test src/app/sanitizeThink.test.ts
```

Expected: PASS.

**Step 5: Wire into UI**

In `App.tsx`, when appending assistant final content:

- Sanitize content before storing/rendering.
- Store `thinkText` (if present) alongside the assistant message or run block.
- Ensure `thinkText` is shown only inside a collapsed "Thinking completed" panel.

---

### Task 4: Render Run Timeline As Mira Cards In Chat Flow

**Files:**
- Modify: `/Users/bytedance/Desktop/1400/circleloop/src/App.tsx`
- (Optional) Modify: `/Users/bytedance/Desktop/1400/circleloop/src/App.css`

**Step 1: Write/extend a focused UI test**

Extend `app-ui.test.tsx` minimally to assert that after Send/Run, a "Runs" block (or "Tool calls") container appears.

Note: Since `runEngine` currently calls real chatCompletion, inject a small stub path for tests:

- Approach: add a `__TESTING__` escape hatch in `App.tsx` to pass a fake `chatCompletion` when `import.meta.env.MODE === 'test'`, OR
- Move run execution into a helper function that can be unit-tested without rendering.

Pick the smallest change that keeps production behavior unchanged.

**Step 2: Implement RunBlock rendering**

In `handleSendRun`:

- Generate a `runId` for each click.
- Collect `result.timeline` and store it as part of a RunBlock inserted into the chat stream after the user message.

Rendering:

- Thinking panel:
  - Title: "Thinking completed"
  - Content: either sanitized `thinkText` (preferred) or a small plan derived from tool calls.
- Tool cards:
  - For `tool_execute` show tool name + collapsed args JSON.
  - For `tool_result` show ok/error + collapsed result JSON.
- Final assistant answer:
  - Render sanitized `visibleText` as the assistant message body.

**Step 3: Run tests**

Run:

```bash
pnpm -C /Users/bytedance/Desktop/1400/circleloop test
```

Expected: PASS.

---

### Task 5: Manual Verification In Tauri

**Step 1: Start desktop app**

If not already running:

```bash
pnpm -C /Users/bytedance/Desktop/1400/circleloop tauri:dev
```

**Step 2: Verify UX at 800x600**

- Sidebar collapses to drawer (no horizontal scroll).
- Composer remains visible.
- Messages scroll correctly.

**Step 3: Verify tool + thinking flow**

- Configure MiniMax (save to `$APPCONFIG/circleloop/config.json`)
- Choose workspace
- Send a task that triggers tools
- Confirm:
  - No raw `<think>` appears in final assistant content.
  - Thinking panel displays summary.
  - Tool cards show tool calls and results (collapsed by default).

---

## Optional: Commit Strategy

This repo currently avoids commits unless explicitly requested. If you want commits, we can do:

- `feat(ui): switch to mira-style chat shell`
- `feat(ui): render thinking + tool cards`

