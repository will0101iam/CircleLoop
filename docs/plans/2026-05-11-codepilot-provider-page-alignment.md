# CodePilot Provider Page Alignment Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Align CircleLoop's `模型与渠道` settings page with CodePilot's provider page structure, ordering, density, and provider brand icons while preserving CircleLoop's OpenAI-compatible provider logic.

**Architecture:** Keep CircleLoop's existing settings state, provider drafts, connection testing, and save logic. Update only the provider settings UI layer: merge diagnostics and default model into one top card, remove non-CodePilot extra preview card, render provider rows with brand icons, and use the existing connect/edit dialog.

**Tech Stack:** React, TypeScript, CSS, Vitest, Testing Library, `@lobehub/icons`.

---

### Task 1: Test The CodePilot-Like Structure

**Files:**
- Modify: `src/app/app-ui.test.tsx`

**Steps:**
1. Add assertions that `连接诊断` appears before `默认模型`, `已连接的提供商`, and `添加提供商`.
2. Assert the old extra `会话里的实际效果` card is gone.
3. Assert provider rows expose recognizable brand icon labels through accessible text or test ids.
4. Run `pnpm test src/app/app-ui.test.tsx` and verify the test fails before implementation.

### Task 2: Add Brand Icon Dependency

**Files:**
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`

**Steps:**
1. Run `pnpm add @lobehub/icons`.
2. Verify the dependency is recorded.

### Task 3: Implement Provider Icon Resolver And Layout

**Files:**
- Modify: `src/App.tsx`

**Steps:**
1. Import provider icons from `@lobehub/icons`.
2. Add a local `getProviderIcon(providerId, label, baseUrl)` helper.
3. Replace `AI` text marks with provider brand icons.
4. Merge diagnostics and default model into one top card with a divider.
5. Rename `已配置渠道` to `已连接的提供商`.
6. Rename `添加渠道` to `添加提供商`.
7. Remove the `会话里的实际效果` card.

### Task 4: Match CodePilot Density

**Files:**
- Modify: `src/App.css`

**Steps:**
1. Make provider rows visually closer to CodePilot rows.
2. Use light separators instead of heavy inner cards.
3. Keep responsive behavior and dialog safety.

### Task 5: Verify

**Files:**
- Test: `src/app/app-ui.test.tsx`
- Test: `src/app/app-shell.test.tsx`
- Test: `src/llm/providerSettings.test.ts`

**Steps:**
1. Run focused UI tests.
2. Run provider helper tests.
3. Run diagnostics on changed files.
4. Confirm no chat/agent files were changed.
