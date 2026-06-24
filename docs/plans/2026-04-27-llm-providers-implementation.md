# Multi-Provider LLM Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add global multi-provider LLM configuration and per-session model/provider selection with a grouped model chip UI in the composer.

**Architecture:** Keep one OpenAI-compatible transport path and route requests by session-selected provider/model. Store provider credentials globally, store provider/model per session, and migrate existing MiniMax-only config and session data without breakage.

**Tech Stack:** React 19, TypeScript, Vitest, Testing Library, Tauri FS, SQLite

---

### Task 1: Extend config domain for provider registry

**Files:**
- Modify: `src/config/config.ts`
- Modify: `src/config/config.test.ts`

**Step 1: Write failing config tests**

- Add tests for:
  - loading legacy flat MiniMax config into new provider registry shape
  - loading new provider registry config
  - saving provider registry config

**Step 2: Run tests to verify failure**

Run:

```bash
pnpm test src/config/config.test.ts
```

Expected: FAIL due to missing provider registry support.

**Step 3: Implement minimal config model**

- Introduce new config types:
  - provider entry
  - global defaults
  - runtime status for compatibility usage in App
- Keep backward-compatible loading of old flat MiniMax fields.
- Save always in new provider registry format.

**Step 4: Re-run tests**

Run:

```bash
pnpm test src/config/config.test.ts
```

Expected: PASS.

### Task 2: Persist per-session provider/model selection

**Files:**
- Modify: `src/storage/migrations.ts`
- Modify: `src/storage/migrations.test.ts`
- Modify: `src/storage/chatThreadStore.ts`
- Modify: `src/storage/chatThreadStore.test.ts`

**Step 1: Write failing migration and store tests**

- Add expectations for `chat_threads` columns:
  - `llm_provider`
  - `llm_model`
- Add save/load assertions in `chatThreadStore` tests.

**Step 2: Run tests to verify failure**

Run:

```bash
pnpm test src/storage/migrations.test.ts src/storage/chatThreadStore.test.ts
```

Expected: FAIL before schema/store updates.

**Step 3: Implement migration and store updates**

- Add conditional column migrations for new fields.
- Read/write `llmProvider` and `llmModel` in thread store.

**Step 4: Re-run tests**

Run:

```bash
pnpm test src/storage/migrations.test.ts src/storage/chatThreadStore.test.ts
```

Expected: PASS.

### Task 3: Add provider/runtime resolution helper

**Files:**
- Create: `src/llm/providerRuntime.ts`
- Create: `src/llm/providerRuntime.test.ts`
- Modify: `src/App.tsx`

**Step 1: Write failing runtime resolution tests**

- Add tests for:
  - selecting per-session provider/model
  - fallback to global defaults
  - provider unavailable/disabled handling

**Step 2: Run tests to verify failure**

Run:

```bash
pnpm test src/llm/providerRuntime.test.ts
```

Expected: FAIL because helper does not exist yet.

**Step 3: Implement runtime resolution**

- Return effective `{ provider, model, baseUrl, apiKey }` from:
  - session selection
  - global provider config
  - global defaults
- Provide a user-readable error for unresolved selection.

**Step 4: Re-run tests**

Run:

```bash
pnpm test src/llm/providerRuntime.test.ts
```

Expected: PASS.

### Task 4: Replace composer Deep Research chip with model chip UI

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/App.css`
- Modify: `src/app/app-ui.test.tsx`

**Step 1: Write failing UI tests**

- Add tests that verify:
  - model chip appears in composer and shows model name only
  - clicking chip reveals grouped provider model list
  - selecting model updates current session model
  - Deep Research remains as icon-only toggle

**Step 2: Run tests to verify failure**

Run:

```bash
pnpm test src/app/app-ui.test.tsx
```

Expected: FAIL before UI update.

**Step 3: Implement minimal UI changes**

- Add `model chip + grouped popover` in composer left area.
- Move Deep Research to icon-only control.
- Keep existing compose/send/stop semantics unchanged.

**Step 4: Re-run tests**

Run:

```bash
pnpm test src/app/app-ui.test.tsx
```

Expected: PASS.

### Task 5: Wire runtime calls to selected provider/model

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/app/app-ui.test.tsx`
- Modify: `src/app/app-shell.test.tsx`

**Step 1: Write failing behavior tests**

- Add test coverage for:
  - new chats inheriting global default provider/model
  - run requests using selected session provider config

**Step 2: Run tests to verify failure**

Run:

```bash
pnpm test src/app/app-ui.test.tsx src/app/app-shell.test.tsx
```

Expected: FAIL until request routing uses session selection.

**Step 3: Implement routing integration**

- Replace hard-coded MiniMax request values with provider runtime resolver.
- Apply same resolver for:
  - send
  - retry
  - approval resume
  - title generation path

**Step 4: Re-run tests**

Run:

```bash
pnpm test src/app/app-ui.test.tsx src/app/app-shell.test.tsx
```

Expected: PASS.

### Task 6: Full regression and diagnostics

**Files:**
- Modify: `src/config/config.ts`
- Modify: `src/storage/migrations.ts`
- Modify: `src/storage/chatThreadStore.ts`
- Modify: `src/App.tsx`
- Modify: tests touched above

**Step 1: Run focused regression**

Run:

```bash
pnpm test src/config/config.test.ts src/storage/migrations.test.ts src/storage/chatThreadStore.test.ts src/llm/providerRuntime.test.ts src/app/app-ui.test.tsx src/app/app-shell.test.tsx
```

Expected: PASS.

**Step 2: Run broader regression**

Run:

```bash
pnpm test src/app/app-ui.test.tsx src/app/runMessages.test.ts src/app/renderAssistantBlocks.test.tsx src/app/threadFollowPolicy.test.ts src/runtime/runtime.files.test.ts src/tools/listDirTool.test.ts src/tools/readFileTool.test.ts src/tools/globFilesTool.test.ts src/tauri/tauriFileOps.test.ts src/storage/sessionStore.test.ts
```

Expected: PASS.

**Step 3: Check diagnostics**

- Run diagnostics on modified TS/TSX/CSS files and fix new issues.
