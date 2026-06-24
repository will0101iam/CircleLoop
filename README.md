# CircleLoop

CircleLoop is a local desktop agent app built with React, TypeScript, Vite, and Tauri. It is designed as an early Claude Code-style coding agent shell: you configure model providers, choose a workspace, chat with an agent, and let the agent call tools with a visible timeline and approval flow.

Yes, CircleLoop is an app package. During development it runs as a Tauri desktop window backed by Vite. For release builds, `pnpm tauri:build` produces native desktop bundles for the current platform, such as a macOS `.app` or `.dmg`.

## Current Agent Features

- Multi-turn agent loop: the model can answer directly or request tool calls, then CircleLoop executes the tools and feeds the results back into the next model turn.
- OpenAI-compatible tool calling: internal tools are exposed to the model as function tools.
- Human approval flow: risky actions can pause the run, ask for confirmation, then resume from the pending tool call.
- Timeline visibility: each run records model requests, tool calls, tool execution, tool results, approvals, denied tools, final content, and plan updates.
- Workspace-aware file tools: the agent can list directories, read files, search code, write files, edit files, create directories, and delete files inside the selected workspace.
- Command execution tool: the agent can run local commands when a workspace is selected, with policy checks before execution.
- Path and command safety checks: file access is guarded by the selected workspace, and command risk is evaluated before running.
- Rollback foundation for file changes: file write/delete/mkdir operations can be journaled so changes can be reverted.
- Task planning tool: the agent can call `update_plan` to maintain a visible task checklist.
- Local session storage: conversations and app state are persisted with the app database.
- Per-session model choice: each chat session can use a different configured provider/model.

## Model Providers

CircleLoop is centered on OpenAI-compatible chat completion APIs. The settings page includes provider configuration for:

- OpenRouter
- OpenAI
- DeepSeek
- GLM
- Kimi / Moonshot
- MiniMax
- Volcengine Ark
- Aliyun Bailian
- Xiaomi MiMo
- Ollama
- LiteLLM
- Custom OpenAI-compatible endpoint

Some CodePilot-style provider entries are shown in the UI for parity, but providers that are not currently OpenAI-compatible in CircleLoop are marked as unavailable until a dedicated runtime adapter exists.

Important limitation: CircleLoop expects models that support tool/function calling. Models without tool calling are not currently supported through a ReAct text fallback.

## Install For Development

Prerequisites:

- Node.js
- pnpm
- Rust and Cargo
- Tauri system dependencies for your OS

Install dependencies:

```bash
pnpm install
```

Run the desktop app in development mode:

```bash
pnpm tauri:dev
```

This starts the Vite dev server and opens the CircleLoop Tauri desktop window.

## Build An App Package

Create a production desktop build:

```bash
pnpm tauri:build
```

The generated packages are written under:

```text
src-tauri/target/release/bundle/
```

On macOS, expect outputs such as `.app` and `.dmg`. On Windows or Linux, Tauri generates the matching installer/package formats for that platform according to the active Tauri bundle configuration.

## Basic Usage

1. Open CircleLoop with `pnpm tauri:dev` or an installed app build.
2. Open `设置` from the bottom of the left sidebar.
3. Go to the service provider page and connect a model provider.
4. Fill in Base URL, API Key, default model, and available models. Ollama hides API Key because it runs locally.
5. Choose the default model in settings.
6. Select a workspace folder for the session.
7. Use the model chip near the chat input to choose the session model.
8. Ask the agent to inspect files, search code, make edits, run commands, or maintain a plan.
9. Review approval prompts before risky file or command actions.

## Useful Commands

```bash
pnpm dev          # Run only the Vite frontend
pnpm tauri:dev   # Run the desktop app for development
pnpm build       # Type-check and build the frontend
pnpm tauri:build # Build native desktop app packages
pnpm test        # Run the Vitest test suite
pnpm lint        # Run ESLint
```

## Project Shape

- `src/App.tsx`: main UI shell, chat view, settings view, provider dialogs, and run event wiring.
- `src/agent/runEngine.ts`: agent loop, tool-call handling, approval pause/resume, and timeline events.
- `src/runtime/runtime.ts`: runtime creation and tool registration.
- `src/tools/`: tool definitions for files, commands, sessions, SQL, and planning.
- `src/llm/`: OpenAI-compatible transport, provider runtime resolution, and tool schema conversion.
- `src-tauri/`: Tauri desktop app configuration and native wrapper.
