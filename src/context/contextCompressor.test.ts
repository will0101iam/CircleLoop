import { describe, expect, it, vi } from 'vitest'
import type { OpenAICompatChatMessage } from '../llm/openaiCompat'
import { compressContextWithMinimax, renderCompressionSummaryMessage } from './contextCompressor'

describe('contextCompressor', () => {
  it('creates a structured summary from oversized history', async () => {
    const summarize = vi.fn(async () => ({
      userGoals: ['完成审批门'],
      keyDecisions: ['消息内确认'],
      touchedFiles: [{ path: 'src/agent/runEngine.ts', reason: '引擎暂停恢复' }],
      issuesAndFixes: ['旧上下文过长，需要压缩'],
      pendingWork: ['实现 approvalPolicy'],
      nextStep: '继续实现 pathGuard',
    }))

    const result = await compressContextWithMinimax({
      messages: [
        { role: 'user', content: '第一轮非常长非常长非常长' },
        { role: 'assistant', content: '第二轮非常长非常长非常长' },
      ] as OpenAICompatChatMessage[],
      maxContextChars: 10,
      summarize,
    })

    expect(result.mode).toBe('compressed')
    expect(result.summary.pendingWork).toEqual(['实现 approvalPolicy'])
  })

  it('renders the structured summary as a system message', () => {
    const message = renderCompressionSummaryMessage({
      userGoals: ['完成审批门'],
      keyDecisions: ['消息内确认'],
      touchedFiles: [{ path: 'src/agent/runEngine.ts', reason: '引擎暂停恢复' }],
      issuesAndFixes: ['旧上下文过长，需要压缩'],
      pendingWork: ['实现 approvalPolicy'],
      nextStep: '继续实现 pathGuard',
    })

    expect(message).toEqual({
      role: 'system',
      content: expect.stringContaining('当前未完成事项'),
    })
  })
})
