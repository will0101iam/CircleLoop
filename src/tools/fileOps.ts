export type DirEntry = {
  name: string
  isDir: boolean
}

export type FileOps = {
  exists: (path: string) => Promise<boolean>
  readTextFile: (path: string) => Promise<string>
  writeTextFile: (path: string, content: string) => Promise<void>
  listDir: (path: string) => Promise<DirEntry[]>
  createDir: (path: string) => Promise<void>
  remove: (path: string) => Promise<void>
}

export type CommandResult = {
  code: number
  stdout: string
  stderr: string
}

export type CommandOps = {
  execute: (command: string, args?: string[]) => Promise<CommandResult>
}
