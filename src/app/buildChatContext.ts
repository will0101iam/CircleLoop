import type { OpenAICompatChatMessage } from '../llm/openaiCompat'
import type { ThreadMessage } from './runMessages'

function toContextMessage(message: ThreadMessage): OpenAICompatChatMessage | null {
  if (message.kind === 'user') {
    return message.text.trim() ? { role: 'user', content: message.text } : null
  }

  if (message.kind === 'assistant') {
    return message.text.trim() ? { role: 'assistant', content: message.text } : null
  }

  if (message.kind === 'run') {
    return message.finalText?.trim() ? { role: 'assistant', content: message.finalText } : null
  }

  return null
}

function messageLength(message: OpenAICompatChatMessage): number {
  if (message.role === 'assistant' || message.role === 'user' || message.role === 'system') {
    return message.content.length
  }
  return 0
}

export function buildChatContextMessages(input: {
  systemMessage: OpenAICompatChatMessage
  thread: ThreadMessage[]
  newUserText: string
  maxContextChars: number
  compressionSummary?: string
}): OpenAICompatChatMessage[] {
  const history = input.thread
    .map((message) => toContextMessage(message))
    .filter((message): message is OpenAICompatChatMessage => Boolean(message))

  const newUserMessage: OpenAICompatChatMessage = { role: 'user', content: input.newUserText }
  const kept: OpenAICompatChatMessage[] = [newUserMessage]
  const summaryMessage = input.compressionSummary?.trim()
    ? ({ role: 'system', content: input.compressionSummary.trim() } as const)
    : null
  const hotTailCount = input.compressionSummary?.trim() ? 2 : 0
  let budget = messageLength(newUserMessage)
  if (summaryMessage) {
    budget += summaryMessage.content.length
  }
  let keptHistory = 0

  for (let i = history.length - 1; i >= 0; i -= 1) {
    const candidate = history[i]
    const nextLength = budget + messageLength(candidate)
    if (keptHistory >= hotTailCount && nextLength > input.maxContextChars) break
    kept.unshift(candidate)
    budget = nextLength
    keptHistory += 1
  }

  return summaryMessage ? [input.systemMessage, summaryMessage, ...kept] : [input.systemMessage, ...kept]
}
