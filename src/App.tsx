import { useEffect, useMemo, useRef, useState } from 'react'
import './App.css'
import { createAppDb } from './storage/appDb'
import { createChatThreadStore } from './storage/chatThreadStore'
import { chooseWorkspace } from './tauri/chooseWorkspace'
import { createTauriCommandOps } from './tauri/tauriCommandOps'
import { createTauriFileOps } from './tauri/tauriFileOps'
import { createRuntime } from './runtime/runtime'
import { isTauri } from './tauri/isTauri'
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
import { buildChatContextMessages } from './app/buildChatContext'
import { buildFallbackSessionTitle, resolveSessionTitleFromPrompt, shouldGenerateSessionTitle } from './app/sessionTitle'
import { getApprovalStatusText, isApprovalInteractive, type ApprovalUiState } from './app/approvalUiState'
import { filterRunEventsByLocation, getApprovalEventsByLocation } from './app/runEventAnchors'
import { createThinkStreamParser } from './app/thinkStreamParser'
import { getResumeEventPlacement } from './app/runTimelinePlacement'
import { isThinkingExpanded } from './app/runUiState'
import { compressContextWithMinimax, type CompressionSummary, renderCompressionSummaryMessage } from './context/contextCompressor'
import {
  appendRunMessages,
  appendRunEvent,
  appendRunAnswerMarker,
  appendRunAnswerText,
  completeRunMessage,
  createPendingRunMessage,
  createUserMessage,
  type AnswerSegment,
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

type ChatThreadStoreLike = ReturnType<typeof createChatThreadStore>
type ChatSummary = { id: string; title: string; workspacePath: string | null }

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
  input: { id: string; title?: string; workspacePath?: string | null },
) {
  const existing = chats.find((chat) => chat.id === input.id)
  const title = input.title ?? existing?.title ?? 'New Chat'
  const workspacePath = input.workspacePath === undefined ? (existing?.workspacePath ?? null) : input.workspacePath
  const rest = chats.filter((chat) => chat.id !== input.id)
  return [{ id: input.id, title, workspacePath }, ...rest]
}

function App() {
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

  const [chats, setChats] = useState<ChatSummary[]>([
    { id: 'c1', title: 'New Chat', workspacePath: null },
  ])
  const [selectedChatId, setSelectedChatId] = useState<string>('c1')
  const [chatMessages, setChatMessages] = useState<Record<string, ThreadMessage[]>>({
    c1: [],
  })
  const [runningChatId, setRunningChatId] = useState<string | null>(null)
  const [deepResearchEnabled, setDeepResearchEnabled] = useState(false)
  const [pendingApprovals, setPendingApprovals] = useState<Record<string, PendingApprovalRecord>>({})
  const [approvalUiStates, setApprovalUiStates] = useState<Record<string, ApprovalUiStateRecord>>({})
  const [expandedRuns, setExpandedRuns] = useState<Record<string, boolean>>({})
  const threadRef = useRef<HTMLDivElement | null>(null)
  const threadBottomRef = useRef<HTMLDivElement | null>(null)
  const activeAbortControllerRef = useRef<AbortController | null>(null)

  const configured = configStatus.configured
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
    const fileOps = await createTauriFileOps()
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
  const formattedWorkspace = selectedWorkspacePath ?? '未绑定'
  const workspaceTooltip = selectedWorkspacePath ?? '当前尚未选择工作区'
  const selectedThread = useMemo(() => chatMessages[selectedChatId] ?? [], [chatMessages, selectedChatId])

  useEffect(() => {
    let cancelled = false
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
    const timer = setTimeout(() => {
      const threadEl = threadRef.current

      if (runningChatId === selectedChatId) {
        if (threadEl && typeof threadEl.scrollTo === 'function') {
          threadEl.scrollTo({ top: threadEl.scrollHeight, behavior: 'auto' })
        } else if (typeof threadBottomRef.current?.scrollIntoView === 'function') {
          threadBottomRef.current.scrollIntoView({ behavior: 'auto', block: 'end' })
        }
        return
      }

      const isNearBottom = (() => {
        if (!threadEl) return true
        if (typeof threadEl.scrollTo !== 'function') return true
        const distance = threadEl.scrollHeight - threadEl.scrollTop - threadEl.clientHeight
        return distance < 140
      })()

      if (!isNearBottom) return

      if (threadEl && typeof threadEl.scrollTo === 'function') {
        threadEl.scrollTo({ top: threadEl.scrollHeight, behavior: 'smooth' })
      } else if (typeof threadBottomRef.current?.scrollIntoView === 'function') {
        threadBottomRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' })
      }
    }, 50)
    return () => clearTimeout(timer)
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
    setPrompt('')
    setErrorMessage(null)
    setRunningChatId(selectedChatId)
    const latestConfig = await refreshConfigStatus()
    const userMessage = createUserMessage(newId(), task, now())
    const runId = newId()
    const runMode = deepResearchEnabled ? 'deep_research' : 'normal'
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
            if (runMode === 'normal' && phase === 'answer') {
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
        patchRunMessage({
          status: 'error',
          finalText: result.error.message,
        })
      }
    } catch (error) {
      const message = toReadableRunError(error)
      patchRunMessage({ status: 'error', finalText: message })
      setErrorMessage(message)
    } finally {
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
    setApprovalUiState(runId, pending.approval.toolCall.id, approved ? { status: 'resolving_approved' } : { status: 'resolving_denied' })
    const abortController = new AbortController()
    activeAbortControllerRef.current = abortController
    const streamParser = createThinkStreamParser()
    let toolEventCount = 0
    let lastAnswerSnapshot = ''
    let effectiveApproved = approved

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
        if (!lastAnswerSnapshot) {
          streamParser.pushDelta(result.content)
          syncResumeStreamText()
        }
        setApprovalUiState(runId, pending.approval.toolCall.id, effectiveApproved ? { status: 'resolved_approved' } : { status: 'resolved_denied' })
        patchRunMessage({ status: 'completed', finalText: result.content })
      } else if (result.error.code === 'APPROVAL_REQUIRED' && 'pendingApproval' in result) {
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
        setApprovalUiState(runId, pending.approval.toolCall.id, effectiveApproved ? { status: 'resolved_approved' } : { status: 'resolved_denied' })
        patchRunMessage({ status: 'error', finalText: result.error.message })
      }
    } catch (error) {
      const message = toReadableRunError(error)
      setApprovalUiState(runId, pending.approval.toolCall.id, effectiveApproved ? { status: 'resolved_approved' } : { status: 'resolved_denied' })
      patchRunMessage({ status: 'error', finalText: message })
      setErrorMessage(message)
    } finally {
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
    setChats((prev) => [{ id, title: 'New Chat', workspacePath: null }, ...prev])
    setSelectedChatId(id)
    setChatMessages((prev) => ({
      ...prev,
      [id]: [],
    }))
  }

  function buildToolDetailsItems(events: RunEvent[]) {
    const items: Array<{
      key: string
      name: string
      anchor: 'thinking' | 'answer'
      phase: 'thinking' | 'answer'
      executeArgs?: unknown
      resultOk?: boolean
      resultPayload?: unknown
    }> = []
    const byGroup = new Map<string, (typeof items)[number]>()

    for (const event of events) {
      if (event.kind !== 'tool_execute' && event.kind !== 'tool_result') continue
      const key = event.groupId ?? event.id
      const current =
        byGroup.get(key) ??
        {
          key,
          name: event.name,
          anchor: event.anchor ?? event.phase,
          phase: event.phase,
        }

      if (event.kind === 'tool_execute') current.executeArgs = event.args
      if (event.kind === 'tool_result') {
        current.resultOk = event.ok
        current.resultPayload = event.payload
      }

      if (!byGroup.has(key)) {
        byGroup.set(key, current)
        items.push(current)
      }
    }

    return items
  }

  function renderToolDetails(
    runId: string,
    events: RunEvent[],
    location: 'thinking' | 'answer',
  ) {
    const items = buildToolDetailsItems(
      filterRunEventsByLocation(events, location).filter((event) => event.kind === 'tool_execute' || event.kind === 'tool_result'),
    )

    if (items.length === 0) return null

    const maxPreviewChars = location === 'thinking' ? 240 : 520
    return (
      <div className={`mira-tool-lines ${location === 'answer' ? 'inline' : ''}`}>
        {items.map((item, i) => {
          const payload = item.resultPayload ?? item.executeArgs
          const preview = formatToolPayloadPreview(payload, { maxPreviewChars })
          const oneLine = preview.previewText.replace(/\s+/g, ' ').trim()
          const status = item.resultOk === undefined ? 'call' : item.resultOk ? 'ok' : 'error'
          return (
            <div key={`${runId}:${location}:${item.key}:${i}`} className="mira-tool-line">
              <span className={`mira-tool-line-badge ${status}`}>{status}</span>
              <span className="mira-tool-line-name">{item.name}</span>
              {oneLine ? <span className="mira-tool-line-preview">{oneLine}</span> : null}
            </div>
          )
        })}
      </div>
    )
  }

  function renderApprovalDetails(runId: string, events: RunEvent[], location: 'thinking' | 'answer') {
    const items = getApprovalEventsByLocation(events, location)
    if (items.length === 0) return null

    return (
      <div className={`mira-tool-lines ${location === 'answer' ? 'inline' : ''}`}>
        {items.map((event, index) => {
          if (event.kind === 'approval_requested') {
            const toolCallId = event.groupId ?? event.id
            const uiState = approvalUiStates[runId]?.[toolCallId] ?? { status: 'pending' }
            const interactive = isApprovalInteractive(uiState)
            return (
              <div key={`${runId}:approval:${event.id}:${index}`} className="mira-approval-line">
                <span className="mira-tool-line-badge ask">ask</span>
                <span className="mira-tool-line-name">{event.name}</span>
                <span className="mira-tool-line-preview">{event.summary}</span>
                <span className="mira-approval-reason">{event.reason}</span>
                <span className="mira-approval-label">{getApprovalStatusText(uiState)}</span>
                {interactive ? (
                  <>
                    <span className="mira-approval-actions">
                      <button type="button" className="mira-approval-btn allow" onClick={() => handleApprovalDecision(runId, true)}>
                        允许执行
                      </button>
                      <button type="button" className="mira-approval-btn deny" onClick={() => handleApprovalDecision(runId, false)}>
                        拒绝执行
                      </button>
                    </span>
                  </>
                ) : null}
              </div>
            )
          }
          if (event.kind === 'approval_resolved') {
            return (
              <div key={`${runId}:approval:${event.id}:${index}`} className="mira-tool-line">
                <span className={`mira-tool-line-badge ${event.approved ? 'ok' : 'error'}`}>{event.approved ? 'ok' : 'deny'}</span>
                <span className="mira-tool-line-name">approval</span>
                <span className="mira-tool-line-preview">{event.approved ? 'User approved the action' : 'User denied the action'}</span>
              </div>
            )
          }
          return null
        })}
      </div>
    )
  }

  function renderAnswerSegments(runId: string, answerSegments: AnswerSegment[], events: RunEvent[]) {
    const answerToolItems = buildToolDetailsItems(
      filterRunEventsByLocation(events, 'answer').filter((event) => event.kind === 'tool_execute' || event.kind === 'tool_result'),
    )
    const toolItems = new Map(answerToolItems.map((item) => [item.key, item]))
    const answerApprovalEntries: Array<
      readonly [string, Extract<RunEvent, { kind: 'approval_requested' | 'approval_resolved' }>]
    > = getApprovalEventsByLocation(events, 'answer').map((event) => [event.groupId ?? event.id, event] as const)
    const approvalByGroup = new Map(answerApprovalEntries)

    return (
      <div className="mira-answer-segments">
        {answerSegments.map((segment, index) => {
          if (segment.kind === 'text') {
            return (
              <div key={`${runId}:segment:text:${segment.id}:${index}`} className="mira-answer-segment-text">
                {segment.text}
              </div>
            )
          }
          if (segment.kind === 'tool') {
            const item = toolItems.get(segment.eventId)
            if (!item) return null
            const payload = item.resultPayload ?? item.executeArgs
            const preview = formatToolPayloadPreview(payload, { maxPreviewChars: 520 })
            const oneLine = preview.previewText.replace(/\s+/g, ' ').trim()
            const status = item.resultOk === undefined ? 'call' : item.resultOk ? 'ok' : 'error'
            return (
              <div key={`${runId}:segment:tool:${segment.id}:${index}`} className="mira-tool-lines inline">
                <div className="mira-tool-line">
                  <span className={`mira-tool-line-badge ${status}`}>{status}</span>
                  <span className="mira-tool-line-name">{item.name}</span>
                  {oneLine ? <span className="mira-tool-line-preview">{oneLine}</span> : null}
                </div>
              </div>
            )
          }
          const approval = approvalByGroup.get(segment.eventId)
          if (!approval) return null
          if (approval.kind === 'approval_requested') {
            const toolCallId = approval.groupId ?? approval.id
            const uiState = approvalUiStates[runId]?.[toolCallId] ?? { status: 'pending' }
            const interactive = isApprovalInteractive(uiState)
            return (
              <div key={`${runId}:segment:approval:${segment.id}:${index}`} className="mira-tool-lines inline">
                <div className="mira-approval-line">
                  <span className="mira-tool-line-badge ask">ask</span>
                  <span className="mira-tool-line-name">{approval.name}</span>
                  <span className="mira-tool-line-preview">{approval.summary}</span>
                  <span className="mira-approval-reason">{approval.reason}</span>
                  <span className="mira-approval-label">{getApprovalStatusText(uiState)}</span>
                  {interactive ? (
                    <>
                      <span className="mira-approval-actions">
                        <button type="button" className="mira-approval-btn allow" onClick={() => handleApprovalDecision(runId, true)}>
                          允许执行
                        </button>
                        <button type="button" className="mira-approval-btn deny" onClick={() => handleApprovalDecision(runId, false)}>
                          拒绝执行
                        </button>
                      </span>
                    </>
                  ) : null}
                </div>
              </div>
            )
          }
          if (approval.kind === 'approval_resolved') {
            return (
              <div key={`${runId}:segment:approval:${segment.id}:${index}`} className="mira-tool-lines inline">
                <div className="mira-tool-line">
                  <span className={`mira-tool-line-badge ${approval.approved ? 'ok' : 'error'}`}>{approval.approved ? 'ok' : 'deny'}</span>
                  <span className="mira-tool-line-name">approval</span>
                  <span className="mira-tool-line-preview">{approval.approved ? 'User approved the action' : 'User denied the action'}</span>
                </div>
              </div>
            )
          }
          return null
        })}
      </div>
    )
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
            {chats.map((c) => (
              <button
                type="button"
                key={c.id}
                className={`mira-chat-item ${c.id === selectedChatId ? 'selected' : ''}`}
                onClick={() => {
                  setSelectedChatId(c.id)
                  setDrawerOpen(false)
                }}
                role="listitem"
              >
                {c.title}
              </button>
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
            <button type="button" className="mira-icon-btn" onClick={() => setShowModelSettings(true)} aria-label="Settings">
              ⚙
            </button>
          </div>
        </div>

        <div ref={threadRef} className="mira-thread">
          <div className="mira-thread-header">
            <div className="mira-thread-meta-row">
              <button
                type="button"
                className="mira-thread-meta-item mira-chip-clickable"
                onClick={() => void handlePickWorkspace()}
                data-tooltip={workspaceTooltip}
              >
                <span className="mira-thread-meta-label">Workspace</span>
                <span className="mira-thread-meta-value mira-mono">{formattedWorkspace}</span>
              </button>
              <div className="mira-thread-meta-item">
                <span className="mira-thread-meta-label">MiniMax</span>
                <span className="mira-thread-meta-value">{configured ? '已配置' : '未配置'}</span>
              </div>
            </div>
          </div>
          {errorMessage ? <div className="mira-banner error">{errorMessage}</div> : null}

          <div className="mira-messages">
            {selectedThread.map((m) => (
              m.kind === 'run' ? (
                <div key={m.id} className={`mira-run ${m.status}`}>
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
                        {renderToolDetails(m.id, m.events, 'thinking')}
                        {renderApprovalDetails(m.id, m.events, 'thinking')}
                      </div>
                    </details>
                  ) : null}

                  {m.finalText || pendingApprovals[m.id] ? (
                    <div className="mira-msg assistant">
                      <div className="mira-msg-body">
                        {m.mode === 'normal' && m.answerSegments.length > 0
                          ? renderAnswerSegments(m.id, m.answerSegments, m.events)
                          : (
                              <>
                                {m.finalText}
                                {m.mode === 'normal' ? renderApprovalDetails(m.id, m.events, 'answer') : null}
                                {m.mode === 'normal' ? renderToolDetails(m.id, m.events, 'answer') : null}
                              </>
                            )}
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : (
                <div key={m.id} data-thread-message-id={m.id} className={`mira-msg ${m.kind === 'user' ? 'you' : 'assistant'}`}>
                  <div className="mira-msg-meta">
                    <span>{m.kind === 'user' ? 'You' : 'circleloop'}</span>
                    <span className="mira-mono">{m.time}</span>
                  </div>
                  <div className="mira-msg-body">{m.text}</div>
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
                    ■
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
