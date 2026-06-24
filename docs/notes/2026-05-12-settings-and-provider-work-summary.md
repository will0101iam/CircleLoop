# Settings And Provider Work Summary

Date: 2026-05-12

## Goal

Make CircleLoop support multiple LLM providers while keeping provider credentials global, allowing each chat session to choose its own model, and reshaping the settings experience to follow CodePilot's provider settings style without copying Claude Code-specific business logic.

## Product Decisions

- Global settings own provider credentials, base URLs, curated model lists, and default model.
- Each chat session stores only its selected provider and model.
- New chats inherit the global default provider and model.
- Existing chats keep their own selected model when the global default changes.
- The composer model chip sits on the left side of the input area and shows only the model name.
- The model picker is grouped by provider and only shows configured providers with manually maintained models.
- Models without compatible function calling/tool-call behavior are not supported through a ReAct fallback.

## Provider Scope

CircleLoop remains OpenAI-compatible first.

Supported or connectable in the UI:

- OpenRouter
- GLM CN
- GLM Global
- Kimi Coding Plan
- Moonshot
- MiniMax CN
- MiniMax Global
- Volcengine Ark
- Xiaomi MiMo
- Xiaomi MiMo Token Plan
- Aliyun Bailian
- Ollama
- LiteLLM
- OpenAI
- DeepSeek
- Custom OpenAI-compatible

Shown but not connectable without future runtime work:

- Anthropic official
- Anthropic third-party API
- AWS Bedrock
- Google Vertex

Not copied from CodePilot:

- Claude CLI
- OpenAI OAuth
- Claude Code SDK provider logic
- Anthropic SDK/provider runtime
- Bedrock runtime
- Vertex runtime
- Gemini image provider logic

## Settings UI Decisions

- Main sidebar stays focused on chat/agent workflow.
- Skills and MCP live inside settings, not the main sidebar.
- CLI tools and asset library are not included.
- The settings entry is a full-width button at the bottom of the left sidebar.
- Old sidebar footer items were removed: user pill, Status, and History.
- Settings is a page in the main content area, not a modal.
- Settings layout follows CodePilot's structure:
  - top header with title and subtitle
  - left settings navigation
  - right scrollable content area
- The provider tab label is `服务商`, replacing `模型与渠道`.
- The provider page keeps CircleLoop fields: Base URL, API Key, Default Model, Models.
- Ollama hides API Key completely.
- Provider rows use brand icons from `@lobehub/icons`.
- Provider row descriptions and dialog subtitles use CodePilot-style provider descriptions.
- `已连接` badges were removed from the connected provider list because the section title already communicates that state.
- The page-level save button was removed.
- Provider connect/edit dialogs save their own provider changes.
- Default model selection auto-saves.
- Deleting a provider config auto-saves and moves it back to the add-provider list.
- `断开` was renamed to `删除配置` to make the destructive action explicit.

## Important Files

- `src/config/config.ts`
  - Defines provider config types, defaults, provider catalog, and backward compatibility with the old MiniMax-only config.
- `src/llm/providerRuntime.ts`
  - Resolves the current provider runtime from global config plus chat-level provider/model.
- `src/llm/openaiCompat.ts`
  - Sends OpenAI-compatible chat/completions requests and supports empty API key for local providers like Ollama.
- `src/llm/providerSettings.ts`
  - Contains settings-page helper logic for parsing models, filtering configured providers, validating saves, and testing connection.
- `src/storage/migrations.ts`
  - Adds `llm_provider` and `llm_model` columns to chat threads.
- `src/storage/chatThreadStore.ts`
  - Persists per-session provider/model metadata.
- `src/App.tsx`
  - Owns settings UI, provider dialogs, sidebar settings entry, default model picker, and composer model chip.
- `src/App.css`
  - Owns settings layout, provider rows, dialogs, responsive behavior, and sidebar settings button.
- `src/app/app-ui.test.tsx`
  - Covers settings page behavior, provider rows, dialogs, Ollama API key hiding, and sidebar settings entry.
- `src/config/config.test.ts`
  - Covers config defaults and provider catalog behavior.
- `src/llm/providerSettings.test.ts`
  - Covers provider settings helper behavior.

## Verification Commands

Most recent verification:

```bash
pnpm test src/app/app-ui.test.tsx
pnpm test src/app/app-ui.test.tsx src/app/app-shell.test.tsx src/llm/providerSettings.test.ts src/config/config.test.ts
```

Result:

- 4 test files passed.
- 36 tests passed.
- `App.css` and `app-ui.test.tsx` had no diagnostics.
- `App.tsx` only had an existing TypeScript hint for deprecated `document.execCommand`.

## Known Product Notes

- Changing the global default model does not change existing conversations.
- To change the current conversation model, use the model chip in the composer.
- Some OpenRouter free/community models may reject CircleLoop's tool schema even if they can chat normally.
- CircleLoop does not currently support text-only ReAct fallback for non-tool-call models.
- The provider list visually follows CodePilot, but unsupported providers remain disabled until their runtimes are implemented.

## Related Plan Docs

- `docs/plans/2026-04-27-llm-providers-design.md`
- `docs/plans/2026-04-27-llm-providers-implementation.md`
- `docs/plans/2026-05-11-codepilot-style-settings.md`
- `docs/plans/2026-05-11-codepilot-provider-page-alignment.md`
- `docs/plans/2026-05-12-codepilot-chat-provider-list.md`
- `docs/plans/2026-05-12-codepilot-settings-layout.md`
