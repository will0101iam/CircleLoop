export type SanitizedThink = {
  visibleText: string
  thinkText: string | null
}

function stripTrailingThinkFragments(input: string) {
  return input
    .replace(/<\/t(?:h(?:i(?:n(?:k)?)?)?)?$/i, '')
    .replace(/<t(?:h(?:i(?:n(?:k)?)?)?)?$/i, '')
}

/**
 * Extracts the first <think>...</think> block (if any) from model output.
 * We never render raw <think> as part of the visible assistant message.
 */
export function sanitizeThink(input: string): SanitizedThink {
  const text = typeof input === 'string' ? input : ''
  const lower = text.toLowerCase()
  const openTag = '<think>'
  const closeTag = '</think>'
  const lastOpenIndex = lower.lastIndexOf(openTag)
  const lastCloseIndex = lower.lastIndexOf(closeTag)

  if (lastOpenIndex !== -1 && lastCloseIndex < lastOpenIndex) {
    const rawVisible = text.slice(0, lastOpenIndex)
    const thinkRaw = text.slice(lastOpenIndex + openTag.length)
    const thinkText = stripTrailingThinkFragments(thinkRaw).trim()
    return {
      visibleText: stripTrailingThinkFragments(rawVisible).trim(),
      thinkText: thinkText || null,
    }
  }

  const match = text.match(/<think>([\s\S]*?)<\/think>/i)
  if (!match) return { visibleText: stripTrailingThinkFragments(text).trim(), thinkText: null }

  const thinkText = (match[1] ?? '').trim()
  const visibleText = text
    .replace(match[0], '')
    .replace(/<\/t(?:h(?:i(?:n(?:k)?)?)?)?$/i, '')
    .replace(/<t(?:h(?:i(?:n(?:k)?)?)?)?$/i, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

  // Avoid rendering huge blocks in UI.
  const maxChars = 1200
  const trimmedThink = thinkText.length > maxChars ? `${thinkText.slice(0, maxChars)}…` : thinkText

  return { visibleText, thinkText: trimmedThink || null }
}
