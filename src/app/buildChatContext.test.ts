import { describe, expect, it } from 'vitest'

import type { OpenAICompatChatMessage } from '../llm/openaiCompat'
import {
  createAssistantMessage,
  createPendingRunMessage,
  createUserMessage,
  completeRunMessage,
  type ThreadMessage,
} from './runMessages'
import { buildChatContextMessages } from './buildChatContext'

function systemPrompt(): OpenAICompatChatMessage {
  return {
    role: 'system',
    content: 'You are circleloop, a coding agent. Use tools when needed. Keep answers concise and precise.',
  }
}

describe('buildChatContextMessages', () => {
  it('includes prior user and assistant history before the new prompt', () => {
    const base: ThreadMessage[] = [
      createUserMessage('u1', '列出文件', '10:00'),
      completeRunMessage([createPendingRunMessage('r1', '10:00')], 'r1', {
        status: 'completed',
        finalText: '当前目录有两个文件。',
      })[0] as ThreadMessage,
    ]

    const messages = buildChatContextMessages({
      systemMessage: systemPrompt(),
      thread: base,
      newUserText: '对，读取第一个文件',
      maxContextChars: 10_000,
    })

    expect(messages).toEqual([
      systemPrompt(),
      { role: 'user', content: '列出文件' },
      { role: 'assistant', content: '当前目录有两个文件。' },
      { role: 'user', content: '对，读取第一个文件' },
    ])
  })

  it('does not feed thinking text or tool details back into model context', () => {
    const thread: ThreadMessage[] = completeRunMessage([createPendingRunMessage('r1', '10:00')], 'r1', {
      status: 'completed',
      thinkText: '先分析文件结构',
      events: [
        { id: 'e1', kind: 'tool_execute', phase: 'thinking', name: 'list_dir', args: { path: '.' }, anchor: 'thinking' },
      ],
      finalText: '目录里有 cc拆解.md。',
    })

    const messages = buildChatContextMessages({
      systemMessage: systemPrompt(),
      thread,
      newUserText: '继续',
      maxContextChars: 10_000,
    })

    expect(messages).toEqual([
      systemPrompt(),
      { role: 'assistant', content: '目录里有 cc拆解.md。' },
      { role: 'user', content: '继续' },
    ])
  })

  it('drops the oldest history when context budget is exceeded', () => {
    const thread: ThreadMessage[] = [
      createUserMessage('u1', '第一轮问题', '10:00'),
      createAssistantMessage('a1', '第一轮回答非常长非常长非常长', '10:00'),
      createUserMessage('u2', '第二轮问题', '10:01'),
      createAssistantMessage('a2', '第二轮回答', '10:01'),
    ]

    const messages = buildChatContextMessages({
      systemMessage: systemPrompt(),
      thread,
      newUserText: '第三轮问题',
      maxContextChars: 20,
    })

    expect(messages).toEqual([
      systemPrompt(),
      { role: 'user', content: '第二轮问题' },
      { role: 'assistant', content: '第二轮回答' },
      { role: 'user', content: '第三轮问题' },
    ])
  })

  it('prefers a structured summary plus hot tail before blunt truncation', () => {
    const thread: ThreadMessage[] = [
      createUserMessage('u1', '最初需求', '10:00'),
      createAssistantMessage('a1', '第一轮回答很长很长很长', '10:00'),
      createUserMessage('u2', '继续改', '10:01'),
      createAssistantMessage('a2', '最近回答', '10:01'),
    ]

    const messages = buildChatContextMessages({
      systemMessage: systemPrompt(),
      thread,
      newUserText: '继续',
      maxContextChars: 8,
      compressionSummary:
        'Summary:\n- 用户目标：完成当前功能\n- 关键决策：保留最近原文消息\n- 当前未完成事项：继续实现审批门',
    } as any)

    expect(messages).toEqual([
      systemPrompt(),
      {
        role: 'system',
        content:
          'Summary:\n- 用户目标：完成当前功能\n- 关键决策：保留最近原文消息\n- 当前未完成事项：继续实现审批门',
      },
      { role: 'user', content: '继续改' },
      { role: 'assistant', content: '最近回答' },
      { role: 'user', content: '继续' },
    ])
  })
})
