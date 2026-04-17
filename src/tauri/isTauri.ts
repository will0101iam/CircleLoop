export function isTauri() {
  const w = globalThis as unknown as {
    __TAURI_INTERNALS__?: { invoke?: unknown }
  }
  return typeof w.__TAURI_INTERNALS__?.invoke === 'function'
}
