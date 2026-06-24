# CodePilot Settings Layout Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Align CircleLoop's settings entry and settings page layout with CodePilot while preserving CircleLoop chat and agent behavior.

**Architecture:** Replace the sidebar footer with a full-width settings button. Restructure the settings page into a CodePilot-style header, inner settings navigation, and scrollable content area. Keep provider state, save logic, dialogs, and chat runtime unchanged.

**Tech Stack:** React, TypeScript, CSS, Vitest, Testing Library.

---

### Task 1: UI Tests

**Files:**
- Modify: `src/app/app-ui.test.tsx`

**Steps:**
1. Assert sidebar footer only exposes a full-width `设置` button.
2. Assert old footer items `bytedance`, `Status`, and `History` are removed.
3. Assert settings page has a CodePilot-like header plus inner navigation with `服务商`.
4. Run `pnpm test src/app/app-ui.test.tsx` and confirm failure.

### Task 2: Implementation

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/App.css`

**Steps:**
1. Replace the footer markup with one settings button.
2. Move settings title/subtitle into a top header spanning the settings page.
3. Change `模型与渠道` label to `服务商`.
4. Adjust CSS to match CodePilot layout proportions.

### Task 3: Verification

**Files:**
- Test: `src/app/app-ui.test.tsx`
- Test: `src/app/app-shell.test.tsx`
- Test: `src/llm/providerSettings.test.ts`
- Test: `src/config/config.test.ts`

**Steps:**
1. Run `pnpm test src/app/app-ui.test.tsx`.
2. Run `pnpm test src/app/app-ui.test.tsx src/app/app-shell.test.tsx src/llm/providerSettings.test.ts src/config/config.test.ts`.
3. Run diagnostics on changed files.
