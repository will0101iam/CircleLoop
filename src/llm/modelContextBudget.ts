const MODEL_CONTEXT_WINDOWS: Array<{ match: RegExp; tokens: number }> = [
  { match: /gpt-5\.4-pro/i, tokens: 922_000 },
  { match: /gpt-5\.4-mini/i, tokens: 400_000 },
  { match: /gpt-5\.4-nano/i, tokens: 400_000 },
  { match: /gpt-5\.4/i, tokens: 922_000 },
  { match: /claude.*(opus|sonnet).*4\.6/i, tokens: 1_000_000 },
  { match: /gemini-3-flash/i, tokens: 1_050_000 },
  { match: /gemini-3-pro/i, tokens: 1_000_000 },
  { match: /minimax.*m2\.5/i, tokens: 196_608 },
  { match: /glm-5-turbo/i, tokens: 202_752 },
  { match: /glm-5|glm-4\.6/i, tokens: 204_800 },
]

export function getModelContextWindowTokens(model: string | null | undefined) {
  if (!model) return 200_000
  for (const entry of MODEL_CONTEXT_WINDOWS) {
    if (entry.match.test(model)) return entry.tokens
  }
  return 200_000
}

export function getUsableContextCharBudget(model: string | null | undefined) {
  const tokens = getModelContextWindowTokens(model)
  return Math.floor(tokens * 3.2 * 0.82)
}

