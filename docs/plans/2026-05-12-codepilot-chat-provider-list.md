# CodePilot Chat Provider List Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Show the same chat provider list as CodePilot in CircleLoop's provider settings UI, while preventing unsupported providers from being connected.

**Architecture:** Keep CircleLoop's current OpenAI-compatible runtime and provider persistence. Add a small UI catalog for CodePilot chat presets, mark presets that CircleLoop cannot run today as unsupported, and render them in the add-provider list with disabled actions and explanatory labels.

**Tech Stack:** React, TypeScript, CSS, Vitest, Testing Library, `@lobehub/icons`.

---

### Task 1: Add Failing UI Coverage

**Files:**
- Modify: `src/app/app-ui.test.tsx`

**Steps:**
1. Assert the add-provider list contains CodePilot chat provider names.
2. Assert unsupported providers show `暂不可用` and have no connect button.
3. Assert supported providers such as `OpenRouter` and `Ollama` remain connectable.
4. Run `pnpm test src/app/app-ui.test.tsx` and confirm the test fails.

### Task 2: Add UI Preset Catalog

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/App.css`
- Modify: `src/config/config.ts`

**Steps:**
1. Add CodePilot chat provider defaults to CircleLoop's provider registry.
2. Import provider icons directly from `@lobehub/icons/es/*/components/Mono`.
3. Render unsupported presets as disabled rows with a short compatibility note.
4. Keep `OpenAI-compatible` fields and Ollama API key hiding unchanged.

### Task 3: Verify

**Files:**
- Test: `src/app/app-ui.test.tsx`
- Test: `src/app/app-shell.test.tsx`
- Test: `src/llm/providerSettings.test.ts`

**Steps:**
1. Run `pnpm test src/app/app-ui.test.tsx`.
2. Run `pnpm test src/app/app-ui.test.tsx src/app/app-shell.test.tsx src/llm/providerSettings.test.ts`.
3. Run diagnostics on edited files.
