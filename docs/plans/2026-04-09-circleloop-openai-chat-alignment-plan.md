# circleloop OpenAI-Style Chat Alignment Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Refactor the current Mira-like UI into a mature OpenAI-style chat flow where each assistant run is rendered inline as `Thinking -> Tools -> Final reply`, without a separate timeline panel.

**Architecture:** Keep the existing runtime, MiniMax config, and `runEngine` loop. Replace the current "global last run" rendering with a message-driven model so each run is attached to the specific user message that triggered it. Prioritize interaction correctness first: run grouping, pending state, scroll behavior, and responsive header/sidebar.

**Tech Stack:** React + Vite, Tauri v2, Vitest + Testing Library, existing `runEngine` and tool formatting helpers.

---

### Task 1: Replace Global Run State With Inline Run Messages

**Files:**
- Modify: `/Users/bytedance/Desktop/1400/circleloop/src/App.tsx`
- Test: `/Users/bytedance/Desktop/1400/circleloop/src/app/app-ui.test.tsx`

**Step 1: Write the failing test**

Add a focused test plan for the new message model:
- assistant run block renders inside the message stream
- no standalone `Timeline` section exists
- run block order is `Thinking` then `Tools` then final assistant content

**Step 2: Run test to verify it fails**

Run:

```bash
pnpm -C /Users/bytedance/Desktop/1400/circleloop test src/app/app-ui.test.tsx
```

Expected: FAIL because current UI still uses global run state.

**Step 3: Write minimal implementation**

In `App.tsx`:
- Replace `chatMessages` shape with a renderable message list per chat:
  - user message
  - assistant text message
  - assistant run message with:
    - `status: pending | completed | error`
    - `thinkText`
    - `toolCards`
    - `finalText`
- On `Send/Run`:
  - append user message
  - append pending run message
  - update that exact run message when tools/final content return
- Remove standalone `runTimeline`, `lastThinkText`, and `toolCards` rendering.

**Step 4: Run test to verify it passes**

Run:

```bash
pnpm -C /Users/bytedance/Desktop/1400/circleloop test src/app/app-ui.test.tsx
```

Expected: PASS.

---

### Task 2: Remove Timeline And Reorder Run Content

**Files:**
- Modify: `/Users/bytedance/Desktop/1400/circleloop/src/App.tsx`
- Modify: `/Users/bytedance/Desktop/1400/circleloop/src/App.css`

**Step 1: Write the failing test**

Add assertions that:
- `Timeline` text is not present
- `Thinking completed` appears before `Tools`
- final assistant reply appears below both sections

**Step 2: Run test to verify it fails**

Run the same `app-ui` test command.

**Step 3: Write minimal implementation**

Render assistant run card as:
- top: `Thinking completed` details
- middle: tool call/result cards
- bottom: final assistant reply block

Delete the standalone timeline UI.

**Step 4: Run test to verify it passes**

Run the same `app-ui` test command.

---

### Task 3: Add Proper Running State And Composer Locking

**Files:**
- Modify: `/Users/bytedance/Desktop/1400/circleloop/src/App.tsx`
- Modify: `/Users/bytedance/Desktop/1400/circleloop/src/App.css`

**Step 1: Write the failing test**

Test that:
- clicking `Send/Run` while a run is pending disables the send button
- pending run message shows a visible running label/spinner text

**Step 2: Run test to verify it fails**

Run:

```bash
pnpm -C /Users/bytedance/Desktop/1400/circleloop test src/app/app-ui.test.tsx
```

Expected: FAIL.

**Step 3: Write minimal implementation**

- Add `isRunning` state per selected chat or per run
- Disable `Send/Run` while pending
- Render concise running status:
  - `Thinking...`
  - or `Running tools...`

**Step 4: Run test to verify it passes**

Run the same command and expect PASS.

---

### Task 4: Fix Header And Sidebar For 800x600

**Files:**
- Modify: `/Users/bytedance/Desktop/1400/circleloop/src/App.css`
- Modify: `/Users/bytedance/Desktop/1400/circleloop/src/App.tsx`

**Step 1: Write/extend UI test**

Add minimal shell assertions only if they are stable:
- header still shows brand + config access
- no loss of `Menu` and `Send/Run`

**Step 2: Implement responsive header**

- Move low-priority controls (workspace/config chips/buttons) into a compact overflow area on narrow widths
- Hide the always-visible sidebar on narrow widths; drawer only
- Make `Menu` a true toggle on narrow widths

**Step 3: Run tests**

Run:

```bash
pnpm -C /Users/bytedance/Desktop/1400/circleloop test
```

Expected: PASS.

---

### Task 5: Fix Chat Scroll Behavior

**Files:**
- Modify: `/Users/bytedance/Desktop/1400/circleloop/src/App.tsx`
- Modify: `/Users/bytedance/Desktop/1400/circleloop/src/App.css`

**Step 1: Minimal implementation**

- Add a message list ref
- Auto-scroll to bottom when a new message/run update arrives, but only if the user is already near the bottom
- Show a small "scroll to latest" affordance if user is reading older content
- Replace hard-coded `padding-bottom: 120px` with measured composer spacing if possible, or at least a tighter controlled layout

**Step 2: Manual verification**

- multiple messages do not get hidden behind composer
- long tool cards do not trap the outer scroll awkwardly

---

### Task 6: Verify End-To-End In Tauri

**Step 1: Run test suite**

```bash
pnpm -C /Users/bytedance/Desktop/1400/circleloop test
```

Expected: PASS.

**Step 2: Build**

```bash
pnpm -C /Users/bytedance/Desktop/1400/circleloop build
```

Expected: PASS.

**Step 3: Manual desktop check**

- Configure MiniMax
- Choose workspace
- Send 2-3 consecutive tasks
- Verify:
  - no separate timeline section
  - each run is grouped inline with its matching user message
  - order is `Thinking -> Tools -> Final reply`
  - header remains usable at 800x600
  - drawer behaves correctly

