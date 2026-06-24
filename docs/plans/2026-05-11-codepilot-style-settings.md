# CodePilot Style Settings Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Move CircleLoop's model settings page to the CodePilot-style interaction model: lightweight provider rows plus connect/edit dialogs, while keeping CircleLoop's OpenAI-compatible provider configuration.

**Architecture:** Keep the existing right-side settings page and provider draft state. Replace inline provider editors and the add-provider popover with list rows that open a local settings dialog. Preserve all chat, agent, runtime, storage, and provider transport logic.

**Tech Stack:** React, TypeScript, CSS, Vitest, Testing Library.

---

### Task 1: Lock The Settings Interaction With Tests

**Files:**
- Modify: `src/app/app-ui.test.tsx`

**Steps:**
1. Update the settings UI test so connected providers render as rows with `编辑` actions.
2. Assert clicking `编辑` opens a dialog titled `编辑 OpenRouter`.
3. Assert clicking `+ 连接` for Ollama opens a dialog titled `连接 Ollama`.
4. Assert Ollama's dialog does not render `API Key`, while cloud provider dialogs do.
5. Run `pnpm test src/app/app-ui.test.tsx -- --runInBand` or the project equivalent and verify the new assertions fail before implementation.

### Task 2: Implement Dialog State And Provider Rows

**Files:**
- Modify: `src/App.tsx`

**Steps:**
1. Replace `settingsExpandedProvider` with a dialog state describing `{ providerId, mode }`.
2. Render configured providers as compact rows only.
3. Render available providers as compact add rows with `+ 连接`.
4. Add one dialog component inside `App.tsx` for provider connect/edit.
5. Keep all existing provider draft updates, validation, save, and test-connection helpers.

### Task 3: Adjust Settings Styling

**Files:**
- Modify: `src/App.css`

**Steps:**
1. Reduce heavy borders to CodePilot-like light row separators.
2. Style provider rows and add rows as compact list items.
3. Add responsive dialog styles with safe max width/height and internal scrolling.
4. Keep small-window behavior stable.

### Task 4: Verify

**Files:**
- Test: `src/app/app-ui.test.tsx`
- Test: `src/app/app-shell.test.tsx`
- Test: `src/llm/providerSettings.test.ts`

**Steps:**
1. Run focused UI tests.
2. Run provider settings tests.
3. Run diagnostics for edited files.
4. Manually inspect that chat/agent code paths were not touched.
