type UnknownRecord = Record<string, unknown>

export type ToolPayloadPreview = {
  previewText: string
  hasMore: boolean
}

const SENSITIVE_KEY_RE = /(api[_-]?key|token|authorization|secret|password)/i
const BEARER_RE = /\bBearer\s+([A-Za-z0-9._\-~=+/]+)\b/gi

function redactPrimitive(value: unknown): unknown {
  if (typeof value === 'string') {
    return value.replace(BEARER_RE, 'Bearer ***')
  }
  return value
}

function redactDeep(value: unknown): unknown {
  if (value == null) return value
  if (typeof value !== 'object') return redactPrimitive(value)

  if (Array.isArray(value)) return value.map(redactDeep)

  const obj = value as UnknownRecord
  const out: UnknownRecord = {}
  for (const [k, v] of Object.entries(obj)) {
    if (SENSITIVE_KEY_RE.test(k)) {
      out[k] = '***'
    } else {
      out[k] = redactDeep(v)
    }
  }
  return out
}

function limitForPreview(input: unknown, ctx: { depth: number; maxDepth: number; maxKeys: number; maxItems: number }): {
  value: unknown
  truncated: boolean
} {
  if (input == null) return { value: input, truncated: false }
  if (typeof input !== 'object') {
    if (typeof input === 'string') {
      const maxStr = 200
      if (input.length > maxStr) return { value: `${input.slice(0, maxStr)}…`, truncated: true }
    }
    return { value: input, truncated: false }
  }

  if (ctx.depth >= ctx.maxDepth) return { value: '[…]' as const, truncated: true }

  if (Array.isArray(input)) {
    const items = input
    const limited = items.slice(0, ctx.maxItems)
    let anyTrunc = items.length > ctx.maxItems
    const next = { ...ctx, depth: ctx.depth + 1 }
    const mapped: unknown[] = []
    for (const it of limited) {
      const r = limitForPreview(it, next)
      anyTrunc = anyTrunc || r.truncated
      mapped.push(r.value)
    }
    if (items.length > ctx.maxItems) mapped.push(`… (${items.length - ctx.maxItems} more)` as const)
    return { value: mapped, truncated: anyTrunc }
  }

  const obj = input as UnknownRecord
  const keys = Object.keys(obj)
  const limitedKeys = keys.slice(0, ctx.maxKeys)
  let anyTrunc = keys.length > ctx.maxKeys
  const next = { ...ctx, depth: ctx.depth + 1 }
  const out: UnknownRecord = {}
  for (const k of limitedKeys) {
    const r = limitForPreview(obj[k], next)
    anyTrunc = anyTrunc || r.truncated
    out[k] = r.value
  }
  if (keys.length > ctx.maxKeys) out['…'] = `(${keys.length - ctx.maxKeys} more keys)`
  return { value: out, truncated: anyTrunc }
}

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    try {
      return String(value)
    } catch {
      return '[Unserializable]'
    }
  }
}

export function formatToolPayloadPreview(payload: unknown, opts?: { maxPreviewChars?: number }): ToolPayloadPreview {
  const redacted = redactDeep(payload)

  const limited = limitForPreview(redacted, { depth: 0, maxDepth: 4, maxKeys: 40, maxItems: 40 })
  const previewMax = opts?.maxPreviewChars ?? 800
  const previewRaw = safeStringify(limited.value)

  if (previewRaw.length > previewMax) {
    return { previewText: `${previewRaw.slice(0, previewMax)}…`, hasMore: true }
  }

  return { previewText: previewRaw, hasMore: limited.truncated }
}

export function formatToolPayloadFull(payload: unknown): string {
  const redacted = redactDeep(payload)
  return safeStringify(redacted)
}

