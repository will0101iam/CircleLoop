import type { OpenAICompatChatMessage } from '../llm/openaiCompat'

export type CompressionSummary = {
  userGoals: string[]
  keyDecisions: string[]
  touchedFiles: Array<{ path: string; reason: string }>
  issuesAndFixes: string[]
  pendingWork: string[]
  nextStep: string
}

export function renderCompressionSummaryMessage(summary: CompressionSummary): OpenAICompatChatMessage {
  return {
    role: 'system',
    content: [
      'Summary:',
      `- 用户目标：${summary.userGoals.join('；') || '无'}`,
      `- 关键决策：${summary.keyDecisions.join('；') || '无'}`,
      `- 涉及文件：${summary.touchedFiles.map((item) => `${item.path}（${item.reason}）`).join('；') || '无'}`,
      `- 问题与修复：${summary.issuesAndFixes.join('；') || '无'}`,
      `- 当前未完成事项：${summary.pendingWork.join('；') || '无'}`,
      `- 下一步：${summary.nextStep || '无'}`,
    ].join('\n'),
  }
}

export async function compressContextWithMinimax(input: {
  messages: OpenAICompatChatMessage[]
  maxContextChars: number
  summarize: (messages: OpenAICompatChatMessage[]) => Promise<CompressionSummary>
}): Promise<
  | { mode: 'passthrough'; messages: OpenAICompatChatMessage[] }
  | { mode: 'compressed'; summary: CompressionSummary; message: OpenAICompatChatMessage }
> {
  const totalChars = input.messages.reduce((sum, message) => {
    if (typeof message.content !== 'string') return sum
    return sum + message.content.length
  }, 0)

  if (totalChars <= input.maxContextChars) {
    return { mode: 'passthrough', messages: input.messages }
  }

  const summary = await input.summarize(input.messages)
  return {
    mode: 'compressed',
    summary,
    message: renderCompressionSummaryMessage(summary),
  }
}

