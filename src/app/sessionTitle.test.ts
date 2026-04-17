import { describe, expect, it } from 'vitest'
import { buildFallbackSessionTitle, resolveSessionTitleFromPrompt, shouldGenerateSessionTitle } from './sessionTitle'

describe('sessionTitle', () => {
  it('generates a title only for the first user prompt on default-titled chats', () => {
    expect(
      shouldGenerateSessionTitle({
        currentTitle: 'New Chat',
        existingUserMessageCount: 0,
      }),
    ).toBe(true)

    expect(
      shouldGenerateSessionTitle({
        currentTitle: 'Refactor run engine',
        existingUserMessageCount: 0,
      }),
    ).toBe(false)

    expect(
      shouldGenerateSessionTitle({
        currentTitle: 'New Chat',
        existingUserMessageCount: 1,
      }),
    ).toBe(false)
  })

  it('falls back to a short truncated title without filling the full sidebar width', () => {
    expect(buildFallbackSessionTitle('请帮我把这个超长超长超长超长超长的需求总结成标题')).toBe('请帮我把这个超长…')
    expect(buildFallbackSessionTitle('Refactor the approval flow and fix persistence issues')).toBe(
      'Refactor the approval flo…',
    )
  })

  it('accepts generated titles only when they are derived from the first user prompt', () => {
    expect(resolveSessionTitleFromPrompt('没看到', '没看到')).toBe('没看到')
    expect(resolveSessionTitleFromPrompt('没看到', '文档创建排查')).toBe('没看到')
    expect(resolveSessionTitleFromPrompt('请帮我修复 approval flow 的问题', 'approval flow')).toBe('approval flow')
  })
})
