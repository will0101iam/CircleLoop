import type { SqliteDatabase } from '../storage/sqlite'
import { createAppDb } from '../storage/appDb'
import { createContextSummaryStore } from '../storage/contextSummaryStore'
import { createSessionStore } from '../storage/sessionStore'
import type { ToolDefinition } from '../tools/toolRegistry'
import { createCreateSessionTool } from '../tools/createSessionTool'
import type { CommandOps, FileOps } from '../tools/fileOps'
import { createCreateDirTool } from '../tools/createDirTool'
import { createDeleteFileTool } from '../tools/deleteFileTool'
import { createEditFileTool } from '../tools/editFileTool'
import { createExecuteCommandTool } from '../tools/executeCommandTool'
import { createGlobFilesTool } from '../tools/globFilesTool'
import { createListDirTool } from '../tools/listDirTool'
import { createListSessionsTool } from '../tools/listSessionsTool'
import { createQuerySqlTool } from '../tools/querySqlTool'
import { createReadFileTool } from '../tools/readFileTool'
import { createSearchCodeTool } from '../tools/searchCodeTool'
import { createToolRegistry } from '../tools/toolRegistry'
import { createWriteFileTool } from '../tools/writeFileTool'

function workspaceRequiredResult() {
  return {
    ok: false as const,
    error: {
      code: 'WORKSPACE_NOT_SELECTED',
      message: 'Select a workspace folder for this session before using local file tools.',
    },
  }
}

function registerWorkspaceAwareTool(
  tools: ReturnType<typeof createToolRegistry>,
  input: {
    workspacePath?: string
    build: (workspacePath: string) => ToolDefinition<unknown, unknown>
  },
) {
  const tool = input.build(input.workspacePath ?? '')
  if (input.workspacePath) {
    tools.register(tool)
    return
  }
  tools.register({
    ...tool,
    async handler() {
      return workspaceRequiredResult()
    },
  })
}

export async function createRuntime(deps?: {
  createAppDb?: () => Promise<SqliteDatabase>
  createId?: () => string
  now?: () => number
  workspacePath?: string
  fileOps?: FileOps
  commandOps?: CommandOps
}) {
  const db = await (deps?.createAppDb ?? createAppDb)()
  const sessionStore = createSessionStore({ db, createId: deps?.createId, now: deps?.now })
  const contextSummaryStore = createContextSummaryStore({ db, createId: deps?.createId, now: deps?.now })

  const tools = createToolRegistry()
  tools.register(createQuerySqlTool({ db }))
  tools.register(createCreateSessionTool({ store: sessionStore }))
  tools.register(createListSessionsTool({ store: sessionStore }))
  if (deps?.fileOps) {
    registerWorkspaceAwareTool(tools, {
      workspacePath: deps.workspacePath,
      build: (workspacePath) => createListDirTool({ workspacePath, fileOps: deps.fileOps! }),
    })
    registerWorkspaceAwareTool(tools, {
      workspacePath: deps.workspacePath,
      build: (workspacePath) => createReadFileTool({ workspacePath, fileOps: deps.fileOps! }),
    })
    registerWorkspaceAwareTool(tools, {
      workspacePath: deps.workspacePath,
      build: (workspacePath) => createGlobFilesTool({ workspacePath, fileOps: deps.fileOps! }),
    })
    registerWorkspaceAwareTool(tools, {
      workspacePath: deps.workspacePath,
      build: (workspacePath) => createWriteFileTool({ workspacePath, fileOps: deps.fileOps! }),
    })
    registerWorkspaceAwareTool(tools, {
      workspacePath: deps.workspacePath,
      build: (workspacePath) => createCreateDirTool({ workspacePath, fileOps: deps.fileOps! }),
    })
    registerWorkspaceAwareTool(tools, {
      workspacePath: deps.workspacePath,
      build: (workspacePath) => createEditFileTool({ workspacePath, fileOps: deps.fileOps! }),
    })
    registerWorkspaceAwareTool(tools, {
      workspacePath: deps.workspacePath,
      build: (workspacePath) => createDeleteFileTool({ workspacePath, fileOps: deps.fileOps! }),
    })
    registerWorkspaceAwareTool(tools, {
      workspacePath: deps.workspacePath,
      build: (workspacePath) => createSearchCodeTool({ workspacePath, fileOps: deps.fileOps! }),
    })
  }
  if (deps?.commandOps) {
    const commandTool = createExecuteCommandTool({ commandOps: deps.commandOps })
    if (deps.workspacePath) {
      tools.register(commandTool)
    } else {
      tools.register({
        ...commandTool,
        async handler() {
          return workspaceRequiredResult()
        },
      })
    }
  }

  return { db, tools, contextSummaryStore }
}
