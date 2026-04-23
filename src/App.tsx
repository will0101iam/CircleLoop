import { useEffect, useMemo, useRef, useState } from 'react'
import './App.css'
import { createAppDb } from './storage/appDb'
import { createChatThreadStore } from './storage/chatThreadStore'
import { chooseWorkspace } from './tauri/chooseWorkspace'
import { createTauriCommandOps } from './tauri/tauriCommandOps'
import { createTauriFileOps } from './tauri/tauriFileOps'
import { createRuntime } from './runtime/runtime'
import { isTauri } from './tauri/isTauri'
import { createJournaledFileOps, rollbackEntries, type FileRollbackEntry } from './app/fileRollback'
import { loadMinimaxConfig, saveMinimaxConfig, type MinimaxConfigStatus } from './config/config'
import {
  createChatCompletionOpenAICompat,
  createChatCompletionStreamOpenAICompat,
  type OpenAICompatChatMessage,
  type OpenAICompatTool,
} from './llm/openaiCompat'
import { runEngine, resumeRunEngineWithApproval, type PendingApprovalState } from './agent/runEngine'
import { sanitizeThink } from './app/sanitizeThink'
import { formatToolPayloadPreview } from './app/formatToolPayload'
import { renderAssistantBlocks } from './app/renderAssistantBlocks'
import { buildChatContextMessages } from './app/buildChatContext'
import { buildFallbackSessionTitle, resolveSessionTitleFromPrompt, shouldGenerateSessionTitle } from './app/sessionTitle'
import type { ApprovalUiState } from './app/approvalUiState'
import { createThinkStreamParser } from './app/thinkStreamParser'
import { getResumeEventPlacement } from './app/runTimelinePlacement'
import { isThinkingExpanded } from './app/runUiState'
import {
  beginRunFollow,
  interruptRunFollow,
  shouldAutoAnchorApproval,
  shouldAutoFollowRun,
  shouldTriggerFinalScroll,
} from './app/threadFollowPolicy'
import { compressContextWithMinimax, type CompressionSummary, renderCompressionSummaryMessage } from './context/contextCompressor'
import { Copy, FolderOpen, MoreHorizontal, Pencil, Pin, RotateCcw, Square, Trash2, Undo2 } from 'lucide-react'
import {
  appendRunMessages,
  appendRunEvent,
  appendRunAnswerMarker,
  appendRunAnswerText,
  completeRunMessage,
  createPendingRunMessage,
  createAssistantMessage,
  createUserMessage,
  type RunEvent,
  type RunThreadMessage,
  type ThreadMessage,
} from './app/runMessages'
import { PlusIcon, TaskIcon, CustomizeIcon, ChevronDownIcon } from './components/Icons'
import { getUsableContextCharBudget } from './llm/modelContextBudget'

const SYSTEM_PROMPT =
  'You are circleloop, a coding agent. Use tools when needed. Keep answers concise and precise.'

type PendingApprovalRecord = {
  chatId: string
  runId: string
  approval: PendingApprovalState
  config: {
    baseUrl: string
    model: string
    apiKey: string
  }
}

type ApprovalUiStateRecord = Record<string, ApprovalUiState>
type ApprovalEvent = Extract<RunEvent, { kind: 'approval_requested' | 'approval_resolved' }>
type ToolExecutionEvent = Extract<RunEvent, { kind: 'tool_execute' | 'tool_result' }>
type ProcessStepStatusTone = 'running' | 'waiting' | 'approved' | 'denied' | 'done' | 'error'
type ProcessStepItem = {
  key: string
  title: string
  statusLabel: string
  statusTone: ProcessStepStatusTone
  interactive: boolean
  execute?: Extract<ToolExecutionEvent, { kind: 'tool_execute' }>
  result?: Extract<ToolExecutionEvent, { kind: 'tool_result' }>
  approvalRequested?: Extract<ApprovalEvent, { kind: 'approval_requested' }>
  approvalResolved?: Extract<ApprovalEvent, { kind: 'approval_resolved' }>
  resultPreview?: string | null
}

type ChatThreadStoreLike = ReturnType<typeof createChatThreadStore>
type ChatSummary = {
  id: string
  title: string
  workspacePath: string | null
  pinnedAt?: number | null
  lastActivatedAt?: number
}

type TestInitialState = {
  chats: ChatSummary[]
  selectedChatId: string
  chatMessages: Record<string, ThreadMessage[]>
  disableAutoRuntime?: boolean
  runningChatId?: string | null
  activeRunId?: string | null
  initialFollowState?: {
    activeRunId: string | null
    interruptedRunId: string | null
  }
}

function BranchIcon(props: { size?: number }) {
  const size = props.size ?? 12
  return (
    <svg width={size} height={size} viewBox="170 42 684 940" aria-hidden="true" fill="none">
      <path
        d="M725.333333 42.666667c72.533333 0 128 55.466667 128 128 0 55.466667-34.133333 102.4-85.333333 119.466666V426.666667c0 72.533333-55.466667 128-128 128H341.333333v179.2c51.2 17.066667 85.333333 64 85.333334 119.466666 0 72.533333-55.466667 128-128 128s-128-55.466667-128-128c0-55.466667 34.133333-102.4 85.333333-119.466666V290.133333C204.8 273.066667 170.666667 226.133333 170.666667 170.666667c0-72.533333 55.466667-128 128-128s128 55.466667 128 128c0 55.466667-34.133333 102.4-85.333334 119.466666V469.333333h256c46.933333 0 85.333333-38.4 85.333334-85.333333V290.133333c-51.2-17.066667-85.333333-64-85.333334-119.466666 0-72.533333 55.466667-128 128-128zM298.666667 810.666667c-25.6 0-42.666667 17.066667-42.666667 42.666666s17.066667 42.666667 42.666667 42.666667 42.666667-17.066667 42.666666-42.666667-17.066667-42.666667-42.666666-42.666666zM725.333333 128c-25.6 0-42.666667 17.066667-42.666666 42.666667s17.066667 42.666667 42.666666 42.666666 42.666667-17.066667 42.666667-42.666666-17.066667-42.666667-42.666667-42.666667zM298.666667 128c-25.6 0-42.666667 17.066667-42.666667 42.666667s17.066667 42.666667 42.666667 42.666666 42.666667-17.066667 42.666666-42.666666-17.066667-42.666667-42.666666-42.666667z"
        fill="currentColor"
      />
    </svg>
  )
}

function estimateMessagesChars(messages: OpenAICompatChatMessage[]) {
  return messages.reduce((sum, message) => {
    if (typeof message.content !== 'string') return sum
    return sum + message.content.length
  }, 0)
}

function chunkMessagesForCompression(messages: OpenAICompatChatMessage[], maxCharsPerChunk: number) {
  const chunks: OpenAICompatChatMessage[][] = []
  let current: OpenAICompatChatMessage[] = []
  let currentChars = 0
  for (const message of messages) {
    const messageChars = typeof message.content === 'string' ? message.content.length : 0
    if (current.length > 0 && currentChars + messageChars > maxCharsPerChunk) {
      chunks.push(current)
      current = []
      currentChars = 0
    }
    current.push(message)
    currentChars += messageChars
  }
  if (current.length > 0) chunks.push(current)
  return chunks
}

function upsertRecentChat(
  chats: ChatSummary[],
  input: { id: string; title?: string; workspacePath?: string | null; pinnedAt?: number | null; lastActivatedAt?: number },
) {
  const existing = chats.find((chat) => chat.id === input.id)
  const title = input.title ?? existing?.title ?? 'New Chat'
  const workspacePath = input.workspacePath === undefined ? (existing?.workspacePath ?? null) : input.workspacePath
  const pinnedAt = input.pinnedAt === undefined ? (existing?.pinnedAt ?? null) : input.pinnedAt
  const lastActivatedAt = input.lastActivatedAt ?? existing?.lastActivatedAt ?? Date.now()
  const rest = chats.filter((chat) => chat.id !== input.id)
  return [{ id: input.id, title, workspacePath, pinnedAt, lastActivatedAt }, ...rest]
}

function App(props?: { __testInitialState?: TestInitialState }) {
  const testDisableAutoRuntime = props?.__testInitialState?.disableAutoRuntime === true
  const activeRunIdRef = useRef<string | null>(
    props?.__testInitialState?.activeRunId ?? props?.__testInitialState?.initialFollowState?.activeRunId ?? null,
  )
  const fileRollbackJournalRef = useRef<Record<string, FileRollbackEntry[]>>({})
  const [prompt, setPrompt] = useState<string>('')
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [showModelSettings, setShowModelSettings] = useState(false)
  const [settingsBaseUrl, setSettingsBaseUrl] = useState('https://api.minimaxi.com/v1')
  const [settingsModel, setSettingsModel] = useState('MiniMax-M2.7')
  const [settingsApiKey, setSettingsApiKey] = useState('')
  const [settingsSaving, setSettingsSaving] = useState(false)

  const [runtime, setRuntime] = useState<Awaited<ReturnType<typeof createRuntime>> | null>(null)
  const [chatStore, setChatStore] = useState<ChatThreadStoreLike | null>(null)
  const [chatStoreHydrated, setChatStoreHydrated] = useState(false)
  const [configStatus, setConfigStatus] = useState<MinimaxConfigStatus>({
    configured: false,
    configPath: null,
    provider: null,
    baseUrl: null,
    model: null,
    getApiKey: () => null,
  })

  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const [chats, setChats] = useState<ChatSummary[]>(
    props?.__testInitialState?.chats ?? [{ id: 'c1', title: 'New Chat', workspacePath: null }],
  )
  const [selectedChatId, setSelectedChatId] = useState<string>(props?.__testInitialState?.selectedChatId ?? 'c1')
  const [chatMessages, setChatMessages] = useState<Record<string, ThreadMessage[]>>(props?.__testInitialState?.chatMessages ?? { c1: [] })
  const [runningChatId, setRunningChatId] = useState<string | null>(props?.__testInitialState?.runningChatId ?? null)
  const [deepResearchEnabled, setDeepResearchEnabled] = useState(false)
  const [pendingApprovals, setPendingApprovals] = useState<Record<string, PendingApprovalRecord>>({})
  const [approvalUiStates, setApprovalUiStates] = useState<Record<string, ApprovalUiStateRecord>>({})
  const [expandedRuns, setExpandedRuns] = useState<Record<string, boolean>>({})
  const [openChatMenuId, setOpenChatMenuId] = useState<string | null>(null)
  const threadRef = useRef<HTMLDivElement | null>(null)
  const threadBottomRef = useRef<HTMLDivElement | null>(null)
  const activeAbortControllerRef = useRef<AbortController | null>(null)
  const messageElementRefs = useRef<Record<string, HTMLDivElement | null>>({})
  const processStepElementRefs = useRef<Record<string, HTMLDivElement | null>>({})
  const pendingScrollMessageIdRef = useRef<string | null>(null)
  const pendingApprovalAnchorRef = useRef<{ runId: string; stepKey: string } | null>(null)
  const seenApprovalRequestEventIdsRef = useRef<Record<string, string>>({})
  const suppressThreadScrollRef = useRef(false)
  const pendingFinalScrollRef = useRef(false)
  const followStateRef = useRef<{ activeRunId: string | null; interruptedRunId: string | null }>(
    props?.__testInitialState?.initialFollowState ?? {
      activeRunId: props?.__testInitialState?.activeRunId ?? null,
      interruptedRunId: null,
    },
  )

  const configPath = configStatus.configPath ?? '$APPCONFIG/circleloop/config.json'

  function toReadableRunError(error: unknown) {
    if (error instanceof DOMException && error.name === 'AbortError') return '已停止本次运行。'
    const message = error instanceof Error ? error.message : '运行失败'
    if (message.includes('OpenAICompat network failed: ')) {
      return `网络请求失败：${message.replace('OpenAICompat network failed: ', '')}`
    }
    if (message.includes('OpenAICompat request failed: ')) {
      return `模型请求失败：${message.replace('OpenAICompat request failed: ', '')}`
    }
    return message
  }

  function now() {
    return new Date().toLocaleTimeString('zh-CN', { hour12: false })
  }

  function newId() {
    return `c_${Math.random().toString(16).slice(2)}`
  }

  function getChatWorkspacePath(chatId: string) {
    return chats.find((chat) => chat.id === chatId)?.workspacePath ?? null
  }

  async function buildRuntimeForWorkspace(nextWorkspacePath: string | null) {
    if (!isTauri()) return null
    const baseFileOps = await createTauriFileOps()
    const fileOps = createJournaledFileOps({
      base: baseFileOps,
      getActiveRunId: () => activeRunIdRef.current,
      journal: fileRollbackJournalRef.current,
    })
    const commandOps = await createTauriCommandOps()
    return createRuntime({ workspacePath: nextWorkspacePath ?? undefined, fileOps, commandOps })
  }

  async function refreshConfigStatus() {
    try {
      const status = await loadMinimaxConfig()
      setConfigStatus(status)
      return status
    } catch {
      const status = {
        configured: false,
        configPath: null,
        provider: null,
        baseUrl: null,
        model: null,
        getApiKey: () => null,
      } satisfies MinimaxConfigStatus
      setConfigStatus(status)
      return status
    }
  }

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const status = await refreshConfigStatus()
      if (cancelled) return
      setConfigStatus(status)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    setSettingsBaseUrl(configStatus.baseUrl ?? 'https://api.minimaxi.com/v1')
    setSettingsModel(configStatus.model ?? 'MiniMax-M2.7')
  }, [configStatus.baseUrl, configStatus.model])

  useEffect(() => {
    let cancelled = false
    if (!isTauri()) {
      setChatStoreHydrated(true)
      return
    }
    ;(async () => {
      try {
        const db = await createAppDb()
        const store = createChatThreadStore({ db })
        const loaded = await store.loadAll()
        if (cancelled) return
        setChatStore(store)
        if (loaded.chats.length > 0) {
          setChats(loaded.chats)
          setChatMessages(loaded.chatMessages)
          setSelectedChatId(loaded.chats[0]?.id ?? 'c1')
        }
      } catch {
        if (cancelled) return
      } finally {
        if (!cancelled) setChatStoreHydrated(true)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const selectedChat = useMemo(() => chats.find((chat) => chat.id === selectedChatId) ?? null, [chats, selectedChatId])
  const selectedWorkspacePath = selectedChat?.workspacePath ?? null
  const formattedWorkspace = (() => {
    if (!selectedWorkspacePath) return '选择工作区'
    const parts = selectedWorkspacePath.split(/[\\/]/).filter(Boolean)
    return parts.at(-1) ?? selectedWorkspacePath
  })()
  const selectedThread = useMemo(() => chatMessages[selectedChatId] ?? [], [chatMessages, selectedChatId])
  const isRunningCurrentChat = runningChatId === selectedChatId
  const sortedChats = useMemo(() => {
    const pinned = chats
      .filter((chat) => Boolean(chat.pinnedAt))
      .sort((a, b) => (b.pinnedAt ?? 0) - (a.pinnedAt ?? 0))
    const normal = chats
      .filter((chat) => !chat.pinnedAt)
      .sort((a, b) => (b.lastActivatedAt ?? 0) - (a.lastActivatedAt ?? 0))
    return [...pinned, ...normal]
  }, [chats])

  async function copyToClipboard(text: string) {
    const trimmed = text ?? ''
    if (!trimmed) return
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(trimmed)
        return
      }
    } catch {
      // Fall through to legacy copy path.
    }
    const el = document.createElement('textarea')
    el.value = trimmed
    el.style.position = 'fixed'
    el.style.top = '-9999px'
    el.style.left = '-9999px'
    document.body.appendChild(el)
    el.focus()
    el.select()
    document.execCommand('copy')
    document.body.removeChild(el)
  }

  function findLastUserRunPair(thread: ThreadMessage[]) {
    for (let i = thread.length - 2; i >= 0; i -= 1) {
      const user = thread[i]
      const run = thread[i + 1]
      if (user?.kind === 'user' && run?.kind === 'run') {
        return { userIndex: i, runIndex: i + 1, user, run }
      }
    }
    return null
  }

  async function handleUndoUser(userId: string) {
    const pair = findLastUserRunPair(selectedThread)
    if (!pair) return
    if (pair.user.id !== userId) return
    activeAbortControllerRef.current?.abort()
    if (!testDisableAutoRuntime) {
      try {
        const baseFileOps = await createTauriFileOps()
        const entries = fileRollbackJournalRef.current[pair.run.id] ?? []
        await rollbackEntries({ base: baseFileOps, entries })
        delete fileRollbackJournalRef.current[pair.run.id]
      } catch {
        // Keep undo best-effort and continue removing the pair.
      }
    }
    setPrompt(pair.user.text)
    setChatMessages((prev) => {
      const nextThread = [...(prev[selectedChatId] ?? [])]
      nextThread.splice(pair.userIndex, 2)
      return { ...prev, [selectedChatId]: nextThread }
    })
  }

  async function handleRetryRun(runId: string) {
    const pair = findLastUserRunPair(selectedThread)
    if (!pair) return
    if (pair.run.id !== runId) return
    const userText = pair.user.text
    const threadBeforeUser = selectedThread.slice(0, pair.userIndex)

    activeAbortControllerRef.current?.abort()
    const newRunId = `r_${Math.random().toString(16).slice(2)}`
    const nextMode = deepResearchEnabled ? 'deep_research' : 'normal'
    const newRun = createPendingRunMessage(newRunId, now(), nextMode)
    fileRollbackJournalRef.current[newRunId] = []
    pendingScrollMessageIdRef.current = pair.user.id
    followStateRef.current = beginRunFollow(newRunId)

    // Replace run in-place first so UI updates immediately.
    setChatMessages((prev) => {
      const nextThread = [...(prev[selectedChatId] ?? [])]
      nextThread[pair.runIndex] = newRun
      return { ...prev, [selectedChatId]: nextThread }
    })

    if (testDisableAutoRuntime) return

    setErrorMessage(null)
    setRunningChatId(selectedChatId)
    activeRunIdRef.current = newRunId
    const latestConfig = await refreshConfigStatus()
    if (!latestConfig.configured) {
      setChatMessages((prev) => ({
        ...prev,
        [selectedChatId]: completeRunMessage(prev[selectedChatId] ?? [], newRunId, {
          status: 'error',
          finalText: `MiniMax 未配置：请编辑 ${configPath} 后重试。`,
        }),
      }))
      setRunningChatId(null)
      return
    }

    let activeRuntime = runtime
    if (!activeRuntime) {
      activeRuntime = await buildRuntimeForWorkspace(selectedWorkspacePath)
      if (activeRuntime) setRuntime(activeRuntime)
    }
    if (!activeRuntime) {
      setChatMessages((prev) => ({
        ...prev,
        [selectedChatId]: completeRunMessage(prev[selectedChatId] ?? [], newRunId, {
          status: 'error',
          finalText: '当前无法初始化运行时：请在桌面端打开应用后重试。',
        }),
      }))
      setRunningChatId(null)
      return
    }

    const apiKey = latestConfig.getApiKey()
    if (!apiKey) {
      setChatMessages((prev) => ({
        ...prev,
        [selectedChatId]: completeRunMessage(prev[selectedChatId] ?? [], newRunId, {
          status: 'error',
          finalText: `读取配置失败：请检查 ${configPath} 的 baseUrl/apiKey/model。`,
        }),
      }))
      setRunningChatId(null)
      return
    }

    const abortController = new AbortController()
    activeAbortControllerRef.current = abortController
    const streamParser = createThinkStreamParser()
    let sawAnyDelta = false
    let hasAnswerStarted = false
    let toolEventCount = 0
    let lastAnswerSnapshot = ''

    const patchRunMessage = (
      patch: Partial<Pick<RunThreadMessage, 'status' | 'thinkText' | 'events' | 'finalText' | 'mode' | 'answerSegments'>>,
    ) => {
      setChatMessages((prev) => ({
        ...prev,
        [selectedChatId]: completeRunMessage(prev[selectedChatId] ?? [], newRunId, patch),
      }))
    }

    const appendEventToRunMessage = (event: RunEvent) => {
      setChatMessages((prev) => ({
        ...prev,
        [selectedChatId]: appendRunEvent(prev[selectedChatId] ?? [], newRunId, event),
      }))
    }

    const syncStreamText = () => {
      const thinkingText = streamParser.getThinkingText()
      const answerText = streamParser.getAnswerText()
      if (!hasAnswerStarted && answerText.trim().length > 0) {
        hasAnswerStarted = true
      }
      const compactAnswerText = answerText.replace(/\n{3,}/g, '\n\n')
      const deltaText = compactAnswerText.slice(lastAnswerSnapshot.length)
      if (nextMode === 'normal' && deltaText) {
        setChatMessages((prev) => ({
          ...prev,
          [selectedChatId]: appendRunAnswerText(prev[selectedChatId] ?? [], newRunId, deltaText),
        }))
      }
      lastAnswerSnapshot = compactAnswerText
      patchRunMessage({
        thinkText: thinkingText.trim() || null,
        finalText: compactAnswerText.trim() || null,
      })
    }

    const openAiChatCompletion = async (args: { messages: OpenAICompatChatMessage[]; tools?: OpenAICompatTool[] }) => {
      return createChatCompletionOpenAICompat({
        baseUrl: latestConfig.baseUrl ?? 'https://api.minimaxi.com/v1',
        apiKey,
        model: latestConfig.model ?? 'MiniMax-M2.7',
        messages: args.messages,
        tools: args.tools,
        tool_choice: 'auto',
        temperature: 0.2,
        signal: abortController.signal,
      })
    }

    const openAiChatCompletionStream = async (args: { messages: OpenAICompatChatMessage[]; tools?: OpenAICompatTool[]; onContentDelta?: (delta: string) => void }) => {
      return createChatCompletionStreamOpenAICompat({
        baseUrl: latestConfig.baseUrl ?? 'https://api.minimaxi.com/v1',
        apiKey,
        model: latestConfig.model ?? 'MiniMax-M2.7',
        messages: args.messages,
        tools: args.tools,
        tool_choice: 'auto',
        temperature: 0.2,
        signal: abortController.signal,
        onContentDelta: (delta) => {
          sawAnyDelta = true
          streamParser.pushDelta(delta)
          syncStreamText()
          args.onContentDelta?.(delta)
        },
      })
    }

    try {
      const modelCharBudget = getUsableContextCharBudget(latestConfig.model)
      const contextMessages = buildChatContextMessages({
        systemMessage: { role: 'system', content: SYSTEM_PROMPT },
        thread: threadBeforeUser,
        newUserText: userText,
        maxContextChars: modelCharBudget,
      })

      const result = await runEngine({
        messages: contextMessages,
        tools: activeRuntime.tools,
        chatCompletion: ({ messages, tools }) => openAiChatCompletion({ messages, tools }),
        chatCompletionStream: ({ messages, tools, onContentDelta }) =>
          openAiChatCompletionStream({ messages, tools, onContentDelta }),
        workspacePath: selectedWorkspacePath ?? undefined,
        onTimelineEvent: (event) => {
          if (event.type === 'tool_execute') {
            toolEventCount += 1
            const phase = hasAnswerStarted ? 'answer' : 'thinking'
            appendEventToRunMessage({
              id: `${newRunId}:retry:tool-exec:${toolEventCount}`,
              kind: 'tool_execute',
              phase,
              name: event.tool_call.function.name,
              args: event.args,
              anchor: nextMode === 'deep_research' ? 'thinking' : phase,
              groupId: event.tool_call.id,
            })
            if (nextMode === 'normal' && phase === 'answer') {
              setChatMessages((prev) => ({
                ...prev,
                [selectedChatId]: appendRunAnswerMarker(prev[selectedChatId] ?? [], newRunId, {
                  id: `${newRunId}:retry:answer-tool:${toolEventCount}`,
                  kind: 'tool',
                  eventId: event.tool_call.id,
                }),
              }))
            }
          } else if (event.type === 'tool_result') {
            toolEventCount += 1
            const phase = hasAnswerStarted ? 'answer' : 'thinking'
            appendEventToRunMessage({
              id: `${newRunId}:retry:tool-result:${toolEventCount}`,
              kind: 'tool_result',
              phase,
              name: event.name,
              ok: event.result.ok,
              payload: event.result,
              anchor: nextMode === 'deep_research' ? 'thinking' : phase,
              groupId: event.tool_call_id,
            })
          } else if (event.type === 'approval_requested') {
            toolEventCount += 1
            const phase = hasAnswerStarted ? 'answer' : 'thinking'
            appendEventToRunMessage({
              id: `${newRunId}:retry:approval-requested:${toolEventCount}`,
              kind: 'approval_requested',
              phase,
              name: event.tool_call.function.name,
              summary: event.summary,
              reason: event.reason,
              anchor: nextMode === 'deep_research' ? 'thinking' : phase,
              groupId: event.tool_call.id,
            })
          } else if (event.type === 'approval_resolved') {
            toolEventCount += 1
            const phase = hasAnswerStarted ? 'answer' : 'thinking'
            appendEventToRunMessage({
              id: `${newRunId}:retry:approval-resolved:${toolEventCount}`,
              kind: 'approval_resolved',
              phase,
              name: 'approval',
              approved: event.approved,
              anchor: nextMode === 'deep_research' ? 'thinking' : phase,
              groupId: event.tool_call_id,
            })
          }
        },
        maxTurns: 12,
      })

      if ('content' in result) {
        if (!sawAnyDelta) {
          streamParser.pushDelta(result.content)
          syncStreamText()
        }
        const sanitized = sanitizeThink(result.content)
        patchRunMessage({
          status: 'completed',
          thinkText: streamParser.getThinkingText().trim() || sanitized.thinkText,
          finalText: streamParser.getAnswerText().replace(/\n{3,}/g, '\n\n').trim() || sanitized.visibleText,
        })
      } else if (result.error.code === 'APPROVAL_REQUIRED' && 'pendingApproval' in result) {
        patchRunMessage({ status: 'waiting_approval' })
        setPendingApprovals((prev) => ({
          ...prev,
          [newRunId]: {
            chatId: selectedChatId,
            runId: newRunId,
            approval: result.pendingApproval,
            config: {
              baseUrl: latestConfig.baseUrl ?? 'https://api.minimaxi.com/v1',
              model: latestConfig.model ?? 'MiniMax-M2.7',
              apiKey,
            },
          },
        }))
      } else {
        patchRunMessage({ status: 'error', finalText: result.error.message })
      }
    } catch (error) {
      const message = toReadableRunError(error)
      patchRunMessage({ status: 'error', finalText: message })
      setErrorMessage(message)
    } finally {
      activeRunIdRef.current = null
      activeAbortControllerRef.current = null
      setRunningChatId(null)
    }
  }

  function handleBranchToNewChat() {
    const sourceThread = selectedThread
    const exported: ThreadMessage[] = []
    for (const msg of sourceThread) {
      if (msg.kind === 'user') {
        exported.push(createUserMessage(`u_${Math.random().toString(16).slice(2)}`, msg.text, now()))
      } else if (msg.kind === 'assistant') {
        exported.push(createAssistantMessage(`a_${Math.random().toString(16).slice(2)}`, msg.text, now()))
      } else if (msg.kind === 'run') {
        const visibleFinalText = getVisibleAssistantText(msg.finalText)
        if (visibleFinalText.trim()) {
          exported.push(createAssistantMessage(`a_${Math.random().toString(16).slice(2)}`, visibleFinalText, now()))
        }
      }
    }

    const id = `c_${Math.random().toString(16).slice(2)}`
    setChats((prev) => [{ id, title: 'Branched Chat', workspacePath: selectedWorkspacePath, lastActivatedAt: Date.now() }, ...prev])
    setSelectedChatId(id)
    setChatMessages((prev) => ({ ...prev, [id]: exported }))
  }

  function handleTogglePin(chatId: string) {
    const nowTs = Date.now()
    setChats((prev) =>
      prev.map((chat) => {
        if (chat.id !== chatId) return chat
        if (chat.pinnedAt) {
          return { ...chat, pinnedAt: null, lastActivatedAt: nowTs }
        }
        return { ...chat, pinnedAt: nowTs }
      }),
    )
    setOpenChatMenuId(null)
  }

  function activateChat(chatId: string) {
    setSelectedChatId(chatId)
  }

  function handleRenameChat(chatId: string) {
    const current = chats.find((chat) => chat.id === chatId)
    const nextTitle = window.prompt('重命名会话', current?.title ?? 'New Chat')
    if (!nextTitle || !nextTitle.trim()) {
      setOpenChatMenuId(null)
      return
    }
    setChats((prev) => prev.map((chat) => (chat.id === chatId ? { ...chat, title: nextTitle.trim() } : chat)))
    setOpenChatMenuId(null)
  }

  function handleDeleteChat(chatId: string) {
    const rest = chats.filter((chat) => chat.id !== chatId)
    const fallbackChat = { id: newId(), title: 'New Chat', workspacePath: null, pinned: false }
    const normalizedFallbackChat = { id: fallbackChat.id, title: fallbackChat.title, workspacePath: fallbackChat.workspacePath, pinnedAt: null, lastActivatedAt: Date.now() }
    const nextChats = rest.length > 0 ? rest : [normalizedFallbackChat]
    const nextSelectedId = selectedChatId === chatId ? nextChats[0]!.id : selectedChatId
    setChats(nextChats)
    setChatMessages((prev) => {
      const next = { ...prev }
      delete next[chatId]
      if (rest.length === 0) next[normalizedFallbackChat.id] = []
      return next
    })
    setSelectedChatId(nextSelectedId)
    setOpenChatMenuId(null)
  }

  useEffect(() => {
    let cancelled = false
    if (testDisableAutoRuntime) {
      setRuntime(null)
      return
    }
    if (!isTauri()) {
      setRuntime(null)
      return
    }
    ;(async () => {
      try {
        const nextRuntime = await buildRuntimeForWorkspace(selectedWorkspacePath)
        if (!cancelled) setRuntime(nextRuntime)
      } catch {
        if (!cancelled) setRuntime(null)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [selectedChatId, selectedWorkspacePath])

  useEffect(() => {
    if (!chatStore || !chatStoreHydrated) return
    void chatStore.saveAll({ chats, chatMessages })
  }, [chatStore, chatStoreHydrated, chats, chatMessages])

  useEffect(() => {
    for (const message of selectedThread) {
      if (message.kind !== 'run') continue
      const latestApproval = [...message.events].reverse().find((event) => event.kind === 'approval_requested')
      if (!latestApproval) continue
      if (seenApprovalRequestEventIdsRef.current[message.id] === latestApproval.id) continue
      seenApprovalRequestEventIdsRef.current[message.id] = latestApproval.id
      if (!shouldAutoAnchorApproval(followStateRef.current, message.id)) continue
      pendingApprovalAnchorRef.current = {
        runId: message.id,
        stepKey: latestApproval.groupId ?? latestApproval.id,
      }
    }
  }, [selectedThread])

  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      const threadEl = threadRef.current
      const pendingScrollMessageId = pendingScrollMessageIdRef.current

      function performThreadScroll(top: number, behavior: ScrollBehavior) {
        if (!threadEl || typeof threadEl.scrollTo !== 'function') return
        suppressThreadScrollRef.current = true
        threadEl.scrollTo({ top: Math.max(0, top), behavior })
        requestAnimationFrame(() => {
          suppressThreadScrollRef.current = false
        })
      }

      const pendingApprovalAnchor = pendingApprovalAnchorRef.current
      if (pendingApprovalAnchor) {
        const targetEl = processStepElementRefs.current[`${pendingApprovalAnchor.runId}:${pendingApprovalAnchor.stepKey}`]
        if (threadEl && targetEl) {
          pendingApprovalAnchorRef.current = null
          const threadRect = threadEl.getBoundingClientRect()
          const targetRect = targetEl.getBoundingClientRect()
          const targetTop = threadEl.scrollTop + (targetRect.top - threadRect.top) - 12
          performThreadScroll(targetTop, 'auto')
          return
        }
      }

      if (pendingScrollMessageId) {
        const targetEl = messageElementRefs.current[pendingScrollMessageId]
        pendingScrollMessageIdRef.current = null
        if (threadEl && targetEl) {
          const threadRect = threadEl.getBoundingClientRect()
          const targetRect = targetEl.getBoundingClientRect()
          const targetTop = threadEl.scrollTop + (targetRect.top - threadRect.top) - 12
          performThreadScroll(targetTop, 'auto')
          return
        }
      }

      const isNearBottom = (() => {
        if (!threadEl) return true
        const distance = threadEl.scrollHeight - threadEl.scrollTop - threadEl.clientHeight
        return distance < 140
      })()

      // While streaming, only auto-follow if the user is already near the bottom.
      if (runningChatId === selectedChatId) {
        if (!shouldAutoFollowRun(followStateRef.current, activeRunIdRef.current)) return
        if (threadEl) performThreadScroll(threadEl.scrollHeight, 'auto')
        return
      }

      if (pendingFinalScrollRef.current) {
        pendingFinalScrollRef.current = false
        if (threadEl) performThreadScroll(threadEl.scrollHeight, 'auto')
        return
      }

      if (!isNearBottom) return

      if (threadEl) performThreadScroll(threadEl.scrollHeight, 'smooth')
    })
    return () => cancelAnimationFrame(raf)
  }, [selectedThread, runningChatId, selectedChatId])

  async function handlePickWorkspace(chatId = selectedChatId) {
    try {
      setErrorMessage(null)
      if (!isTauri()) {
        setErrorMessage('当前是 Web 预览模式：请用 pnpm tauri:dev 运行桌面端')
        return null
      }
      const picked = await chooseWorkspace()
      if (!picked) return null
      await refreshConfigStatus()
      setChats((prev) => upsertRecentChat(prev, { id: chatId, workspacePath: picked }))
      if (chatId === selectedChatId) {
        const rt = await buildRuntimeForWorkspace(picked)
        setRuntime(rt)
      }
      return picked
    } catch (error) {
      if (error instanceof Error) {
        setErrorMessage(error.message)
        return null
      }
      if (typeof error === 'string') {
        setErrorMessage(error)
        return null
      }
      try {
        setErrorMessage(JSON.stringify(error))
      } catch {
        setErrorMessage('选择 Workspace 失败')
      }
      return null
    }
  }

  async function maybeGenerateSessionTitle(input: {
    chatId: string
    firstPrompt: string
    currentTitle: string
    existingUserMessageCount: number
    config: MinimaxConfigStatus
  }) {
    if (
      !shouldGenerateSessionTitle({
        currentTitle: input.currentTitle,
        existingUserMessageCount: input.existingUserMessageCount,
      })
    ) {
      return
    }

    const fallback = buildFallbackSessionTitle(input.firstPrompt)
    const apiKey = input.config.getApiKey()
    if (!input.config.configured || !apiKey) {
      setChats((prev) => upsertRecentChat(prev, { id: input.chatId, title: fallback }))
      return
    }

    try {
      const result = await createChatCompletionOpenAICompat({
        baseUrl: input.config.baseUrl ?? 'https://api.minimaxi.com/v1',
        apiKey,
        model: input.config.model ?? 'MiniMax-M2.7',
        messages: [
          {
            role: 'system',
            content:
              'Generate a very short session title from the user prompt. Return title text only, no quotes, no markdown, no punctuation prefix, keep it concise.',
          },
          { role: 'user', content: input.firstPrompt },
        ],
        temperature: 0.2,
      })
      const generated = result.kind === 'content' ? resolveSessionTitleFromPrompt(input.firstPrompt, result.content) : null
      setChats((prev) => upsertRecentChat(prev, { id: input.chatId, title: generated ?? fallback }))
    } catch {
      setChats((prev) => upsertRecentChat(prev, { id: input.chatId, title: fallback }))
    }
  }

  async function handleSendRun() {
    const task = prompt.trim()
    if (!task) return
    const currentChatTitle = chats.find((chat) => chat.id === selectedChatId)?.title ?? 'New Chat'
    const existingUserMessageCount = selectedThread.filter((message) => message.kind === 'user').length
    const runId = newId()
    const runMode = deepResearchEnabled ? 'deep_research' : 'normal'
    fileRollbackJournalRef.current[runId] = []
    setPrompt('')
    setErrorMessage(null)
    setRunningChatId(selectedChatId)
    activeRunIdRef.current = runId
    const latestConfig = await refreshConfigStatus()
    const userMessage = createUserMessage(newId(), task, now())
    pendingScrollMessageIdRef.current = userMessage.id
    followStateRef.current = beginRunFollow(runId)
    setChats((prev) => upsertRecentChat(prev, { id: selectedChatId }))
    setChatMessages((prev) => ({
      ...prev,
      [selectedChatId]: appendRunMessages(prev[selectedChatId] ?? [], userMessage, createPendingRunMessage(runId, now(), runMode)),
    }))
    void maybeGenerateSessionTitle({
      chatId: selectedChatId,
      firstPrompt: task,
      currentTitle: currentChatTitle,
      existingUserMessageCount,
      config: latestConfig,
    })

    if (!latestConfig.configured) {
      setChatMessages((prev) => ({
        ...prev,
        [selectedChatId]: completeRunMessage(prev[selectedChatId] ?? [], runId, {
          status: 'error',
          finalText: `MiniMax 未配置：请编辑 ${configPath} 后重试。`,
        }),
      }))
      setRunningChatId(null)
      return
    }
    let activeRuntime = runtime
    if (!activeRuntime) {
      activeRuntime = await buildRuntimeForWorkspace(selectedWorkspacePath)
      if (activeRuntime) setRuntime(activeRuntime)
    }
    if (!activeRuntime) {
      setChatMessages((prev) => ({
        ...prev,
        [selectedChatId]: completeRunMessage(prev[selectedChatId] ?? [], runId, {
          status: 'error',
          finalText: '当前无法初始化运行时：请在桌面端打开应用后重试。',
        }),
      }))
      setRunningChatId(null)
      return
    }
    const apiKey = latestConfig.getApiKey()
    if (!apiKey) {
      setChatMessages((prev) => ({
        ...prev,
        [selectedChatId]: completeRunMessage(prev[selectedChatId] ?? [], runId, {
          status: 'error',
          finalText: `读取配置失败：请检查 ${configPath} 的 baseUrl/apiKey/model。`,
        }),
      }))
      setRunningChatId(null)
      return
    }

    const abortController = new AbortController()
    activeAbortControllerRef.current = abortController
    const streamParser = createThinkStreamParser()
    let sawAnyDelta = false
    let finalScrollStatus: 'completed' | 'error' | 'waiting_approval' | 'pending' = 'pending'
    let hasAnswerStarted = false
    let toolEventCount = 0
    let lastAnswerSnapshot = ''

    const patchRunMessage = (patch: Partial<Pick<RunThreadMessage, 'status' | 'thinkText' | 'events' | 'finalText' | 'mode' | 'answerSegments'>>) => {
      setChatMessages((prev) => ({
        ...prev,
        [selectedChatId]: completeRunMessage(prev[selectedChatId] ?? [], runId, patch),
      }))
    }

    const appendEventToRunMessage = (event: RunEvent) => {
      setChatMessages((prev) => ({
        ...prev,
        [selectedChatId]: appendRunEvent(prev[selectedChatId] ?? [], runId, event),
      }))
    }

    const syncStreamText = () => {
      const thinkingText = streamParser.getThinkingText()
      const answerText = streamParser.getAnswerText()
      if (!hasAnswerStarted && answerText.trim().length > 0) {
        hasAnswerStarted = true
      }
      const compactAnswerText = answerText.replace(/\n{3,}/g, '\n\n')
      const deltaText = compactAnswerText.slice(lastAnswerSnapshot.length)
      if (runMode === 'normal' && deltaText) {
        setChatMessages((prev) => ({
          ...prev,
          [selectedChatId]: appendRunAnswerText(prev[selectedChatId] ?? [], runId, deltaText),
        }))
      }
      lastAnswerSnapshot = compactAnswerText
      patchRunMessage({
        thinkText: thinkingText.trim() || null,
        finalText: compactAnswerText.trim() || null,
      })
    }

    const openAiChatCompletion = async (args: {
      messages: OpenAICompatChatMessage[]
      tools?: OpenAICompatTool[]
    }) => {
      return createChatCompletionOpenAICompat({
        baseUrl: latestConfig.baseUrl ?? 'https://api.minimaxi.com/v1',
        apiKey,
        model: latestConfig.model ?? 'MiniMax-M2.7',
        messages: args.messages,
        tools: args.tools,
        tool_choice: 'auto',
        temperature: 0.2,
        signal: abortController.signal,
      })
    }

    const openAiChatCompletionStream = async (args: {
      messages: OpenAICompatChatMessage[]
      tools?: OpenAICompatTool[]
      onContentDelta?: (delta: string) => void
    }) => {
      return createChatCompletionStreamOpenAICompat({
        baseUrl: latestConfig.baseUrl ?? 'https://api.minimaxi.com/v1',
        apiKey,
        model: latestConfig.model ?? 'MiniMax-M2.7',
        messages: args.messages,
        tools: args.tools,
        tool_choice: 'auto',
        temperature: 0.2,
        signal: abortController.signal,
        onContentDelta: (delta) => {
          sawAnyDelta = true
          streamParser.pushDelta(delta)
          syncStreamText()
          args.onContentDelta?.(delta)
        },
      })
    }

    const summarizeBatch = async (messages: OpenAICompatChatMessage[]): Promise<CompressionSummary> => {
      const response = await createChatCompletionOpenAICompat({
        baseUrl: latestConfig.baseUrl ?? 'https://api.minimaxi.com/v1',
        apiKey,
        model: latestConfig.model ?? 'MiniMax-M2.7',
        messages: [
          {
            role: 'system',
            content:
              'Summarize old coding-agent conversation into strict JSON only. Keys: userGoals, keyDecisions, touchedFiles, issuesAndFixes, pendingWork, nextStep.',
          },
          { role: 'user', content: JSON.stringify(messages) },
        ],
        temperature: 0.1,
        signal: abortController.signal,
      })

      if (response.kind !== 'content') {
        throw new Error('Compression summarizer returned tool calls unexpectedly')
      }

      const parsed = JSON.parse(response.content) as Partial<CompressionSummary>
      return {
        userGoals: Array.isArray(parsed.userGoals) ? parsed.userGoals : [],
        keyDecisions: Array.isArray(parsed.keyDecisions) ? parsed.keyDecisions : [],
        touchedFiles: Array.isArray(parsed.touchedFiles) ? (parsed.touchedFiles as CompressionSummary['touchedFiles']) : [],
        issuesAndFixes: Array.isArray(parsed.issuesAndFixes) ? parsed.issuesAndFixes : [],
        pendingWork: Array.isArray(parsed.pendingWork) ? parsed.pendingWork : [],
        nextStep: typeof parsed.nextStep === 'string' ? parsed.nextStep : '',
      }
    }

    try {
      const fullContextMessages = buildChatContextMessages({
        systemMessage: { role: 'system', content: SYSTEM_PROMPT },
        thread: selectedThread,
        newUserText: task,
        maxContextChars: Number.MAX_SAFE_INTEGER,
      })
      const modelCharBudget = getUsableContextCharBudget(latestConfig.model)
      let compressionSummaryText: string | undefined

      const savedSummary = await activeRuntime.contextSummaryStore.getLatest(selectedChatId)
      if (savedSummary?.summaryJson) {
        try {
          const parsed = JSON.parse(savedSummary.summaryJson) as CompressionSummary
          compressionSummaryText = renderCompressionSummaryMessage(parsed).content
        } catch {
          compressionSummaryText = undefined
        }
      }

      if (estimateMessagesChars(fullContextMessages) > modelCharBudget) {
        try {
          const olderMessages = fullContextMessages.slice(1, Math.max(1, fullContextMessages.length - 3))
          const chunks = chunkMessagesForCompression(olderMessages, Math.max(40_000, Math.floor(modelCharBudget / 3)))
          const partialSummaries = [] as CompressionSummary[]
          for (const chunk of chunks) {
            partialSummaries.push(await summarizeBatch(chunk))
          }

          const merged = await compressContextWithMinimax({
            messages: fullContextMessages,
            maxContextChars: modelCharBudget,
            summarize: async () => {
              if (partialSummaries.length === 1) return partialSummaries[0]
              return summarizeBatch(
                partialSummaries.map((item) => ({
                  role: 'assistant',
                  content: JSON.stringify(item),
                })) as OpenAICompatChatMessage[],
              )
            },
          })

          if (merged.mode === 'compressed') {
            compressionSummaryText = merged.message.content
            await runtime.contextSummaryStore.save({
              chatId: selectedChatId,
              summaryJson: JSON.stringify(merged.summary),
              sourceMessageCount: fullContextMessages.length,
            })
          }
        } catch {
          compressionSummaryText = undefined
        }
      }

      const contextMessages = buildChatContextMessages({
        systemMessage: { role: 'system', content: SYSTEM_PROMPT },
        thread: selectedThread,
        newUserText: task,
        maxContextChars: modelCharBudget,
        compressionSummary: compressionSummaryText,
      })

      const result = await runEngine({
        messages: contextMessages,
        tools: activeRuntime.tools,
        chatCompletion: ({ messages, tools }) => openAiChatCompletion({ messages, tools }),
        chatCompletionStream: ({ messages, tools, onContentDelta }) =>
          openAiChatCompletionStream({ messages, tools, onContentDelta }),
        workspacePath: selectedWorkspacePath ?? undefined,
        onTimelineEvent: (event) => {
          if (event.type === 'tool_execute') {
            toolEventCount += 1
            const phase = hasAnswerStarted ? 'answer' : 'thinking'
            const eventId = `${runId}:tool-exec:${toolEventCount}`
            appendEventToRunMessage({
              id: eventId,
              kind: 'tool_execute',
              phase,
              name: event.tool_call.function.name,
              args: event.args,
              anchor: runMode === 'deep_research' ? 'thinking' : phase,
              groupId: event.tool_call.id,
            })
            if (runMode === 'normal' && phase === 'answer') {
              setChatMessages((prev) => ({
                ...prev,
                [selectedChatId]: appendRunAnswerMarker(prev[selectedChatId] ?? [], runId, {
                  id: `${runId}:answer-tool:${toolEventCount}`,
                  kind: 'tool',
                  eventId: event.tool_call.id,
                }),
              }))
            }
          } else if (event.type === 'tool_result') {
            toolEventCount += 1
            const phase = hasAnswerStarted ? 'answer' : 'thinking'
            appendEventToRunMessage({
              id: `${runId}:tool-result:${toolEventCount}`,
              kind: 'tool_result',
              phase,
              name: event.name,
              ok: event.result.ok,
              payload: event.result,
              anchor: runMode === 'deep_research' ? 'thinking' : phase,
              groupId: event.tool_call_id,
            })
          } else if (event.type === 'approval_requested') {
            toolEventCount += 1
            const phase = hasAnswerStarted ? 'answer' : 'thinking'
            appendEventToRunMessage({
              id: `${runId}:approval-requested:${toolEventCount}`,
              kind: 'approval_requested',
              phase,
              name: event.tool_call.function.name,
              summary: event.summary,
              reason: event.reason,
              anchor: runMode === 'deep_research' ? 'thinking' : phase,
              groupId: event.tool_call.id,
            })
            if (runMode === 'normal') {
              setChatMessages((prev) => ({
                ...prev,
                [selectedChatId]: appendRunAnswerMarker(prev[selectedChatId] ?? [], runId, {
                  id: `${runId}:answer-approval:${toolEventCount}`,
                  kind: 'approval',
                  eventId: event.tool_call.id,
                }),
              }))
            }
          } else if (event.type === 'approval_resolved') {
            toolEventCount += 1
            const phase = hasAnswerStarted ? 'answer' : 'thinking'
            appendEventToRunMessage({
              id: `${runId}:approval-resolved:${toolEventCount}`,
              kind: 'approval_resolved',
              phase,
              name: 'approval',
              approved: event.approved,
              anchor: runMode === 'deep_research' ? 'thinking' : phase,
              groupId: event.tool_call_id,
            })
          }
        },
        maxTurns: 12,
      })

      if ('content' in result) {
        finalScrollStatus = 'completed'
        // If the backend didn't stream (or stream was disabled), parse once at the end.
        if (!sawAnyDelta) {
          streamParser.pushDelta(result.content)
          syncStreamText()
        }
        const sanitized = sanitizeThink(result.content)
        patchRunMessage({
          status: 'completed',
          // Prefer the stream parser output (never leaks raw <think>).
          thinkText: streamParser.getThinkingText().trim() || sanitized.thinkText,
          finalText: streamParser.getAnswerText().replace(/\n{3,}/g, '\n\n').trim() || sanitized.visibleText,
        })
      } else if (result.error.code === 'APPROVAL_REQUIRED' && 'pendingApproval' in result) {
        finalScrollStatus = 'waiting_approval'
        patchRunMessage({ status: 'waiting_approval' })
        setPendingApprovals((prev) => ({
          ...prev,
          [runId]: {
            chatId: selectedChatId,
            runId,
            approval: result.pendingApproval,
            config: {
              baseUrl: latestConfig.baseUrl ?? 'https://api.minimaxi.com/v1',
              model: latestConfig.model ?? 'MiniMax-M2.7',
              apiKey,
            },
          },
        }))
      } else {
        finalScrollStatus = 'error'
        patchRunMessage({
          status: 'error',
          finalText: result.error.message,
        })
      }
    } catch (error) {
      finalScrollStatus = 'error'
      const message = toReadableRunError(error)
      patchRunMessage({ status: 'error', finalText: message })
      setErrorMessage(message)
    } finally {
      pendingFinalScrollRef.current = shouldTriggerFinalScroll({
        state: followStateRef.current,
        runId: activeRunIdRef.current,
        status: finalScrollStatus,
      })
      activeRunIdRef.current = null
      activeAbortControllerRef.current = null
      setRunningChatId(null)
    }
  }

  function handleStopRun() {
    activeAbortControllerRef.current?.abort()
  }

  function setApprovalUiState(runId: string, toolCallId: string, state: ApprovalUiState) {
    setApprovalUiStates((prev) => ({
      ...prev,
      [runId]: {
        ...(prev[runId] ?? {}),
        [toolCallId]: state,
      },
    }))
  }

  async function handleApprovalDecision(runId: string, approved: boolean) {
    const pending = pendingApprovals[runId]
    if (!pending) return

    setErrorMessage(null)
    setRunningChatId(pending.chatId)
    activeRunIdRef.current = runId
    setApprovalUiState(runId, pending.approval.toolCall.id, approved ? { status: 'resolving_approved' } : { status: 'resolving_denied' })
    const abortController = new AbortController()
    activeAbortControllerRef.current = abortController
    const streamParser = createThinkStreamParser()
    let toolEventCount = 0
    let lastAnswerSnapshot = ''
    let effectiveApproved = approved
    let finalScrollStatus: 'completed' | 'error' | 'waiting_approval' | 'pending' = 'pending'

    const patchRunMessage = (
      patch: Partial<Pick<RunThreadMessage, 'status' | 'thinkText' | 'events' | 'finalText' | 'mode' | 'answerSegments'>>,
    ) => {
      setChatMessages((prev) => ({
        ...prev,
        [pending.chatId]: completeRunMessage(prev[pending.chatId] ?? [], runId, patch),
      }))
    }

    const appendEventToRunMessage = (event: RunEvent) => {
      setChatMessages((prev) => ({
        ...prev,
        [pending.chatId]: appendRunEvent(prev[pending.chatId] ?? [], runId, event),
      }))
    }

    const syncResumeStreamText = () => {
      const answerText = streamParser.getAnswerText()
      const compactAnswerText = answerText.replace(/\n{3,}/g, '\n\n')
      const deltaText = compactAnswerText.slice(lastAnswerSnapshot.length)
      if (deltaText) {
        setChatMessages((prev) => ({
          ...prev,
          [pending.chatId]: appendRunAnswerText(prev[pending.chatId] ?? [], runId, deltaText),
        }))
      }
      lastAnswerSnapshot = compactAnswerText
      patchRunMessage({ finalText: compactAnswerText.trim() || null })
    }

    try {
      let resumeWorkspacePath = getChatWorkspacePath(pending.chatId)
      let resumeRuntime = runtime

      if (!resumeRuntime || pending.chatId !== selectedChatId || resumeWorkspacePath !== selectedWorkspacePath) {
        resumeRuntime = await buildRuntimeForWorkspace(resumeWorkspacePath)
      }
      if (!resumeRuntime) {
        throw new Error('当前无法初始化运行时')
      }

      const pendingTool = resumeRuntime.tools.get?.(pending.approval.toolCall.function.name)
      const needsWorkspaceBinding = Boolean(pendingTool?.policy?.requiresWorkspace) && !resumeWorkspacePath

      if (approved && needsWorkspaceBinding) {
        const picked = await handlePickWorkspace(pending.chatId)
        if (picked) {
          resumeWorkspacePath = picked
          resumeRuntime = await buildRuntimeForWorkspace(picked)
          if (pending.chatId === selectedChatId && resumeRuntime) setRuntime(resumeRuntime)
        } else {
          effectiveApproved = false
        }
      }

      if (!resumeRuntime) {
        throw new Error('当前无法初始化运行时')
      }

      const result = await resumeRunEngineWithApproval({
        pendingApproval: pending.approval,
        approved: effectiveApproved,
        tools: resumeRuntime.tools,
        workspacePath: resumeWorkspacePath ?? undefined,
        chatCompletion: ({ messages, tools }) =>
          createChatCompletionOpenAICompat({
            baseUrl: pending.config.baseUrl,
            apiKey: pending.config.apiKey,
            model: pending.config.model,
            messages,
            tools,
            tool_choice: 'auto',
            temperature: 0.2,
            signal: abortController.signal,
          }),
        chatCompletionStream: ({ messages, tools, onContentDelta }) =>
          createChatCompletionStreamOpenAICompat({
            baseUrl: pending.config.baseUrl,
            apiKey: pending.config.apiKey,
            model: pending.config.model,
            messages,
            tools,
            tool_choice: 'auto',
            temperature: 0.2,
            signal: abortController.signal,
            onContentDelta: (delta) => {
              streamParser.pushDelta(delta)
              syncResumeStreamText()
              onContentDelta?.(delta)
            },
          }),
        onTimelineEvent: (event) => {
          const placement = getResumeEventPlacement(Boolean(lastAnswerSnapshot.trim()))
          if (event.type === 'tool_execute') {
            toolEventCount += 1
            appendEventToRunMessage({
              id: `${runId}:resume-tool-exec:${toolEventCount}`,
              kind: 'tool_execute',
              phase: placement.phase,
              name: event.tool_call.function.name,
              args: event.args,
              anchor: placement.anchor,
              groupId: event.tool_call.id,
            })
            if (placement.shouldAppendAnswerMarker) {
              setChatMessages((prev) => ({
                ...prev,
                [pending.chatId]: appendRunAnswerMarker(prev[pending.chatId] ?? [], runId, {
                  id: `${runId}:resume-answer-tool:${toolEventCount}`,
                  kind: 'tool',
                  eventId: event.tool_call.id,
                }),
              }))
            }
          } else if (event.type === 'tool_result') {
            toolEventCount += 1
            appendEventToRunMessage({
              id: `${runId}:resume-tool-result:${toolEventCount}`,
              kind: 'tool_result',
              phase: placement.phase,
              name: event.name,
              ok: event.result.ok,
              payload: event.result,
              anchor: placement.anchor,
              groupId: event.tool_call_id,
            })
            if (placement.shouldAppendAnswerMarker) {
              setChatMessages((prev) => ({
                ...prev,
                [pending.chatId]: appendRunAnswerMarker(prev[pending.chatId] ?? [], runId, {
                  id: `${runId}:resume-answer-tool-result:${toolEventCount}`,
                  kind: 'tool',
                  eventId: event.tool_call_id,
                }),
              }))
            }
          } else if (event.type === 'approval_requested') {
            toolEventCount += 1
            appendEventToRunMessage({
              id: `${runId}:resume-approval-requested:${toolEventCount}`,
              kind: 'approval_requested',
              phase: placement.phase,
              name: event.tool_call.function.name,
              summary: event.summary,
              reason: event.reason,
              anchor: placement.anchor,
              groupId: event.tool_call.id,
            })
            if (placement.shouldAppendAnswerMarker) {
              setChatMessages((prev) => ({
                ...prev,
                [pending.chatId]: appendRunAnswerMarker(prev[pending.chatId] ?? [], runId, {
                  id: `${runId}:resume-answer-approval:${toolEventCount}`,
                  kind: 'approval',
                  eventId: event.tool_call.id,
                }),
              }))
            }
          } else if (event.type === 'approval_resolved') {
            toolEventCount += 1
            appendEventToRunMessage({
              id: `${runId}:resume-approval:${toolEventCount}`,
              kind: 'approval_resolved',
              phase: placement.phase,
              name: 'approval',
              approved: event.approved,
              anchor: placement.anchor,
              groupId: event.tool_call_id,
            })
            if (placement.shouldAppendAnswerMarker) {
              setChatMessages((prev) => ({
                ...prev,
                [pending.chatId]: appendRunAnswerMarker(prev[pending.chatId] ?? [], runId, {
                  id: `${runId}:resume-answer-approval-resolved:${toolEventCount}`,
                  kind: 'approval',
                  eventId: event.tool_call_id,
                }),
              }))
            }
          }
        },
      })

      setPendingApprovals((prev) => {
        const next = { ...prev }
        delete next[runId]
        return next
      })

      if ('content' in result) {
        finalScrollStatus = 'completed'
        if (!lastAnswerSnapshot) {
          streamParser.pushDelta(result.content)
          syncResumeStreamText()
        }
        setApprovalUiState(runId, pending.approval.toolCall.id, effectiveApproved ? { status: 'resolved_approved' } : { status: 'resolved_denied' })
        const sanitized = sanitizeThink(result.content)
        patchRunMessage({
          status: 'completed',
          finalText: streamParser.getAnswerText().replace(/\n{3,}/g, '\n\n').trim() || sanitized.visibleText,
        })
      } else if (result.error.code === 'APPROVAL_REQUIRED' && 'pendingApproval' in result) {
        finalScrollStatus = 'waiting_approval'
        patchRunMessage({ status: 'waiting_approval' })
        setPendingApprovals((prev) => ({
          ...prev,
          [runId]: {
            ...pending,
            approval: result.pendingApproval,
          },
        }))
        setApprovalUiState(runId, result.pendingApproval.toolCall.id, { status: 'pending' })
      } else {
        finalScrollStatus = 'error'
        setApprovalUiState(runId, pending.approval.toolCall.id, effectiveApproved ? { status: 'resolved_approved' } : { status: 'resolved_denied' })
        patchRunMessage({ status: 'error', finalText: result.error.message })
      }
    } catch (error) {
      finalScrollStatus = 'error'
      const message = toReadableRunError(error)
      setApprovalUiState(runId, pending.approval.toolCall.id, effectiveApproved ? { status: 'resolved_approved' } : { status: 'resolved_denied' })
      patchRunMessage({ status: 'error', finalText: message })
      setErrorMessage(message)
    } finally {
      pendingFinalScrollRef.current = shouldTriggerFinalScroll({
        state: followStateRef.current,
        runId: activeRunIdRef.current,
        status: finalScrollStatus,
      })
      activeRunIdRef.current = null
      activeAbortControllerRef.current = null
      setRunningChatId(null)
    }
  }

  async function handleSaveModelSettings() {
    try {
      setSettingsSaving(true)
      setErrorMessage(null)
      if (!isTauri()) {
        setErrorMessage('当前是 Web 预览模式：请用 pnpm tauri:dev 运行桌面端')
        return
      }

      const baseUrl = settingsBaseUrl.trim()
      const model = settingsModel.trim()
      const apiKey = settingsApiKey.trim()
      if (!baseUrl || !model || !apiKey) {
        setErrorMessage('请填写 baseUrl / model / apiKey')
        return
      }

      await saveMinimaxConfig({ baseUrl, model, apiKey })
      setSettingsApiKey('')
      await refreshConfigStatus()
      setShowModelSettings(false)
    } catch (e) {
      setErrorMessage(e instanceof Error ? e.message : '保存配置失败')
    } finally {
      setSettingsSaving(false)
    }
  }

  function handleNewChat() {
    const id = newId()
    setChats((prev) => [{ id, title: 'New Chat', workspacePath: null, pinnedAt: null, lastActivatedAt: Date.now() }, ...prev])
    setSelectedChatId(id)
    setChatMessages((prev) => ({
      ...prev,
      [id]: [],
    }))
  }

  function formatToolStepTitle(name: string, payload?: unknown) {
    const record = payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : null
    const path = typeof record?.path === 'string' ? record.path : null
    if (name === 'write_file' && path) return `正在写入 ${path}`
    if (name === 'read_file' && path) return `正在读取 ${path}`
    if (name === 'list_dir') return path ? `正在查看 ${path}` : '正在查看目录'
    if (name === 'search_code') return '正在搜索工作区'
    if (name === 'execute_command') return '正在运行命令'
    return name.replace(/_/g, ' ')
  }

  function getProcessStepTitle(input: {
    execute?: Extract<ToolExecutionEvent, { kind: 'tool_execute' }>
    approvalRequested?: Extract<ApprovalEvent, { kind: 'approval_requested' }>
    result?: Extract<ToolExecutionEvent, { kind: 'tool_result' }>
  }) {
    const summary = input.approvalRequested?.summary?.trim()
    if (summary && /workspace/i.test(summary)) return '正在确认工作区'
    if (input.execute) return formatToolStepTitle(input.execute.name, input.execute.args)
    if (summary) return summary
    if (input.result) return formatToolStepTitle(input.result.name)
    return 'Step'
  }

  function getProcessStepState(input: {
    uiState?: ApprovalUiState
    approvalRequested?: Extract<ApprovalEvent, { kind: 'approval_requested' }>
    approvalResolved?: Extract<ApprovalEvent, { kind: 'approval_resolved' }>
    result?: Extract<ToolExecutionEvent, { kind: 'tool_result' }>
  }): { label: string; tone: ProcessStepStatusTone; interactive: boolean } {
    if (input.result) {
      return input.result.ok
        ? { label: 'Done', tone: 'done', interactive: false }
        : { label: 'Error', tone: 'error', interactive: false }
    }
    if (input.uiState) {
      switch (input.uiState.status) {
        case 'pending':
          return { label: 'Waiting for approval', tone: 'waiting', interactive: true }
        case 'resolving_approved':
          return { label: 'Approved, continuing...', tone: 'approved', interactive: false }
        case 'resolving_denied':
          return { label: 'Denied, continuing...', tone: 'denied', interactive: false }
        case 'resolved_approved':
          return { label: 'Approved', tone: 'approved', interactive: false }
        case 'resolved_denied':
          return { label: 'Denied', tone: 'denied', interactive: false }
      }
    }
    if (input.approvalResolved) {
      return input.approvalResolved.approved
        ? { label: 'Approved', tone: 'approved', interactive: false }
        : { label: 'Denied', tone: 'denied', interactive: false }
    }
    if (input.approvalRequested) return { label: 'Waiting for approval', tone: 'waiting', interactive: true }
    return { label: 'Running', tone: 'running', interactive: false }
  }

  function buildProcessStepItems(runId: string, events: RunEvent[]) {
    const items: Array<{
      key: string
      firstSeenIndex: number
      execute?: Extract<ToolExecutionEvent, { kind: 'tool_execute' }>
      result?: Extract<ToolExecutionEvent, { kind: 'tool_result' }>
      approvalRequested?: Extract<ApprovalEvent, { kind: 'approval_requested' }>
      approvalResolved?: Extract<ApprovalEvent, { kind: 'approval_resolved' }>
    }> = []
    const byGroup = new Map<string, (typeof items)[number]>()

    for (const [index, event] of events.entries()) {
      if (
        event.kind !== 'tool_execute' &&
        event.kind !== 'tool_result' &&
        event.kind !== 'approval_requested' &&
        event.kind !== 'approval_resolved'
      ) {
        continue
      }

      const key = event.groupId ?? event.id
      let current = byGroup.get(key)
      if (!current) {
        current = { key, firstSeenIndex: index }
        byGroup.set(key, current)
        items.push(current)
      }

      if (event.kind === 'tool_execute') current.execute = event
      if (event.kind === 'tool_result') current.result = event
      if (event.kind === 'approval_requested') current.approvalRequested = event
      if (event.kind === 'approval_resolved') current.approvalResolved = event
    }

    return items
      .sort((a, b) => a.firstSeenIndex - b.firstSeenIndex)
      .map((item): ProcessStepItem => {
        const uiState =
          approvalUiStates[runId]?.[item.key] ??
          (item.approvalResolved
            ? { status: item.approvalResolved.approved ? 'resolved_approved' : 'resolved_denied' }
            : item.approvalRequested
              ? { status: 'pending' }
              : undefined)
        const state = getProcessStepState({
          uiState,
          approvalRequested: item.approvalRequested,
          approvalResolved: item.approvalResolved,
          result: item.result,
        })
        const resultPreview = item.result
          ? formatToolPayloadPreview(item.result.payload, { maxPreviewChars: 280 }).previewText.replace(/\s+/g, ' ').trim()
          : null
        return {
          key: item.key,
          title: getProcessStepTitle({
            execute: item.execute,
            approvalRequested: item.approvalRequested,
            result: item.result,
          }),
          statusLabel: state.label,
          statusTone: state.tone,
          interactive: state.interactive && Boolean(item.approvalRequested),
          execute: item.execute,
          result: item.result,
          approvalRequested: item.approvalRequested,
          approvalResolved: item.approvalResolved,
          resultPreview,
        }
      })
  }

  function renderProcessSteps(runId: string, events: RunEvent[]) {
    const items = buildProcessStepItems(runId, events)
    if (items.length === 0) return null

    return (
      <div className="mira-process-steps">
        {items.map((item) => (
          <div
            key={`${runId}:process-step:${item.key}`}
            ref={(node) => {
              processStepElementRefs.current[`${runId}:${item.key}`] = node
            }}
            className="mira-process-step"
          >
            <div className="mira-process-step-header">
              <div className="mira-process-step-title">{item.title}</div>
              <div className={`mira-process-step-status ${item.statusTone}`}>{item.statusLabel}</div>
            </div>
            {item.approvalRequested?.reason ? <div className="mira-process-step-meta">{item.approvalRequested.reason}</div> : null}
            {item.resultPreview ? (
              <div className="mira-process-step-result">
                <span className="mira-process-step-result-label">Result</span>
                <span className="mira-process-step-result-preview">{item.resultPreview}</span>
              </div>
            ) : null}
            {item.interactive ? (
              <div className="mira-approval-actions">
                <button type="button" className="mira-approval-btn allow" onClick={() => handleApprovalDecision(runId, true)}>
                  允许执行
                </button>
                <button type="button" className="mira-approval-btn deny" onClick={() => handleApprovalDecision(runId, false)}>
                  拒绝执行
                </button>
              </div>
            ) : null}
          </div>
        ))}
      </div>
    )
  }

  function getVisibleAssistantText(text: string | null | undefined) {
    return sanitizeThink(text ?? '').visibleText
  }

  return (
    <div className="mira-app">
      <aside className={`mira-sidebar ${drawerOpen ? 'open' : ''}`}>
        <div className="mira-sidebar-head">
          <div className="mira-brand">
            <span className="mira-brand-mark" />
            <span>circleloop</span>
          </div>
        </div>
        <div className="mira-sidebar-section">
          <div className="mira-nav-list">
            <button type="button" className="mira-nav-item" onClick={handleNewChat}>
              <span className="mira-nav-icon"><PlusIcon /></span>
              <span>New Chat</span>
            </button>
            <button type="button" className="mira-nav-item">
              <span className="mira-nav-icon"><TaskIcon /></span>
              <span>Task</span>
            </button>
            <button type="button" className="mira-nav-item">
              <span className="mira-nav-icon"><CustomizeIcon /></span>
              <span>Customize</span>
            </button>
          </div>
          <div className="mira-sidebar-title">Recents</div>
          <div className="mira-chat-list" role="list">
            {sortedChats.map((c) => (
              <div key={c.id} className={`mira-chat-row ${c.id === selectedChatId ? 'selected' : ''}`} role="listitem">
                <button
                  type="button"
                  className={`mira-chat-item ${c.id === selectedChatId ? 'selected' : ''}`}
                  onClick={() => {
                    activateChat(c.id)
                    setDrawerOpen(false)
                    setOpenChatMenuId(null)
                  }}
                >
                  {c.pinnedAt ? <Pin size={12} strokeWidth={2} className="mira-chat-pin" /> : null}
                  {c.title}
                </button>
                <button
                  type="button"
                  className="mira-chat-more"
                  aria-label={`Session actions ${c.title}`}
                  onClick={(event) => {
                    event.stopPropagation()
                    setOpenChatMenuId((prev) => (prev === c.id ? null : c.id))
                  }}
                >
                  <MoreHorizontal size={14} strokeWidth={2} />
                </button>
                {openChatMenuId === c.id ? (
                  <div className="mira-chat-menu">
                    <button type="button" className="mira-chat-menu-item" aria-label="Pin" onClick={() => handleTogglePin(c.id)}>
                      <Pin size={14} strokeWidth={2} />
                      <span>{c.pinnedAt ? 'Unpin' : 'Pin'}</span>
                    </button>
                    <button type="button" className="mira-chat-menu-item" aria-label="Rename" onClick={() => handleRenameChat(c.id)}>
                      <Pencil size={14} strokeWidth={2} />
                      <span>Rename</span>
                    </button>
                    <button type="button" className="mira-chat-menu-item danger" aria-label="Delete" onClick={() => handleDeleteChat(c.id)}>
                      <Trash2 size={14} strokeWidth={2} />
                      <span>Delete</span>
                    </button>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </div>
        <div className="mira-sidebar-footer">
          <div className="mira-user-pill">
            <span className="mira-user-avatar">B</span>
            <span>bytedance</span>
          </div>
          <div className="mira-user-actions">
            <button type="button" className="mira-user-icon" aria-label="Status">●</button>
            <button type="button" className="mira-user-icon" aria-label="History">◷</button>
            <button type="button" className="mira-user-icon" onClick={() => setShowModelSettings(true)} aria-label="Settings">⚙</button>
          </div>
        </div>
      </aside>

      {drawerOpen ? (
        <button type="button" className="mira-backdrop" aria-label="Close menu" onClick={() => setDrawerOpen(false)} />
      ) : null}

      <div className="mira-main">
        <div className="mira-topbar">
          <h1 className="mira-topbar-title">{chats.find((c) => c.id === selectedChatId)?.title ?? 'Chat'}</h1>
          <div className="mira-topbar-actions">
            <button type="button" className="mira-icon-btn" onClick={handleBranchToNewChat} aria-label="Branch">
              <BranchIcon size={18} />
            </button>
            <button
              type="button"
              className="mira-workspace-btn"
              aria-label="Workspace"
              onClick={() => void handlePickWorkspace()}
            >
              <FolderOpen size={16} strokeWidth={2} />
              <span>{formattedWorkspace}</span>
            </button>
          </div>
        </div>

        <div
          ref={threadRef}
          className="mira-thread"
          onScroll={() => {
            if (suppressThreadScrollRef.current) return
            if (runningChatId !== selectedChatId) return
            const currentRunId = activeRunIdRef.current
            if (!currentRunId) return
            followStateRef.current = interruptRunFollow(followStateRef.current, currentRunId)
          }}
        >
          {errorMessage ? <div className="mira-banner error">{errorMessage}</div> : null}

          <div className="mira-messages">
            {selectedThread.map((m) => (
              m.kind === 'run' ? (
                <div
                  key={m.id}
                  ref={(node) => {
                    messageElementRefs.current[m.id] = node
                  }}
                  data-testid={`thread-message-${m.id}`}
                  className={`mira-run ${m.status}`}
                >
                  <div className="mira-run-label">
                    <span className="mira-run-model">MiniMax-M2.7</span>
                    <span className="mira-mono">{m.time}</span>
                  </div>

                  {m.status === 'pending' ? <div className="mira-run-state">Thinking...</div> : null}
                  {m.status === 'waiting_approval' ? <div className="mira-run-state">等待你的确认…</div> : null}

                  {m.mode === 'deep_research' || m.thinkText || m.events.some((event) => event.kind === 'tool_execute' || event.kind === 'tool_result' || event.kind === 'approval_requested' || event.kind === 'approval_resolved') ? (
                    <details
                      className="mira-card"
                      open={isThinkingExpanded(
                        { status: m.status, hasStartedAnswer: Boolean(m.finalText?.trim() || m.answerSegments.length > 0) },
                        expandedRuns[m.id] === true,
                      )}
                      onToggle={(event) => {
                        const nextOpen = (event.currentTarget as HTMLDetailsElement).open
                        setExpandedRuns((prev) => ({ ...prev, [m.id]: nextOpen }))
                      }}
                    >
                      <summary className="mira-card-summary">
                        <span>{m.mode === 'deep_research' ? 'Deep Research' : 'Thinking completed'}</span>
                        <span className="mira-summary-icon"><ChevronDownIcon /></span>
                      </summary>
                      <div className="mira-card-body">
                        {m.thinkText ? <div className="mira-think-text">{m.thinkText}</div> : null}
                        {m.mode === 'deep_research' && !m.thinkText && m.events.length === 0 ? (
                          <div className="mira-thinking-placeholder">
                            {m.status === 'pending' ? 'Research trace will appear here...' : 'No reasoning text was returned for this research run.'}
                          </div>
                        ) : null}
                        {renderProcessSteps(m.id, m.events)}
                      </div>
                    </details>
                  ) : null}

                  {(() => {
                    const visibleFinalText = getVisibleAssistantText(m.finalText)
                    const showAssistantMessage = (m.status === 'completed' || m.status === 'error') && Boolean(visibleFinalText.trim())
                    return showAssistantMessage ? (
                    <div className="mira-msg assistant">
                      <div className="mira-msg-body mira-assistant-body">
                        {renderAssistantBlocks(visibleFinalText)}
                      </div>
                      <div className="mira-msg-actions-bottom">
                        {!isRunningCurrentChat ? (
                          <>
                            <button
                              type="button"
                              className="mira-msg-action-icon mira-tooltip"
                              aria-label="Copy"
                              data-tooltip="Copy"
                              onClick={() => void copyToClipboard(visibleFinalText)}
                            >
                              <Copy strokeWidth={2} />
                            </button>
                            <button
                              type="button"
                              className="mira-msg-action-icon mira-tooltip"
                              aria-label="Retry"
                              data-tooltip="Retry"
                              onClick={() => void handleRetryRun(m.id)}
                            >
                              <RotateCcw strokeWidth={2} />
                            </button>
                            <button
                              type="button"
                              className="mira-msg-action-icon mira-tooltip"
                              aria-label="Branch"
                              data-tooltip="Branch"
                              onClick={handleBranchToNewChat}
                            >
                              <BranchIcon size={12} />
                            </button>
                          </>
                        ) : null}
                      </div>
                    </div>
                    ) : null
                  })()}
                </div>
              ) : (
                <div
                  key={m.id}
                  ref={(node) => {
                    messageElementRefs.current[m.id] = node
                  }}
                  data-testid={`thread-message-${m.id}`}
                  data-thread-message-id={m.id}
                  className={`mira-msg ${m.kind === 'user' ? 'you' : 'assistant'}`}
                >
                  <div className="mira-msg-meta">
                    <span>{m.kind === 'user' ? 'You' : 'circleloop'}</span>
                    <span className="mira-mono">{m.time}</span>
                  </div>
                  <div className="mira-msg-body">{m.text}</div>
                  <div className="mira-msg-actions-bottom">
                    <button
                      type="button"
                      className="mira-msg-action-icon mira-tooltip"
                      aria-label="Copy"
                      data-tooltip="Copy"
                      onClick={() => void copyToClipboard(m.text)}
                    >
                      <Copy strokeWidth={2} />
                    </button>
                    {m.kind === 'user' && !isRunningCurrentChat ? (
                      <button
                        type="button"
                        className="mira-msg-action-icon mira-tooltip"
                        aria-label="Undo"
                        data-tooltip="Undo"
                        onClick={() => void handleUndoUser(m.id)}
                      >
                        <Undo2 strokeWidth={2} />
                      </button>
                    ) : null}
                  </div>
                </div>
              )
            ))}
            <div ref={threadBottomRef} />
          </div>
        </div>

        <div className="mira-composer">
          <div className="mira-composer-shell">
            <textarea
              className="mira-input"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  handleSendRun()
                }
              }}
              placeholder='Ask anything, use "/" to select a skill or "@" to reference a resource'
            />
            <div className="mira-composer-actions">
              <div className="mira-composer-left">
                <button
                  type="button"
                  className={`mira-chip mira-mode-toggle ${deepResearchEnabled ? 'active' : ''}`}
                  onClick={() => setDeepResearchEnabled((prev) => !prev)}
                  aria-pressed={deepResearchEnabled}
                >
                  Deep Research
                </button>
                <button type="button" className="mira-round-btn" aria-label="Attach">
                  📎
                </button>
                <button type="button" className="mira-round-btn" disabled aria-label="Link">
                  🔗
                </button>
                <button type="button" className="mira-round-btn" onClick={() => setPrompt('')} aria-label="Clear">
                  ✕
                </button>
              </div>
              <div className="mira-composer-right">
                <button type="button" className="mira-round-btn" disabled aria-label="Add">
                  +
                </button>
                {runningChatId === selectedChatId ? (
                  <button
                    type="button"
                    className="mira-round-btn mira-stop-btn"
                    onClick={handleStopRun}
                    aria-label="Stop"
                  >
                    <Square size={16} strokeWidth={2.4} />
                  </button>
                ) : (
                  <button
                    type="button"
                    className="mira-round-btn mira-send-btn"
                    onClick={handleSendRun}
                    disabled={!prompt.trim()}
                    aria-label="Send"
                  >
                    →
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {showModelSettings ? (
        <div className="mira-modal" role="dialog" aria-modal="true">
          <div className="mira-modal-card">
            <div className="mira-modal-head">
              <div className="mira-modal-title">配置 MiniMax</div>
              <button type="button" className="mira-btn" onClick={() => setShowModelSettings(false)}>
                关闭
              </button>
            </div>
            <div className="mira-modal-body">
              <div className="mira-hint">
                配置将保存到 <span className="mira-mono">{configPath}</span>。
              </div>
              <label className="mira-field">
                <div className="mira-field-label">Base URL</div>
                <input className="mira-text" value={settingsBaseUrl} onChange={(e) => setSettingsBaseUrl(e.target.value)} />
              </label>
              <label className="mira-field">
                <div className="mira-field-label">Model</div>
                <input className="mira-text" value={settingsModel} onChange={(e) => setSettingsModel(e.target.value)} />
              </label>
              <label className="mira-field">
                <div className="mira-field-label">API Key</div>
                <textarea
                  className="mira-input"
                  value={settingsApiKey}
                  onChange={(e) => setSettingsApiKey(e.target.value)}
                  placeholder="粘贴 MiniMax API Key"
                />
              </label>
              <div className="mira-composer-actions">
                <button type="button" className="mira-btn" onClick={() => setSettingsApiKey('')} disabled={settingsSaving}>
                  清空
                </button>
                <button
                  type="button"
                  className="mira-btn primary"
                  onClick={handleSaveModelSettings}
                  disabled={settingsSaving}
                >
                  保存
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

export default App
