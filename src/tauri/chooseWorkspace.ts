type OpenFn = (options: { directory: true; multiple: false }) => Promise<string | null>

export async function chooseWorkspace(deps?: { open?: OpenFn }): Promise<string | null> {
  if (deps?.open) {
    return deps.open({ directory: true, multiple: false })
  }

  const { isTauri } = await import('./isTauri')
  if (!isTauri()) return null

  const dialog = await import('@tauri-apps/plugin-dialog')
  const result = await dialog.open({ directory: true, multiple: false })
  return typeof result === 'string' ? result : null
}
