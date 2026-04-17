# circleloop Mira/OpenAI Visual Rebuild Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Rebuild the current chat UI into a screenshot-faithful Mira/OpenAI-style interface, replacing the current dark developer-panel look with a light, low-pressure conversational workspace while preserving the existing MiniMax + tool-loop backend.

**Architecture:** Keep the data/runtime model already fixed in `App.tsx` (`Thinking -> Tools -> Final reply` inline with each run), but replace the current layout, spacing, theming, and interaction chrome almost entirely. The rebuild focuses on visual hierarchy first: light canvas, low-noise top chrome, Mira-like sidebar, OpenAI-like composer, and document-flow assistant content. The existing logic stays; the UI shell and render structure are refactored aggressively.

**Tech Stack:** React + Vite, Tauri v2, Vitest + Testing Library, existing `runEngine`, `runMessages`, `sanitizeThink`, and tool payload formatting helpers.

---

### Task 1: Lock The New Visual Contract In Tests

**Files:**
- Modify: `/Users/bytedance/Desktop/1400/circleloop/src/app/app-ui.test.tsx`

**Step 1: Write the failing test**

Update the UI shell test to reflect the rebuilt visual contract with stable text/labels only:

- left navigation includes:
  - `New Chat`
  - `Task`
  - `Customize`
  - `Recents`
- composer placeholder remains `Ask anything`
- no `Timeline`
- send button exists

Do not test CSS classes directly. Use stable visible labels.

**Step 2: Run test to verify it fails**

Run:

```bash
pnpm -C /Users/bytedance/Desktop/1400/circleloop test src/app/app-ui.test.tsx
```

Expected: FAIL because current sidebar/header layout is still incomplete.

**Step 3: Minimal implementation**

Only after the test fails, proceed to Task 2.

**Step 4: Run test to verify it passes**

Run the same command after Task 2.

---

### Task 2: Rebuild Layout Chrome To Match Mira

**Files:**
- Modify: `/Users/bytedance/Desktop/1400/circleloop/src/App.tsx`
- Modify: `/Users/bytedance/Desktop/1400/circleloop/src/App.css`

**Step 1: Rebuild sidebar**

Refactor the left sidebar into a Mira-like structure:

- top brand row
- action list:
  - `New Chat`
  - `Task`
  - `Customize`
- `Recents` list
- bottom account/status area placeholder

The sidebar should be light, quiet, and structurally similar to the screenshot.

**Step 2: Rebuild top area**

Remove the heavy control-panel feel:

- no dense top chip row as the dominant chrome
- chat title sits lightly near top-left of main pane
- low-priority workspace/model controls move into a subtle secondary row or compact utility cluster

**Step 3: Rebuild page background**

Replace dark gradient panels with:

- light application background
- subtle borders/dividers
- no glowing developer-tool aesthetic

**Step 4: Run shell test**

Run:

```bash
pnpm -C /Users/bytedance/Desktop/1400/circleloop test src/app/app-ui.test.tsx
```

Expected: PASS.

---

### Task 3: Rebuild Message Presentation Into Document Flow

**Files:**
- Modify: `/Users/bytedance/Desktop/1400/circleloop/src/App.tsx`
- Modify: `/Users/bytedance/Desktop/1400/circleloop/src/App.css`

**Step 1: Write/extend failing test**

Add assertions that:

- `Thinking completed` appears above final assistant content
- tool section is inline under thinking
- standalone boxed "developer panel" layout is not required for assistant text

Keep the test minimal and stable.

**Step 2: Rebuild message blocks**

Change rendering so that:

- user messages remain compact bubbles
- assistant messages look like reading content, not dark cards
- run blocks become a vertically flowing assistant section:
  - lightweight heading/meta
  - `Thinking completed`
  - `Tools`
  - final reply

The final reply should visually dominate; thinking/tools are supporting layers.

**Step 3: Rebuild tool cards**

Make tool calls/results feel like lightweight expandable activity rows, not nested debug boxes.

- reduce border heaviness
- simplify nesting
- keep preview + `Show full`

**Step 4: Run tests**

Run the focused UI tests again and expect PASS.

---

### Task 4: Rebuild Composer To Match OpenAI/Mira Interaction

**Files:**
- Modify: `/Users/bytedance/Desktop/1400/circleloop/src/App.tsx`
- Modify: `/Users/bytedance/Desktop/1400/circleloop/src/App.css`

**Step 1: Improve composer structure**

The composer should look like a primary interactive surface:

- large rounded container
- integrated icons/actions
- low-noise secondary buttons
- clear primary submit affordance

**Step 2: Running state**

Polish the running interaction:

- disabled primary button while running
- concise running copy
- preserve input affordance quality

**Step 3: Run tests**

Run:

```bash
pnpm -C /Users/bytedance/Desktop/1400/circleloop test src/app/app-ui.test.tsx
```

Expected: PASS.

---

### Task 5: Fix 800x600 And Small-Window Behavior Properly

**Files:**
- Modify: `/Users/bytedance/Desktop/1400/circleloop/src/App.css`
- Modify: `/Users/bytedance/Desktop/1400/circleloop/src/App.tsx`

**Step 1: Sidebar/drawer**

- at narrow widths, sidebar becomes a proper drawer
- `Menu` only appears when needed
- selecting a chat closes drawer

**Step 2: Header density**

- avoid button pile-up
- allow wrapping or move secondary controls below the title

**Step 3: Composer / scroll**

- ensure latest content is visible above composer
- no awkward overlap
- long runs still scroll comfortably

**Step 4: Manual verification**

Check the Tauri window at 800x600 specifically.

---

### Task 6: Final Visual Pass

**Files:**
- Modify: `/Users/bytedance/Desktop/1400/circleloop/src/App.css`
- (Optional) Modify: `/Users/bytedance/Desktop/1400/circleloop/src/App.tsx`

**Step 1: Typography**

- reduce harsh contrast
- improve hierarchy with weight/size/spacing, not heavy boxes

**Step 2: Spacing**

- more whitespace in assistant content
- calmer sidebar rhythm
- cleaner composer spacing

**Step 3: Color**

- shift to a light-first neutral palette matching the screenshot direction
- keep accent usage minimal

**Step 4: Manual visual review**

Compare against the screenshot:

- first glance should feel close
- no "developer dashboard" vibe remains

---

### Task 7: Verification

**Step 1: Run full test suite**

```bash
pnpm -C /Users/bytedance/Desktop/1400/circleloop test
```

Expected: PASS.

**Step 2: Build**

```bash
pnpm -C /Users/bytedance/Desktop/1400/circleloop build
```

Expected: PASS.

**Step 3: Manual Tauri verification**

- start app
- choose workspace
- configure MiniMax
- send multiple prompts
- verify:
  - no standalone timeline
  - thinking above reply
  - tools inline
  - sidebar + composer + reading surface feel close to Mira/OpenAI

