import { afterEach, describe, expect, it } from 'vitest'
import { isTauri } from './isTauri'

const g = globalThis as unknown as Record<string, unknown>
const originalInternals = g['__TAURI_INTERNALS__']
const originalTauri = g['__TAURI__']

afterEach(() => {
  g['__TAURI_INTERNALS__'] = originalInternals
  g['__TAURI__'] = originalTauri
})

describe('isTauri', () => {
  it('returns true when __TAURI_INTERNALS__.invoke is available', () => {
    g['__TAURI_INTERNALS__'] = { invoke() {} }
    expect(isTauri()).toBe(true)
  })

  it('returns false when tauri internals are missing', () => {
    delete g['__TAURI_INTERNALS__']
    delete g['__TAURI__']
    expect(isTauri()).toBe(false)
  })
})
