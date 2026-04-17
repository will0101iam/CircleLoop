import type { FileOps, DirEntry } from '../tools/fileOps'

type ReadTextFileFn = (path: string) => Promise<string>
type WriteTextFileFn = (path: string, content: string) => Promise<void>
type ReadDirEntry = { name?: string; children?: unknown[] | null }
type ReadDirFn = (path: string) => Promise<ReadDirEntry[]>

export async function createTauriFileOps(deps?: {
  readTextFile?: ReadTextFileFn
  writeTextFile?: WriteTextFileFn
  readDir?: ReadDirFn
}): Promise<FileOps> {
  if (deps?.readTextFile && deps.writeTextFile && deps.readDir) {
    return {
      readTextFile: deps.readTextFile,
      writeTextFile: deps.writeTextFile,
      async listDir(path: string): Promise<DirEntry[]> {
        const entries = await deps.readDir!(path)
        return entries.map((e) => ({
          name: e.name ?? '',
          isDir: Array.isArray(e.children),
        }))
      },
      async createDir(_path: string): Promise<void> {},
      async remove(_path: string): Promise<void> {},
    }
  }

  const { isTauri } = await import('./isTauri')
  if (!isTauri()) {
    throw new Error('TAURI_NOT_AVAILABLE')
  }

  const fs = await import('@tauri-apps/plugin-fs')

  return {
    readTextFile: fs.readTextFile,
    async writeTextFile(path: string, content: string): Promise<void> {
      await fs.writeFile(path, new TextEncoder().encode(content))
    },
    async listDir(path: string): Promise<DirEntry[]> {
      const entries = (await fs.readDir(path)) as unknown as ReadDirEntry[]
      return entries.map((e) => ({
        name: e.name ?? '',
        isDir: Array.isArray(e.children),
      }))
    },
    async createDir(path: string): Promise<void> {
      await fs.mkdir(path, { recursive: true })
    },
    async remove(path: string): Promise<void> {
      await fs.remove(path, { recursive: true })
    },
  }
}
