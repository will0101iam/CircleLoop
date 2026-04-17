import type { CommandOps, CommandResult } from '../tools/fileOps'

export async function createTauriCommandOps(): Promise<CommandOps> {
  const { isTauri } = await import('./isTauri')
  if (!isTauri()) {
    throw new Error('TAURI_NOT_AVAILABLE')
  }

  const Shell = await import('@tauri-apps/plugin-shell')

  return {
    async execute(command: string, args?: string[]): Promise<CommandResult> {
      try {
        const result = await Shell.Command.create('shell', [command, ...(args ?? [])]).execute()
        return {
          code: result.code,
          stdout: typeof result.stdout === 'string' ? result.stdout : '',
          stderr: typeof result.stderr === 'string' ? result.stderr : '',
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        return { code: -1, stdout: '', stderr: message }
      }
    },
  }
}
