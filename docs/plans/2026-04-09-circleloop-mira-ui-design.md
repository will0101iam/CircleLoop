# circleloop Mira-Style Chat UI (Design)

Date: 2026-04-09

## Goal

Switch the current IDE-like shell to a Mira-style chat experience:

- Primary interaction is a chat/task stream.
- Each run can show:
  - A "Thinking completed" section (public-safe summary; NOT raw hidden chain-of-thought).
  - Tool calls and tool results as collapsible cards in the flow.
- Keep existing capability: configure MiniMax, choose workspace, run tool loop.
- Keep default Tauri window size at 800x600, but ensure UI is usable at this size.

## Non-Goals

- Do not display raw chain-of-thought. If the model returns `<think>...</think>`, strip it from the visible assistant content.
- No code editing UX (diff/patch editor) in this pass.
- No streaming UX in this pass (non-streaming OpenAI-compatible request only).

## Information Architecture

### Layout (Desktop, 800x600 baseline)

- Left: Sidebar
  - Top: App logo/title ("Mira-like")
  - Actions: New Chat / Task / Customize (stubs ok)
  - Recents: chat list
  - At 800x600: sidebar collapses into a hamburger button; open as an overlay drawer.

- Center: Chat Canvas
  - Title bar: current chat title, workspace chip, MiniMax status chip, "Configure MiniMax" button, "Choose Workspace" button.
  - Scrollable message list.
  - Bottom fixed composer (single-line + optional expand):
    - Input box
    - Attach (disabled placeholder)
    - Send/Run

### Message Types

Represent the conversation as a sequence of renderable items.

- UserMessage: { role: 'user', text, time }
- AssistantMessage: { role: 'assistant', text, time, runId? }
- RunBlock: { runId, startedAt, status, thinkingSummary?, toolEvents[] }

We can render RunBlock inline immediately after the user message that triggered it.

## Timeline -> UI Mapping

We already have `runEngine.timeline` events:

- `llm_request`: internal, do not display by default (optional debug toggle).
- `llm_tool_calls`: display as "Tool Calls" block with N calls (each call collapsible).
- `tool_execute`: display as a card:
  - Title: tool name
  - Body: arguments JSON (collapsed by default)
- `tool_result`: display as a card:
  - Title: tool name + ok/error pill
  - Body: result JSON summary (collapsed by default)
- `llm_content`: display as assistant message text (after sanitization).

Grouping:

- Create a new `runId` per Send/Run click.
- Collect timeline events into `RunBlock.toolEvents`.
- Render `RunBlock` between the user's task message and the assistant final answer message.

## "Thinking" Display (Safe)

### Requirement

User wants a "thinking" area similar to Mira, but we must not show raw private reasoning.

### Strategy

- If assistant content includes `<think>...</think>`, remove it from the visible final text.
- Produce a public-safe thinking summary for display:
  - Prefer: parse `<think>...</think>` and convert to a short bullet summary via a local summarizer function (no extra model call) using heuristics:
    - Extract up to N lines, truncate to a max char count, remove obviously sensitive markers (e.g. "system prompt", "API key", "internal").
    - Label it "Thinking completed" and show as collapsed by default.
  - If no `<think>` exists: optionally show a "Plan" summary derived from timeline:
    - "Will use tools: list_dir → search_code → read_file" based on observed tool calls.

Security note:

- Never show secrets from tool results.
- In UI, collapse tool results by default and show a limited preview (first 2-4 lines).

## Error Handling

- If not in Tauri: show a single inline warning banner "Desktop required" and disable buttons that call plugins.
- If MiniMax not configured: show an inline assistant message prompting to use "Configure MiniMax".
- If runtime not ready (no workspace): show assistant prompt "Please choose workspace".
- For tool errors: render error pill and allow expanding the JSON error.

## Component Plan (Within `App.tsx` Initially)

Keep changes minimal:

- Replace the root `ide-*` layout with `mira-*` layout.
- Keep existing state and handlers:
  - `handlePickWorkspace`, `handleSaveModelSettings`, `handleSendRun`
  - `configStatus`, `workspacePath`, `runtime`
- Introduce:
  - `drawerOpen` state for sidebar overlay at small size.
  - `runs` state keyed by runId to store timeline + thinking summary.
  - `sanitizeAssistantContent(content): { visibleText, thinkText? }`.

## CSS Requirements

- Must work at 800x600 without horizontal scrolling.
- Sidebar: collapsible overlay (position: fixed) when viewport width < ~980px.
- Composer: fixed at bottom, message list padding-bottom equals composer height.
- Cards: max-width constrained, readable typography, collapsible details.

## Test Plan (High Value Only)

- Update UI shell test to assert Mira-like chrome exists (sidebar toggle, composer, chat list).
- Add a unit test for sanitization:
  - input includes `<think>secret</think>visible`
  - output shows visible text only and extracts thinkText.

## Rollout / Verification

- Manual: Tauri app
  - Configure MiniMax -> choose workspace -> Send/Run
  - Verify: thinking block shows summary, tool cards show tool calls/results, no `<think>` leaks into final assistant content.

