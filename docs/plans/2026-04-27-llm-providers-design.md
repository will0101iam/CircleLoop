# Multi-Provider LLM Design

**Goal:** Support multiple global LLM providers while letting each chat session choose its own model from a curated provider-specific list.

## Product Shape

- Global settings store all provider connection details.
- Supported providers in the first version:
  - MiniMax
  - OpenAI
  - OpenRouter
  - DeepSeek
  - GLM
  - Ollama
  - Custom OpenAI-compatible provider
- Claude official direct integration is explicitly out of scope.
- Each chat session stores only:
  - selected provider
  - selected model
- New chats default to the globally configured "common" provider/model.
- The composer replaces the current `Deep Research` text chip with a model chip that shows only the selected model name.
- Clicking the model chip opens a popover grouped by provider name. Models are manually curated in global settings and are the only selectable options.
- `Deep Research` remains available as an icon-only toggle near the composer controls.

## Configuration Design

The current config file stores a single provider in a flat structure. The new format needs:

- `defaults`
  - `provider`
  - `model`
- `providers`
  - keyed by provider id
  - each provider stores:
    - `label`
    - `baseUrl`
    - `apiKey` (optional for Ollama/custom local setups)
    - `models` (string array)
    - `defaultModel`
    - `enabled` (optional convenience flag)

Example shape:

```json
{
  "defaults": {
    "provider": "openrouter",
    "model": "gpt-4o-mini"
  },
  "providers": {
    "minimax": {
      "label": "MiniMax",
      "baseUrl": "https://api.minimaxi.com/v1",
      "apiKey": "secret",
      "models": ["MiniMax-M2.7"],
      "defaultModel": "MiniMax-M2.7"
    },
    "openrouter": {
      "label": "OpenRouter",
      "baseUrl": "https://openrouter.ai/api/v1",
      "apiKey": "secret",
      "models": ["gpt-4o-mini", "deepseek-chat"],
      "defaultModel": "gpt-4o-mini"
    },
    "ollama": {
      "label": "Ollama",
      "baseUrl": "http://localhost:11434/v1",
      "models": ["llama3.1", "qwen2.5-coder"],
      "defaultModel": "llama3.1"
    }
  }
}
```

## Backward Compatibility

- Existing flat MiniMax config must continue to load.
- On load:
  - if legacy fields are present, map them into the new structure under `providers.minimax`
  - create `defaults` from the legacy provider/model
- On save:
  - always write the new structure
- Existing callers that expect `configured/baseUrl/model/getApiKey` need a compatibility layer or new typed API so incremental migration is possible.

## Session Data Design

`ChatSummary` and persisted `chat_threads` metadata gain:

- `llmProvider: string | null`
- `llmModel: string | null`

Rules:

- If a session has no explicit provider/model, use global defaults.
- If a session points to a provider/model that no longer exists in the curated list:
  - continue showing the saved model in the chip
  - mark it as legacy/missing in the dropdown until the user reselects

## Runtime Routing

First version supports only OpenAI-compatible providers. All supported providers are routed through the existing `/chat/completions` transport.

Implementation rule:

- Build a single helper that resolves an effective provider config from:
  - current session selection
  - global provider registry
  - global defaults
- Return:
  - `provider`
  - `providerLabel`
  - `baseUrl`
  - `apiKey`
  - `model`

All places that currently call `createChatCompletionOpenAICompat` or `createChatCompletionStreamOpenAICompat` must use this resolved runtime config.

This includes:

- normal runs
- retry
- approval resume
- title generation fallback path

## UI Design

### Composer

- Replace the current `Deep Research` text chip with a new model chip.
- Model chip shows only the model text, for example `gpt-4o-mini`.
- Clicking it opens a grouped popover.
- The grouped popover shows:
  - provider heading
  - models underneath
  - current selection highlighted
  - unconfigured provider groups disabled

### Deep Research

- Keep feature behavior.
- Replace text chip with icon-only toggle.

### Global Settings Modal

- Convert from single MiniMax form to provider cards.
- Each provider card contains:
  - provider label
  - base URL
  - API key, if needed
  - default model
  - curated models list (one per line textarea)
- Add one global default section at the top:
  - default provider
  - default model

## Persistence and Migration

- `chat_threads` table already stores session metadata such as title and workspace.
- Add columns:
  - `llm_provider`
  - `llm_model`
- Update migration tests and storage tests.

## Testing Strategy

- Config tests:
  - load legacy MiniMax config into new provider registry
  - save/load new multi-provider config
  - secrets stay out of serialized status objects
- Storage tests:
  - `chat_threads` persists `llm_provider/llm_model`
- UI tests:
  - composer chip shows the session model
  - popover groups models by provider
  - selecting a model updates only the current session
  - new chats inherit the global default model/provider
  - missing provider groups are disabled
- Runtime tests:
  - selected session/provider determines the request base URL and model

## Out of Scope

- Claude official direct API
- Automatic provider model discovery
- Per-session API keys
- Provider-specific advanced options beyond base URL, API key, curated models, and default model
