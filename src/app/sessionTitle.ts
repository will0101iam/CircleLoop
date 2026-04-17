function charUnits(char: string) {
  return /[\u3400-\u9fff\uf900-\ufaff]/.test(char) ? 3 : 1
}

export function shouldGenerateSessionTitle(input: {
  currentTitle: string | null | undefined
  existingUserMessageCount: number
}) {
  return (input.currentTitle ?? 'New Chat') === 'New Chat' && input.existingUserMessageCount === 0
}

export function buildFallbackSessionTitle(prompt: string, maxUnits = 25) {
  const normalized = prompt.replace(/\s+/g, ' ').trim()
  if (!normalized) return 'New Chat'

  let used = 0
  let output = ''
  for (const char of normalized) {
    const units = charUnits(char)
    if (used + units > maxUnits) break
    output += char
    used += units
  }

  if (!output) return 'New Chat'
  return output.length < normalized.length ? `${output}…` : output
}

export function sanitizeGeneratedSessionTitle(title: string | null | undefined) {
  const normalized = (title ?? '').replace(/["'`]/g, '').replace(/\s+/g, ' ').trim()
  if (!normalized) return null
  return buildFallbackSessionTitle(normalized)
}

export function resolveSessionTitleFromPrompt(prompt: string, generatedTitle: string | null | undefined) {
  const fallback = buildFallbackSessionTitle(prompt)
  const normalizedPrompt = prompt.replace(/\s+/g, ' ').trim().toLowerCase()
  const sanitized = sanitizeGeneratedSessionTitle(generatedTitle)
  if (!sanitized) return fallback

  const titleForCheck = sanitized.replace(/…$/, '').toLowerCase()
  return normalizedPrompt.includes(titleForCheck) ? sanitized : fallback
}
