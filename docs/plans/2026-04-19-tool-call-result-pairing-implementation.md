# Tool Call Result Pairing Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Render each tool call as a single grouped timeline item so users see `CALL -> ASK/status -> RESULT` in one clear chain.

**Architecture:** Keep the existing event production unchanged and refactor only the UI assembly layer in `App.tsx`. Group `tool_execute`, `approval_requested`, `approval_resolved`, and `tool_result` by `groupId`, then render each group in chronological order inside the same location bucket (`thinking` or `answer`).

**Tech Stack:** React 19, TypeScript, Vitest, Testing Library

---

### Task 1: Lock the desired UI behavior with failing tests

**Files:**
- Modify: `src/app/app-ui.test.tsx`

**Step 1: Write the failing test**

Add a focused test that seeds a run message with one `groupId` containing:
- one `tool_execute`
- one `approval_requested`
- one `tool_result`

Assert that:
- the `CALL execute_command` row appears before the approval row
- the approval row appears before the result row
- the three rows are rendered inside the same visual block for that call group

**Step 2: Run test to verify it fails**

Run: `pnpm test src/app/app-ui.test.tsx`

Expected: FAIL because the current renderer splits tool lines and approval lines into separate lists.

**Step 3: Add a second failing test**

Add a second test for the resolved case:
- one `tool_execute`
- one `approval_requested`
- one `approval_resolved`
- one `tool_result`

Assert that:
- the approval row becomes non-interactive
- the status text shows resolved state
- the tool result still stays directly after the approval state for the same `groupId`

**Step 4: Run test to verify it fails**

Run: `pnpm test src/app/app-ui.test.tsx`

Expected: FAIL because the current renderer does not build one unified timeline item per call group.

### Task 2: Build a unified call timeline model

**Files:**
- Modify: `src/App.tsx`

**Step 1: Introduce a grouped view model**

Add a small helper type that represents one grouped call item:

```ts
type ToolCallTimelineItem = {
  key: string
  name: string
  execute?: Extract<RunEvent, { kind: 'tool_execute' }>
  approvalRequested?: Extract<RunEvent, { kind: 'approval_requested' }>
  approvalResolved?: Extract<RunEvent, { kind: 'approval_resolved' }>
  result?: Extract<RunEvent, { kind: 'tool_result' }>
}
```

**Step 2: Add a builder helper**

Create a helper that:
- accepts filtered events for one location
- groups by `groupId ?? id`
- preserves first-seen order
- stores the matching execute / approval / result events on the same item

**Step 3: Keep approval UI state mapping intact**

When a grouped item has approval events:
- derive pending vs resolved state from `approvalUiStates`
- fall back to resolved state when `approval_resolved` exists

**Step 4: Run typecheck-by-test**

Run: `pnpm test src/app/app-ui.test.tsx`

Expected: still failing or partially passing until rendering is switched over.

### Task 3: Switch thinking and answer rendering to grouped timeline output

**Files:**
- Modify: `src/App.tsx`

**Step 1: Replace split renderers**

Refactor `renderToolDetails()` and `renderApprovalDetails()` so they no longer render separate lists. Instead, add one renderer that outputs a grouped timeline item like:

```tsx
<div className="mira-tool-call-group">
  <div className="mira-tool-line">CALL ...</div>
  <div className="mira-approval-line">ASK / status ...</div>
  <div className="mira-tool-line">OK / ERROR ...</div>
</div>
```

**Step 2: Preserve answer segment semantics**

For answer mode:
- `text` segments still render as-is
- `tool` and `approval` markers should resolve to the same grouped call item
- each `groupId` renders once, even if both `tool` and `approval` markers reference it

**Step 3: Keep interaction rules**

Only the currently pending approval row should show `允许执行 / 拒绝执行`. Resolved approvals must render as read-only state.

**Step 4: Run tests**

Run: `pnpm test src/app/app-ui.test.tsx src/app/app-shell.test.tsx`

Expected: PASS

### Task 4: Prevent duplicate marker artifacts

**Files:**
- Modify: `src/app/runMessages.test.ts`
- Modify: `src/app/runMessages.ts`

**Step 1: Keep marker de-duplication test**

Retain and run the existing regression that prevents duplicate answer markers for the same `groupId`.

**Step 2: Verify minimal marker logic**

Ensure `appendRunAnswerMarker()` continues to reject duplicate `tool` or `approval` markers for the same `eventId`.

**Step 3: Run targeted test**

Run: `pnpm test src/app/runMessages.test.ts`

Expected: PASS

### Task 5: Final verification

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/app/app-ui.test.tsx`
- Modify: `src/app/runMessages.ts`
- Modify: `src/app/runMessages.test.ts`

**Step 1: Run focused regression suite**

Run:

```bash
pnpm test src/app/runMessages.test.ts src/app/app-ui.test.tsx src/app/app-shell.test.tsx
```

Expected: PASS

**Step 2: Check diagnostics**

Use IDE diagnostics on edited files and fix any newly introduced TypeScript or lint issues.

**Step 3: Commit**

```bash
git add docs/plans/2026-04-19-tool-call-result-pairing-implementation.md src/App.tsx src/app/app-ui.test.tsx src/app/runMessages.ts src/app/runMessages.test.ts
git commit -m "fix: pair tool calls with approval and results"
```
