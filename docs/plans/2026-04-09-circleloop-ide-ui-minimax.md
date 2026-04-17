# circleloop IDE UI + MiniMax-M2.7 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement the approved “IDE-style” UI (left chats, top mode switch, right prompt) plus MiniMax-M2.7 OpenAI-compatible tool-loop execution.

**Architecture:** Keep a single Runtime + ToolRegistry + RunEngine core. UI is a thin client that triggers a Run with (workspacePath + userPrompt), renders the timeline, and shows configuration status from `$APPCONFIG/circleloop/config.json`.

**Tech Stack:** Tauri v2 (plugins: dialog/fs/sql), React + Vite, Vitest, fetch-based OpenAI-compatible client.

---

## Guardrails

- Do not log secrets (apiKey) to console, logs, or SQLite.
- Keep web preview safe: in non-Tauri environment, show “desktop required” and do not attempt to call plugins.
- Keep workspace boundary enforcement: all file tools must resolve under workspace and reject absolute/`..`.
- No git commits unless the user explicitly requests.

## UX Targets (Approved)

- Remove right-side Inspector module; right side becomes the Prompt panel (textarea + Attach + Send/Run).
- Mode switch (Chat/Code/Runs/Diff for mock; MVP can start with Chat/Code, keep Runs/Diff accessible) lives in the top bar.
- Chat mode is lightweight for “talk” tasks; Code mode is for browsing/editing; both use the same RunEngine.

---

## Task 1: Read MiniMax Config From `$APPCONFIG/circleloop/config.json`

**Files:**
- Create: `/Users/bytedance/Desktop/1400/circleloop/src/config/config.ts`
- Create: `/Users/bytedance/Desktop/1400/circleloop/src/config/config.test.ts`
- Modify (later wiring): `/Users/bytedance/Desktop/1400/circleloop/src/runtime/runtime.ts`

**Step 1: Write failing test**

Create tests for:
- returns `configured=false` when not in Tauri
- parses valid JSON with `{ provider, baseUrl, apiKey, model }`
- returns `configured=false` on parse error
- never returns apiKey in a stringified “status” field

**Step 2: Run test to verify it fails**

Run: `pnpm test src/config/config.test.ts`

**Step 3: Minimal implementation**

Implement:
- `getConfigPath()` -> `$APPCONFIG/circleloop/config.json` resolved using `@tauri-apps/api/path` (`appConfigDir` + join) in Tauri, otherwise returns `null`
- `loadMinimaxConfig()` -> reads file via `@tauri-apps/plugin-fs.readTextFile` (dynamic import) only if `isTauri()` is true
- Returns `{ configured: boolean, configPath: string | null, provider, baseUrl, model }` and keeps apiKey only in a non-serializable place (in-memory only), e.g. return `{ apiKey?: string }` but never expose in UI text

**Step 4: Run test to verify it passes**

Run: `pnpm test src/config/config.test.ts`

---

## Task 2: OpenAI-Compatible MiniMax Client (Non-Streaming MVP)

**Files:**
- Create: `/Users/bytedance/Desktop/1400/circleloop/src/llm/openaiCompat.ts`
- Create: `/Users/bytedance/Desktop/1400/circleloop/src/llm/openaiCompat.test.ts`

**Step 1: Write failing test**

Test that:
- sends POST `${baseUrl}/chat/completions`
- uses `Authorization: Bearer ${apiKey}`
- includes `model: "MiniMax-M2.7"`
- supports `tools` payload and returns normalized response shape used by RunEngine

**Step 2: Run test to verify it fails**

Run: `pnpm test src/llm/openaiCompat.test.ts`

**Step 3: Minimal implementation**

Implement:
- `createOpenAICompatClient({ baseUrl, apiKey, model })`
- `chatComplete({ messages, tools })` returning `{ assistantText?, toolCalls? }`
- Parse OpenAI-like tool calling (`tool_calls`) if present; otherwise return assistant text

**Step 4: Run test to verify it passes**

Run: `pnpm test src/llm/openaiCompat.test.ts`

---

## Task 3: Tool Schemas + RunEngine (Tool Loop)

**Files:**
- Create: `/Users/bytedance/Desktop/1400/circleloop/src/agent/runEngine.ts`
- Create: `/Users/bytedance/Desktop/1400/circleloop/src/agent/runEngine.test.ts`
- Modify: `/Users/bytedance/Desktop/1400/circleloop/src/tools/toolRegistry.ts`
- Modify (or create): `/Users/bytedance/Desktop/1400/circleloop/src/tools/toolSchemas.ts`

**Step 1: Write failing test**

Cover:
- given a scripted LLM response that requests `list_dir`, engine executes tool, appends tool_result, and continues
- stop at `maxSteps`
- supports Stop signal
- keeps a timeline array with step entries: `{ kind: "llm"|"tool"|"error", title, summary, raw? }`

**Step 2: Run test to verify it fails**

Run: `pnpm test src/agent/runEngine.test.ts`

**Step 3: Minimal implementation**

Implement:
- `ToolDefinition` extended to include `description` and a JSON-schema-ish `inputSchema` for LLM tools payload
- `createToolSchemas(runtimeTools)` that builds OpenAI `tools: [{ type:"function", function:{ name, description, parameters } }]`
- `createRunEngine({ llmClient, toolRegistry, contextBuilder })` with `run({ task, workspacePath, sessionId })`
- ContextBuilder MVP: include task + a short “workspace summary” string + last N timeline summaries (not raw tool results)

**Step 4: Run test to verify it passes**

Run: `pnpm test src/agent/runEngine.test.ts`

---

## Task 4: `search_code` Tool (Workspace-Limited)

**Files:**
- Create: `/Users/bytedance/Desktop/1400/circleloop/src/tools/searchCodeTool.ts`
- Create: `/Users/bytedance/Desktop/1400/circleloop/src/tools/searchCodeTool.test.ts`
- Modify: `/Users/bytedance/Desktop/1400/circleloop/src/runtime/runtime.ts`

**Step 1: Write failing test**

Test with injected `fileOps` that:
- enumerates files under workspace (recursive) with a max file count
- searches for a substring query in text files
- returns matches with `{ file, line, preview }`
- rejects traversal / absolute paths

**Step 2: Run test to verify it fails**

Run: `pnpm test src/tools/searchCodeTool.test.ts`

**Step 3: Minimal implementation**

Implement:
- recursive directory walk via `fileOps.listDir`
- file reads via `fileOps.readTextFile`
- limits: maxFiles, maxFileBytes, maxMatches

**Step 4: Run test to verify it passes**

Run: `pnpm test src/tools/searchCodeTool.test.ts`

---

## Task 5: Replace Real App UI With Approved IDE Layout

**Files:**
- Modify: `/Users/bytedance/Desktop/1400/circleloop/src/App.tsx`
- (Optional) Create: `/Users/bytedance/Desktop/1400/circleloop/src/ui/components/*` if needed
- Create: `/Users/bytedance/Desktop/1400/circleloop/src/app/app-ui.test.tsx`

**Step 1: Write failing test**

Test that:
- renders left “Chats/Tasks” panel
- renders top mode switch in the top bar
- renders right Prompt panel
- config status shows “未配置” when config missing

**Step 2: Run test to verify it fails**

Run: `pnpm test src/app/app-ui.test.tsx`

**Step 3: Minimal implementation**

Implement UI with minimal state:
- `mode`: "chat" | "code" | "runs" | "diff"
- `workspacePath` chosen via existing `chooseWorkspace()`
- `configStatus` loaded via `loadMinimaxConfig()`
- right prompt textarea triggers `runEngine.run()`
- timeline rendered in Runs view; chat view appends user/assistant messages

**Step 4: Run test to verify it passes**

Run: `pnpm test src/app/app-ui.test.tsx`

---

## Task 6: Wire Everything In Runtime

**Files:**
- Modify: `/Users/bytedance/Desktop/1400/circleloop/src/runtime/runtime.ts`

**Steps:**
- Ensure runtime constructs:
  - db + sessionStore
  - toolRegistry with: list_dir, read_file, search_code, query_sql, create_session, list_sessions
  - config loader + llm client (only when configured)
  - runEngine (only when configured)
- Add a small runtime test that stubs llm and verifies tool registration doesn’t crash.

---

## Task 7: Verification (No Regressions)

Run:
- `pnpm test`
- `pnpm build`
- `cargo check --manifest-path src-tauri/Cargo.toml`

Manual:
- `pnpm tauri:dev`
- choose workspace
- fill `$APPCONFIG/circleloop/config.json`
- run a task: “搜索 auth 并解释入口”
- verify timeline steps appear and stop button works
