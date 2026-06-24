import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from '../App'
import type { RunThreadMessage, ThreadMessage } from './runMessages'

describe('Mira UI', () => {
  afterEach(() => cleanup())

  it('renders mira shell', () => {
    render(<App />)

    expect(screen.getAllByText('circleloop').length).toBeGreaterThan(0)
    expect(screen.getAllByRole('button', { name: 'New Chat' }).length).toBeGreaterThan(0)
    expect(screen.getByText('Task')).toBeInTheDocument()
    expect(screen.queryByText('Customize')).not.toBeInTheDocument()
    expect(screen.getByText('Recents')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: '设置' })).toHaveLength(1)
    expect(screen.getByRole('button', { name: 'Branch' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Workspace' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Send' })).toBeDisabled()
    expect(screen.getByPlaceholderText(/Ask anything/)).toBeInTheDocument()
    expect(screen.queryByText('你可以在下方输入任务并点击 Send/Run。')).not.toBeInTheDocument()
  })

  it('shows a composer model chip and grouped provider options from global config', () => {
    render(
      <App
        __testInitialState={
          {
            chats: [{ id: 'c1', title: 'Chat 1', workspacePath: null, llmProvider: 'openrouter', llmModel: 'gpt-4o-mini' }],
            selectedChatId: 'c1',
            chatMessages: { c1: [] },
            disableAutoRuntime: true,
            configStatus: {
              configured: true,
              configPath: '/tmp/config.json',
              provider: 'openrouter',
              baseUrl: 'https://openrouter.ai/api/v1',
              model: 'gpt-4o-mini',
              defaults: { provider: 'openrouter', model: 'gpt-4o-mini' },
              providers: {
                minimax: {
                  label: 'MiniMax',
                  baseUrl: 'https://api.minimaxi.com/v1',
                  apiKey: 'mini',
                  models: ['MiniMax-M2.7'],
                  defaultModel: 'MiniMax-M2.7',
                },
                openrouter: {
                  label: 'OpenRouter',
                  baseUrl: 'https://openrouter.ai/api/v1',
                  apiKey: 'or',
                  models: ['gpt-4o-mini', 'deepseek-chat'],
                  defaultModel: 'gpt-4o-mini',
                },
                ollama: {
                  label: 'Ollama',
                  baseUrl: 'http://localhost:11434/v1',
                  apiKey: null,
                  models: [],
                  defaultModel: null,
                },
              },
              getApiKey: (providerId?: string | null) => (providerId === 'ollama' ? null : 'secret'),
            },
          } as any
        }
      />,
    )

    expect(screen.getByRole('button', { name: 'gpt-4o-mini' })).toBeInTheDocument()
    expect(screen.queryByText('Deep Research')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Deep Research' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'gpt-4o-mini' }))

    expect(screen.getByText('MiniMax')).toBeInTheDocument()
    expect(screen.getByText('OpenRouter')).toBeInTheDocument()
    expect(screen.queryByText('Ollama')).not.toBeInTheDocument()
    expect(screen.queryByText('未配置 models')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'deepseek-chat' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'llama3.1' })).not.toBeInTheDocument()
  })

  it('renders settings center, keeps libraries out of the sidebar, and exposes provider setup', () => {
    render(
      <App
        __testInitialState={
          {
            chats: [{ id: 'c1', title: 'Chat 1', workspacePath: null, llmProvider: 'openrouter', llmModel: 'gpt-4o-mini' }],
            selectedChatId: 'c1',
            chatMessages: { c1: [] },
            disableAutoRuntime: true,
            configStatus: {
              configured: true,
              configPath: '/tmp/config.json',
              provider: 'openrouter',
              baseUrl: 'https://openrouter.ai/api/v1',
              model: 'gpt-4o-mini',
              defaults: { provider: 'openrouter', model: 'gpt-4o-mini' },
              providers: {
                minimax: {
                  label: 'MiniMax',
                  baseUrl: 'https://api.minimaxi.com/v1',
                  apiKey: 'mini',
                  models: ['MiniMax-M2.7'],
                  defaultModel: 'MiniMax-M2.7',
                },
                openrouter: {
                  label: 'OpenRouter',
                  baseUrl: 'https://openrouter.ai/api/v1',
                  apiKey: 'or',
                  models: ['gpt-4o-mini', 'deepseek-chat'],
                  defaultModel: 'gpt-4o-mini',
                },
                ollama: {
                  label: 'Ollama',
                  baseUrl: 'http://localhost:11434/v1',
                  apiKey: null,
                  models: [],
                  defaultModel: null,
                },
                custom: {
                  label: 'Custom OpenAI-Compatible',
                  baseUrl: '',
                  apiKey: null,
                  models: [],
                  defaultModel: null,
                },
              },
              getApiKey: () => 'secret',
            },
          } as any
        }
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'gpt-4o-mini' }))
    fireEvent.click(screen.getByRole('button', { name: 'deepseek-chat' }))
    expect(screen.getByRole('button', { name: 'deepseek-chat' })).toBeInTheDocument()

    expect(screen.queryByRole('button', { name: 'Skills' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'MCP' })).not.toBeInTheDocument()

    expect(screen.queryByText('bytedance')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Status' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'History' })).not.toBeInTheDocument()
    const settingsButton = screen.getByRole('button', { name: '设置' })
    expect(settingsButton).toHaveClass('mira-settings-entry')
    fireEvent.click(settingsButton)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '设置' })).toBeInTheDocument()
    expect(screen.getByText('管理 CircleLoop 和 Claude Code 设置')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '服务商' })).toHaveClass('active')
    expect(screen.getByRole('button', { name: 'Skills' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'MCP' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '模型与渠道' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'CLI 工具' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '素材库' })).not.toBeInTheDocument()
    expect(screen.queryByText(/配置将保存到/)).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: '连接诊断' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '运行诊断' })).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '默认模型' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '已连接的提供商' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '添加提供商' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: '会话里的实际效果' })).not.toBeInTheDocument()
    expect(screen.getByTestId('provider-icon-openrouter')).toBeInTheDocument()
    expect(screen.getByTestId('provider-icon-minimax')).toBeInTheDocument()
    expect(screen.getByTestId('provider-icon-ollama')).toBeInTheDocument()
    const providerHeadings = screen.getAllByRole('heading').map((heading) => heading.textContent)
    expect(providerHeadings.indexOf('默认模型')).toBeLessThan(providerHeadings.indexOf('已连接的提供商'))
    expect(providerHeadings.indexOf('已连接的提供商')).toBeLessThan(providerHeadings.indexOf('添加提供商'))
    expect(screen.queryByText(/当前：/)).not.toBeInTheDocument()
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: '默认模型 gpt-4o-mini' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '默认模型 gpt-4o-mini' }))
    expect(screen.getByRole('listbox', { name: '默认模型' })).toBeInTheDocument()
    expect(within(screen.getByRole('listbox', { name: '默认模型' })).getByText('OpenRouter')).toBeInTheDocument()
    expect(within(screen.getByRole('listbox', { name: '默认模型' })).getByRole('option', { name: 'deepseek-chat' })).toBeInTheDocument()
    fireEvent.click(within(screen.getByRole('listbox', { name: '默认模型' })).getByRole('option', { name: 'deepseek-chat' }))
    expect(screen.getByRole('button', { name: '默认模型 deepseek-chat' })).toBeInTheDocument()
    expect(screen.getAllByText('OpenRouter').length).toBeGreaterThan(0)
    expect(screen.getAllByText('通过 OpenRouter 访问多种模型').length).toBeGreaterThan(0)
    expect(screen.getByRole('button', { name: '编辑 OpenRouter' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '删除配置 OpenRouter' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '保存' })).not.toBeInTheDocument()
    const codepilotChatProviders = [
      'Anthropic',
      'Anthropic Third-party API',
      'OpenRouter',
      'DeepSeek',
      'GLM (CN)',
      'GLM (Global)',
      'Kimi Coding Plan',
      'Moonshot',
      'MiniMax (CN)',
      'MiniMax (Global)',
      'Volcengine Ark',
      'Xiaomi MiMo',
      'Xiaomi MiMo Token Plan',
      'Aliyun Bailian',
      'AWS Bedrock',
      'Google Vertex',
      'Ollama',
      'LiteLLM',
    ]
    for (const providerName of codepilotChatProviders) {
      expect(screen.getAllByText(providerName).length).toBeGreaterThan(0)
    }
    expect(screen.getAllByText('暂不可用').length).toBe(4)
    expect(screen.getAllByText('Anthropic 官方 API').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Amazon Bedrock — 需要 AWS 凭证').length).toBeGreaterThan(0)
    for (const providerName of ['Anthropic', 'Anthropic Third-party API', 'AWS Bedrock', 'Google Vertex']) {
      expect(screen.queryByRole('button', { name: `连接 ${providerName}` })).not.toBeInTheDocument()
    }
    for (const providerName of [
      'DeepSeek',
      'GLM (CN)',
      'GLM (Global)',
      'Kimi Coding Plan',
      'Moonshot',
      'MiniMax (CN)',
      'MiniMax (Global)',
      'Volcengine Ark',
      'Xiaomi MiMo',
      'Xiaomi MiMo Token Plan',
      'Aliyun Bailian',
    ]) {
      expect(screen.getByRole('button', { name: `连接 ${providerName}` })).toBeInTheDocument()
    }
    expect(screen.getByRole('button', { name: '连接 Ollama' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '连接 LiteLLM' })).toBeInTheDocument()
    expect(screen.queryByText('已连接')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '连接 Ollama' }))
    const ollamaDialog = screen.getByRole('dialog', { name: '连接 Ollama' })
    expect(within(ollamaDialog).getByTestId('provider-icon-ollama')).toBeInTheDocument()
    expect(within(ollamaDialog).getByText('Ollama — 本地运行模型，Anthropic 兼容 API')).toBeInTheDocument()
    expect(screen.getByDisplayValue('http://localhost:11434/v1')).toBeInTheDocument()
    expect(within(ollamaDialog).getByRole('button', { name: '取消' })).toBeInTheDocument()
    expect(within(ollamaDialog).getByRole('button', { name: '测试连接' })).toBeInTheDocument()
    expect(within(ollamaDialog).queryByText('API Key')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Chat 1' }))
    expect(screen.queryByRole('heading', { name: '设置' })).not.toBeInTheDocument()
    expect(screen.getByPlaceholderText(/Ask anything/)).toBeInTheDocument()
  })

  it('shows API Key only for cloud providers in the editor', () => {
    render(
      <App
        __testInitialState={
          {
            chats: [{ id: 'c1', title: 'Chat 1', workspacePath: null }],
            selectedChatId: 'c1',
            chatMessages: { c1: [] },
            disableAutoRuntime: true,
            configStatus: {
              configured: true,
              configPath: '/tmp/config.json',
              provider: 'openrouter',
              baseUrl: 'https://openrouter.ai/api/v1',
              model: 'gpt-4o-mini',
              defaults: { provider: 'openrouter', model: 'gpt-4o-mini' },
              providers: {
                openrouter: {
                  label: 'OpenRouter',
                  baseUrl: 'https://openrouter.ai/api/v1',
                  apiKey: 'or',
                  models: ['gpt-4o-mini'],
                  defaultModel: 'gpt-4o-mini',
                },
                ollama: {
                  label: 'Ollama',
                  baseUrl: 'http://localhost:11434/v1',
                  apiKey: null,
                  models: ['llama3.1'],
                  defaultModel: 'llama3.1',
                },
              },
              getApiKey: () => 'secret',
            },
          } as any
        }
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: '设置' }))
    fireEvent.click(screen.getByRole('button', { name: '编辑 OpenRouter' }))
    expect(screen.getByRole('dialog', { name: '编辑 OpenRouter' })).toBeInTheDocument()
    expect(within(screen.getByRole('dialog')).getByText('通过 OpenRouter 访问多种模型')).toBeInTheDocument()
    expect(within(screen.getByRole('dialog')).getByText('API Key')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '取消' }))

    fireEvent.click(screen.getByRole('button', { name: '编辑 Ollama' }))
    expect(screen.getByRole('dialog', { name: '编辑 Ollama' })).toBeInTheDocument()
    expect(within(screen.getByRole('dialog')).queryByText('API Key')).not.toBeInTheDocument()
  })

  it('uses compact add-provider rows instead of a floating add menu', () => {
    render(
      <App
        __testInitialState={
          {
            chats: [{ id: 'c1', title: 'Chat 1', workspacePath: null }],
            selectedChatId: 'c1',
            chatMessages: { c1: [] },
            disableAutoRuntime: true,
            configStatus: {
              configured: true,
              configPath: '/tmp/config.json',
              provider: 'openrouter',
              baseUrl: 'https://openrouter.ai/api/v1',
              model: 'gpt-4o-mini',
              defaults: { provider: 'openrouter', model: 'gpt-4o-mini' },
              providers: {
                openrouter: {
                  label: 'OpenRouter',
                  baseUrl: 'https://openrouter.ai/api/v1',
                  apiKey: 'or',
                  models: ['gpt-4o-mini'],
                  defaultModel: 'gpt-4o-mini',
                },
                ollama: {
                  label: 'Ollama',
                  baseUrl: 'http://localhost:11434/v1',
                  apiKey: null,
                  models: [],
                  defaultModel: null,
                },
              },
              getApiKey: () => 'secret',
            },
          } as any
        }
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: '设置' }))
    expect(screen.queryByTestId('settings-add-menu')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: '连接 Ollama' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '连接 Ollama' }))

    expect(screen.getByRole('dialog', { name: '连接 Ollama' })).toBeInTheDocument()
  })

  it('deletes provider configuration and moves it back to the add-provider list', () => {
    render(
      <App
        __testInitialState={
          {
            chats: [{ id: 'c1', title: 'Chat 1', workspacePath: null }],
            selectedChatId: 'c1',
            chatMessages: { c1: [] },
            disableAutoRuntime: true,
            configStatus: {
              configured: true,
              configPath: '/tmp/config.json',
              provider: 'openrouter',
              baseUrl: 'https://openrouter.ai/api/v1',
              model: 'gpt-4o-mini',
              defaults: { provider: 'openrouter', model: 'gpt-4o-mini' },
              providers: {
                openrouter: {
                  label: 'OpenRouter',
                  baseUrl: 'https://openrouter.ai/api/v1',
                  apiKey: 'or',
                  models: ['gpt-4o-mini'],
                  defaultModel: 'gpt-4o-mini',
                },
                minimax: {
                  label: 'MiniMax',
                  baseUrl: 'https://api.minimaxi.com/v1',
                  apiKey: 'mini',
                  models: ['MiniMax-M2.7'],
                  defaultModel: 'MiniMax-M2.7',
                },
              },
              getApiKey: () => 'secret',
            },
          } as any
        }
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: '设置' }))
    fireEvent.click(screen.getByRole('button', { name: '删除配置 OpenRouter' }))
    expect(screen.getByRole('dialog', { name: '删除配置 OpenRouter' })).toBeInTheDocument()
    expect(screen.getByText('删除后该提供商会回到添加提供商列表，已保存的连接信息会被清空。')).toBeInTheDocument()
    fireEvent.click(within(screen.getByRole('dialog', { name: '删除配置 OpenRouter' })).getByRole('button', { name: '删除配置' }))

    expect(screen.queryByRole('button', { name: '编辑 OpenRouter' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: '连接 OpenRouter' })).toBeInTheDocument()
  })

  it('supports pin ordering, rename sync, unpin reset, and delete from session row menu', () => {
    const promptSpy = vi.spyOn(window, 'prompt').mockReturnValue('Pinned Chat')

    render(
      <App
        __testInitialState={{
          chats: [
            { id: 'c1', title: 'Chat 1', workspacePath: null, pinnedAt: null, lastActivatedAt: 1 },
            { id: 'c2', title: 'Chat 2', workspacePath: null, pinnedAt: null, lastActivatedAt: 2 },
          ],
          selectedChatId: 'c1',
          chatMessages: { c1: [], c2: [] },
          disableAutoRuntime: true,
        }}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Session actions Chat 1' }))
    fireEvent.click(screen.getByRole('button', { name: 'Pin' }))

    const chatItemsAfterPin = screen.getAllByRole('listitem')
    expect(chatItemsAfterPin[0]).toHaveTextContent('Chat 1')
    expect(within(chatItemsAfterPin[0]).getByLabelText('Session actions Chat 1')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Session actions Chat 1' }))
    fireEvent.click(screen.getByRole('button', { name: 'Rename' }))
    expect(screen.getByRole('heading', { name: 'Pinned Chat' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Session actions Pinned Chat' }))
    fireEvent.click(screen.getByRole('button', { name: 'Pin' }))
    const chatItemsAfterUnpin = screen.getAllByRole('listitem')
    expect(chatItemsAfterUnpin[0]).toHaveTextContent('Pinned Chat')

    fireEvent.click(screen.getByRole('button', { name: 'Session actions Chat 2' }))
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
    expect(screen.queryByText('Chat 2')).not.toBeInTheDocument()

    promptSpy.mockRestore()
  })

  it('does not reorder unpinned sessions when simply selecting a session', () => {
    render(
      <App
        __testInitialState={{
          chats: [
            { id: 'c1', title: 'Older Chat', workspacePath: null, pinnedAt: null, lastActivatedAt: 1 },
            { id: 'c2', title: 'Newer Chat', workspacePath: null, pinnedAt: null, lastActivatedAt: 2 },
          ],
          selectedChatId: 'c2',
          chatMessages: { c1: [], c2: [] },
          disableAutoRuntime: true,
        }}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Older Chat' }))

    const chatItems = screen.getAllByRole('listitem')
    expect(chatItems[0]).toHaveTextContent('Newer Chat')
    expect(chatItems[1]).toHaveTextContent('Older Chat')
    expect(screen.getByRole('heading', { name: 'Older Chat' })).toBeInTheDocument()
  })

  it('uses explicit approval action labels when confirmation is required', () => {
    render(<App />)

    expect(screen.queryByRole('button', { name: 'Allow' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Deny' })).not.toBeInTheDocument()
  })

  it('copies user and assistant (run) message body as markdown', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.assign(navigator, { clipboard: { writeText } })

    const thread: ThreadMessage[] = [
      { id: 'u1', kind: 'user', text: '# Title\n\n**bold**', time: '10:00:00' },
      {
        id: 'r1',
        kind: 'run',
        time: '10:00:01',
        mode: 'normal',
        status: 'completed',
        thinkText: null,
        events: [],
        finalText: 'Hello **world**',
        answerSegments: [],
      } satisfies RunThreadMessage,
    ]

    render(
      <App
        __testInitialState={{
          chats: [{ id: 'c1', title: 'New Chat', workspacePath: null }],
          selectedChatId: 'c1',
          chatMessages: { c1: thread },
          disableAutoRuntime: true,
        }}
      />,
    )

    const userMsg = screen.getByTestId('thread-message-u1')
    fireEvent.click(within(userMsg).getByRole('button', { name: 'Copy' }))
    expect(writeText).toHaveBeenCalledWith('# Title\n\n**bold**')

    const runMsg = screen.getByTestId('thread-message-r1')
    fireEvent.click(within(runMsg).getByRole('button', { name: 'Copy' }))
    expect(writeText).toHaveBeenCalledWith('Hello **world**')
  })

  it('undo removes last user+run pair and restores user text into composer', () => {
    const thread: ThreadMessage[] = [
      { id: 'u1', kind: 'user', text: 'please do X', time: '10:00:00' },
      {
        id: 'r1',
        kind: 'run',
        time: '10:00:01',
        mode: 'normal',
        status: 'completed',
        thinkText: null,
        events: [],
        finalText: 'done',
        answerSegments: [],
      } satisfies RunThreadMessage,
    ]

    render(
      <App
        __testInitialState={{
          chats: [{ id: 'c1', title: 'New Chat', workspacePath: null }],
          selectedChatId: 'c1',
          chatMessages: { c1: thread },
          disableAutoRuntime: true,
        }}
      />,
    )

    const userMsg = screen.getByTestId('thread-message-u1')
    fireEvent.click(within(userMsg).getByRole('button', { name: 'Undo' }))

    expect(screen.queryByTestId('thread-message-u1')).not.toBeInTheDocument()
    expect(screen.queryByTestId('thread-message-r1')).not.toBeInTheDocument()
    expect(screen.queryByText('done')).not.toBeInTheDocument()
    expect(screen.getByPlaceholderText(/Ask anything/)).toHaveValue('please do X')
  })

  it('undo remains safe when rollback path is unavailable in test mode', () => {
    const thread: ThreadMessage[] = [
      { id: 'u1', kind: 'user', text: 'please undo safely', time: '10:00:00' },
      {
        id: 'r1',
        kind: 'run',
        time: '10:00:01',
        mode: 'normal',
        status: 'completed',
        thinkText: null,
        events: [],
        finalText: 'done',
        answerSegments: [],
      } satisfies RunThreadMessage,
    ]

    render(
      <App
        __testInitialState={{
          chats: [{ id: 'c1', title: 'New Chat', workspacePath: null }],
          selectedChatId: 'c1',
          chatMessages: { c1: thread },
          disableAutoRuntime: true,
        }}
      />,
    )

    fireEvent.click(within(screen.getByTestId('thread-message-u1')).getByRole('button', { name: 'Undo' }))

    expect(screen.queryByTestId('thread-message-u1')).not.toBeInTheDocument()
    expect(screen.queryByTestId('thread-message-r1')).not.toBeInTheDocument()
    expect(screen.getByPlaceholderText(/Ask anything/)).toHaveValue('please undo safely')
  })

  it('retry replaces the last run without duplicating user message', async () => {
    const thread: ThreadMessage[] = [
      { id: 'u1', kind: 'user', text: 'retry me', time: '10:00:00' },
      {
        id: 'r1',
        kind: 'run',
        time: '10:00:01',
        mode: 'normal',
        status: 'completed',
        thinkText: null,
        events: [],
        finalText: 'old answer',
        answerSegments: [],
      } satisfies RunThreadMessage,
    ]

    render(
      <App
        __testInitialState={{
          chats: [{ id: 'c1', title: 'New Chat', workspacePath: null }],
          selectedChatId: 'c1',
          chatMessages: { c1: thread },
          disableAutoRuntime: true,
        }}
      />,
    )

    const runMsg = screen.getByTestId('thread-message-r1')
    fireEvent.click(within(runMsg).getByRole('button', { name: 'Retry' }))

    expect(screen.getAllByText('retry me')).toHaveLength(1)
    expect(screen.queryByText('old answer')).not.toBeInTheDocument()
    expect(screen.getByText('Thinking...')).toBeInTheDocument()
  })

  it('scrolls the new run into view immediately after send', async () => {
    const scrollTo = vi.fn()
    Object.defineProperty(HTMLElement.prototype, 'scrollTo', {
      configurable: true,
      value: scrollTo,
    })

    render(
      <App
        __testInitialState={{
          chats: [{ id: 'c1', title: 'Chat 1', workspacePath: null }],
          selectedChatId: 'c1',
          chatMessages: { c1: [] },
          disableAutoRuntime: true,
        }}
      />,
    )

    fireEvent.change(screen.getByPlaceholderText(/Ask anything/), { target: { value: 'new task' } })
    fireEvent.click(screen.getByRole('button', { name: 'Send' }))

    await waitFor(() => expect(scrollTo).toHaveBeenCalled())
    expect(screen.getAllByTestId(/thread-message-/)).toHaveLength(2)
  })

  it('seeds a default task plan when sending a new run', async () => {
    render(
      <App
        __testInitialState={{
          chats: [{ id: 'c1', title: 'Chat 1', workspacePath: null }],
          selectedChatId: 'c1',
          chatMessages: { c1: [] },
          disableAutoRuntime: true,
        }}
      />,
    )

    fireEvent.change(screen.getByPlaceholderText(/Ask anything/), { target: { value: 'implement the task plan' } })
    fireEvent.click(screen.getByRole('button', { name: 'Send' }))

    await waitFor(() => expect(screen.getAllByTestId(/thread-message-/).length).toBeGreaterThan(0))
    const runMsg = screen.getAllByTestId(/thread-message-/).find((node) => node.classList.contains('mira-run'))
    expect(runMsg).toBeTruthy()
    expect(within(runMsg!).getByRole('heading', { name: '计划' })).toBeInTheDocument()
    expect(within(runMsg!).getByText('理解需求')).toBeInTheDocument()
    expect(within(runMsg!).getByText('收集上下文')).toBeInTheDocument()
    expect(within(runMsg!).getByText('执行任务')).toBeInTheDocument()
    expect(within(runMsg!).getByText('验证并总结')).toBeInTheDocument()
  })

  it('scrolls to a newly visible approval step even if ordinary run follow is already interrupted', async () => {
    const scrollTo = vi.fn()
    Object.defineProperty(HTMLElement.prototype, 'scrollTo', {
      configurable: true,
      value: scrollTo,
    })
    Object.defineProperty(HTMLElement.prototype, 'scrollHeight', {
      configurable: true,
      get() {
        return (this as HTMLElement).classList.contains('mira-thread') ? 1200 : 0
      },
    })
    Object.defineProperty(HTMLElement.prototype, 'clientHeight', {
      configurable: true,
      get() {
        return (this as HTMLElement).classList.contains('mira-thread') ? 400 : 0
      },
    })
    const getBoundingClientRect = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function () {
      const element = this as HTMLElement
      if (element.classList.contains('mira-thread')) {
        return { x: 0, y: 0, top: 0, left: 0, right: 400, bottom: 400, width: 400, height: 400, toJSON: () => ({}) } as DOMRect
      }
      if (element.classList.contains('mira-process-step')) {
        return { x: 0, y: 360, top: 360, left: 0, right: 400, bottom: 420, width: 400, height: 60, toJSON: () => ({}) } as DOMRect
      }
      return { x: 0, y: 0, top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0, toJSON: () => ({}) } as DOMRect
    })

    const thread: ThreadMessage[] = [
      { id: 'u1', kind: 'user', text: 'run command', time: '10:00:00' },
      {
        id: 'r1',
        kind: 'run',
        time: '10:00:01',
        mode: 'normal',
        status: 'waiting_approval',
        thinkText: 'thinking',
        events: [
          {
            id: 'tool-1-exec',
            kind: 'tool_execute',
            phase: 'thinking',
            anchor: 'thinking',
            name: 'execute_command',
            args: { command: 'date' },
            groupId: 'tool-1',
          },
          {
            id: 'tool-1-ask',
            kind: 'approval_requested',
            phase: 'thinking',
            anchor: 'thinking',
            name: 'execute_command',
            summary: 'Run execute_command',
            reason: 'Tool execute_command requires user confirmation',
            groupId: 'tool-1',
          },
        ],
        finalText: null,
        answerSegments: [],
      } satisfies RunThreadMessage,
    ]

    const { container } = render(
      <App
        __testInitialState={
          {
            chats: [{ id: 'c1', title: 'Chat 1', workspacePath: null }],
            selectedChatId: 'c1',
            chatMessages: { c1: thread },
            disableAutoRuntime: true,
            runningChatId: 'c1',
            activeRunId: 'r1',
            initialFollowState: {
              activeRunId: 'r1',
              interruptedRunId: 'r1',
            },
          } as any
        }
      />,
    )

    const threadEl = container.querySelector('.mira-thread') as HTMLDivElement
    Object.defineProperty(threadEl, 'scrollTop', {
      configurable: true,
      writable: true,
      value: 0,
    })

    await waitFor(() => expect(scrollTo).toHaveBeenCalled())
    getBoundingClientRect.mockRestore()
  })

  it('shows only user copy action while current run is still streaming', () => {
    const thread: ThreadMessage[] = [
      { id: 'u1', kind: 'user', text: 'retry me', time: '10:00:00' },
      {
        id: 'r1',
        kind: 'run',
        time: '10:00:01',
        mode: 'normal',
        status: 'pending',
        thinkText: null,
        events: [],
        finalText: null,
        answerSegments: [],
      } satisfies RunThreadMessage,
    ]

    render(
      <App
        __testInitialState={{
          chats: [{ id: 'c1', title: 'New Chat', workspacePath: null }],
          selectedChatId: 'c1',
          chatMessages: { c1: thread },
          disableAutoRuntime: true,
          runningChatId: 'c1',
        }}
      />,
    )

    const userMsg = screen.getByTestId('thread-message-u1')
    expect(within(userMsg).getByRole('button', { name: 'Copy' })).toBeInTheDocument()
    expect(within(userMsg).queryByRole('button', { name: 'Undo' })).not.toBeInTheDocument()

    const runMsg = screen.getByTestId('thread-message-r1')
    expect(within(runMsg).queryByRole('button', { name: 'Copy' })).not.toBeInTheDocument()
    expect(within(runMsg).queryByRole('button', { name: 'Retry' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Stop' })).toBeInTheDocument()
  })

  it('does not render assistant body or message icons before thinking completes even if finalText is present', () => {
    const thread: ThreadMessage[] = [
      { id: 'u1', kind: 'user', text: 'keep thinking', time: '10:00:00' },
      {
        id: 'r1',
        kind: 'run',
        time: '10:00:01',
        mode: 'normal',
        status: 'waiting_approval',
        thinkText: 'still thinking',
        events: [
          {
            id: 'tool-1-exec',
            kind: 'tool_execute',
            phase: 'thinking',
            name: 'write_file',
            args: { path: 'out.py' },
            groupId: 'tool-1',
          },
          {
            id: 'tool-1-ask',
            kind: 'approval_requested',
            phase: 'thinking',
            name: 'write_file',
            summary: 'Write out.py',
            reason: 'Tool write_file requires user confirmation',
            groupId: 'tool-1',
          },
        ],
        finalText: 'partial answer should stay hidden',
        answerSegments: [],
      } satisfies RunThreadMessage,
    ]

    render(
      <App
        __testInitialState={{
          chats: [{ id: 'c1', title: 'Chat 1', workspacePath: null }],
          selectedChatId: 'c1',
          chatMessages: { c1: thread },
          disableAutoRuntime: true,
        }}
      />,
    )

    const runMsg = screen.getByTestId('thread-message-r1')
    expect(within(runMsg).queryByText('partial answer should stay hidden')).not.toBeInTheDocument()
    expect(within(runMsg).queryByRole('button', { name: 'Copy' })).not.toBeInTheDocument()
    expect(within(runMsg).queryByRole('button', { name: 'Retry' })).not.toBeInTheDocument()
    expect(within(runMsg).queryByRole('button', { name: 'Branch' })).not.toBeInTheDocument()
  })

  it('renders plan events as a stable checklist before process steps', () => {
    const thread: ThreadMessage[] = [
      { id: 'u1', kind: 'user', text: 'change code', time: '10:00:00' },
      {
        id: 'r1',
        kind: 'run',
        time: '10:00:01',
        mode: 'normal',
        status: 'waiting_approval',
        thinkText: 'thinking',
        events: [
          {
            id: 'plan-1',
            kind: 'plan_created',
            phase: 'thinking',
            steps: [
              { id: 'understand', title: '理解需求', status: 'pending' },
              { id: 'context', title: '收集上下文', status: 'pending' },
              { id: 'execute', title: '执行任务', status: 'pending' },
            ],
          },
          { id: 'plan-2', kind: 'plan_step_completed', phase: 'thinking', stepId: 'understand', summary: '已确认范围' },
          { id: 'plan-3', kind: 'plan_step_started', phase: 'thinking', stepId: 'context' },
          {
            id: 'tool-1-exec',
            kind: 'tool_execute',
            phase: 'thinking',
            name: 'read_file',
            args: { path: 'src/App.tsx' },
            groupId: 'tool-1',
          },
        ],
        finalText: null,
        answerSegments: [],
      } satisfies RunThreadMessage,
    ]

    render(
      <App
        __testInitialState={{
          chats: [{ id: 'c1', title: 'Chat 1', workspacePath: null }],
          selectedChatId: 'c1',
          chatMessages: { c1: thread },
          disableAutoRuntime: true,
        }}
      />,
    )

    const runMsg = screen.getByTestId('thread-message-r1')
    expect(within(runMsg).getByRole('heading', { name: '计划' })).toBeInTheDocument()
    expect(within(runMsg).getByText('理解需求')).toBeInTheDocument()
    expect(within(runMsg).getByText('已确认范围')).toBeInTheDocument()
    expect(within(runMsg).getByText('收集上下文')).toBeInTheDocument()
    expect(within(runMsg).getByText('进行中')).toBeInTheDocument()
    expect(within(runMsg).getByText('正在读取 src/App.tsx')).toBeInTheDocument()
    expect(runMsg.textContent?.indexOf('计划')).toBeLessThan(runMsg.textContent?.indexOf('正在读取 src/App.tsx') ?? Number.MAX_SAFE_INTEGER)
  })

  it('sanitizes raw think tags from completed assistant body', () => {
    const thread: ThreadMessage[] = [
      { id: 'u1', kind: 'user', text: 'show result', time: '10:00:00' },
      {
        id: 'r1',
        kind: 'run',
        time: '10:00:01',
        mode: 'normal',
        status: 'completed',
        thinkText: 'hidden plan',
        events: [],
        finalText: '<think>hidden plan</think>\nVisible answer',
        answerSegments: [],
      } satisfies RunThreadMessage,
    ]

    render(
      <App
        __testInitialState={{
          chats: [{ id: 'c1', title: 'Chat 1', workspacePath: null }],
          selectedChatId: 'c1',
          chatMessages: { c1: thread },
          disableAutoRuntime: true,
        }}
      />,
    )

    const runMsg = screen.getByTestId('thread-message-r1')
    const assistantBody = runMsg.querySelector('.mira-msg-body')
    expect(assistantBody?.textContent).toBe('Visible answer')
    expect(assistantBody?.textContent).not.toContain('<think>')
    expect(assistantBody?.textContent).not.toContain('</think>')
    expect(assistantBody?.textContent).not.toContain('hidden plan')
  })

  it('renders fenced code blocks as structured assistant output instead of raw backticks', () => {
    const thread: ThreadMessage[] = [
      { id: 'u1', kind: 'user', text: 'render code', time: '10:00:00' },
      {
        id: 'r1',
        kind: 'run',
        time: '10:00:01',
        mode: 'normal',
        status: 'completed',
        thinkText: null,
        events: [],
        finalText: '代码已保存。\n\n```python\nprint("hello")\n```\n\n你可以自己运行它。',
        answerSegments: [],
      } satisfies RunThreadMessage,
    ]

    render(
      <App
        __testInitialState={{
          chats: [{ id: 'c1', title: 'Chat 1', workspacePath: null }],
          selectedChatId: 'c1',
          chatMessages: { c1: thread },
          disableAutoRuntime: true,
        }}
      />,
    )

    const runMsg = screen.getByTestId('thread-message-r1')
    expect(within(runMsg).getByText('代码已保存。')).toBeInTheDocument()
    expect(within(runMsg).getByText('你可以自己运行它。')).toBeInTheDocument()
    expect(runMsg.querySelector('pre code')?.textContent).toContain('print("hello")')
    expect(within(runMsg).getByText('python')).toBeInTheDocument()
    expect(within(runMsg).getByRole('button', { name: 'Copy code' })).toBeInTheDocument()
    expect(within(runMsg).queryByText('```python')).not.toBeInTheDocument()
  })

  it('branch clones current conversation into a new chat and appears in assistant actions', () => {
    const thread: ThreadMessage[] = [
      { id: 'u1', kind: 'user', text: 'question', time: '10:00:00' },
      {
        id: 'r1',
        kind: 'run',
        time: '10:00:01',
        mode: 'normal',
        status: 'completed',
        thinkText: null,
        events: [],
        finalText: 'answer',
        answerSegments: [],
      } satisfies RunThreadMessage,
    ]

    render(
      <App
        __testInitialState={{
          chats: [{ id: 'c1', title: 'Chat 1', workspacePath: null }],
          selectedChatId: 'c1',
          chatMessages: { c1: thread },
          disableAutoRuntime: true,
        }}
      />,
    )

    expect(within(screen.getByTestId('thread-message-r1')).getByRole('button', { name: 'Branch' })).toBeInTheDocument()
    fireEvent.click(screen.getAllByRole('button', { name: 'Branch' })[0]!)

    expect(screen.getByRole('heading', { name: 'Branched Chat' })).toBeInTheDocument()
    expect(screen.getByText('question')).toBeInTheDocument()
    expect(screen.getByText('answer')).toBeInTheDocument()
  })

  it('renders approval actions for answer marker even if approval event anchor is thinking', () => {
    const thread: ThreadMessage[] = [
      { id: 'u1', kind: 'user', text: 'search driver', time: '10:00:00' },
      {
        id: 'r1',
        kind: 'run',
        time: '10:00:01',
        mode: 'normal',
        status: 'waiting_approval',
        thinkText: 'thinking',
        events: [
          {
            id: 'approval-1',
            kind: 'approval_requested',
            phase: 'thinking',
            anchor: 'thinking',
            name: 'search_code',
            summary: 'Search workspace',
            reason: 'Need local files',
            groupId: 'tool-1',
          },
        ],
        finalText: 'Need approval',
        answerSegments: [
          { id: 'seg-1', kind: 'text', text: 'Need approval' },
          { id: 'seg-2', kind: 'approval', eventId: 'tool-1' },
        ],
      } satisfies RunThreadMessage,
    ]

    render(
      <App
        __testInitialState={{
          chats: [{ id: 'c1', title: 'Chat 1', workspacePath: null }],
          selectedChatId: 'c1',
          chatMessages: { c1: thread },
          disableAutoRuntime: true,
        }}
      />,
    )

    expect(screen.getByRole('button', { name: '允许执行' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '拒绝执行' })).toBeInTheDocument()
  })

  it('renders a stable waiting-approval process step with actions in place', () => {
    const thread: ThreadMessage[] = [
      { id: 'u1', kind: 'user', text: 'get time', time: '10:00:00' },
      {
        id: 'r1',
        kind: 'run',
        time: '10:00:01',
        mode: 'normal',
        status: 'waiting_approval',
        thinkText: 'thinking',
        events: [
          {
            id: 'tool-1-exec',
            kind: 'tool_execute',
            phase: 'thinking',
            anchor: 'thinking',
            name: 'execute_command',
            args: { command: 'date' },
            groupId: 'tool-1',
          },
          {
            id: 'tool-1-ask',
            kind: 'approval_requested',
            phase: 'thinking',
            anchor: 'thinking',
            name: 'execute_command',
            summary: 'Run execute_command',
            reason: 'Tool execute_command requires user confirmation',
            groupId: 'tool-1',
          },
        ],
        finalText: 'Need approval',
        answerSegments: [],
      } satisfies RunThreadMessage,
    ]

    const { container } = render(
      <App
        __testInitialState={{
          chats: [{ id: 'c1', title: 'Chat 1', workspacePath: null }],
          selectedChatId: 'c1',
          chatMessages: { c1: thread },
          disableAutoRuntime: true,
        }}
      />,
    )

    const steps = Array.from(container.querySelectorAll('.mira-process-step'))
    expect(steps).toHaveLength(1)
    expect(steps[0]?.textContent).toContain('正在运行命令')
    expect(steps[0]?.textContent).toContain('Waiting for approval')
    expect(within(steps[0] as HTMLElement).getByRole('button', { name: '允许执行' })).toBeInTheDocument()
    expect(within(steps[0] as HTMLElement).getByRole('button', { name: '拒绝执行' })).toBeInTheDocument()
  })

  it('renders a completed process step once and keeps final answer separate from process rows', () => {
    const thread: ThreadMessage[] = [
      { id: 'u1', kind: 'user', text: 'get time', time: '10:00:00' },
      {
        id: 'r1',
        kind: 'run',
        time: '10:00:01',
        mode: 'normal',
        status: 'completed',
        thinkText: 'thinking',
        events: [
          {
            id: 'tool-1-exec',
            kind: 'tool_execute',
            phase: 'answer',
            anchor: 'answer',
            name: 'execute_command',
            args: { command: 'date' },
            groupId: 'tool-1',
          },
          {
            id: 'tool-1-ask',
            kind: 'approval_requested',
            phase: 'answer',
            anchor: 'answer',
            name: 'execute_command',
            summary: 'Run execute_command',
            reason: 'Tool execute_command requires user confirmation',
            groupId: 'tool-1',
          },
          {
            id: 'tool-1-resolved',
            kind: 'approval_resolved',
            phase: 'answer',
            anchor: 'answer',
            name: 'approval',
            approved: true,
            groupId: 'tool-1',
          },
          {
            id: 'tool-1-result',
            kind: 'tool_result',
            phase: 'answer',
            anchor: 'answer',
            name: 'execute_command',
            ok: true,
            payload: { ok: true, stdout: '13:32:01' },
            groupId: 'tool-1',
          },
        ],
        finalText: 'Done',
        answerSegments: [
          { id: 'seg-1', kind: 'text', text: 'Done' },
          { id: 'seg-2', kind: 'tool', eventId: 'tool-1' },
          { id: 'seg-3', kind: 'approval', eventId: 'tool-1' },
        ],
      } satisfies RunThreadMessage,
    ]

    const { container } = render(
      <App
        __testInitialState={{
          chats: [{ id: 'c1', title: 'Chat 1', workspacePath: null }],
          selectedChatId: 'c1',
          chatMessages: { c1: thread },
          disableAutoRuntime: true,
        }}
      />,
    )

    const steps = Array.from(container.querySelectorAll('.mira-process-step'))
    expect(steps).toHaveLength(1)
    expect(steps[0]?.textContent).toContain('正在运行命令')
    expect(steps[0]?.textContent).toContain('Done')
    expect(steps[0]?.textContent).toContain('13:32:01')
    expect(screen.queryByRole('button', { name: '允许执行' })).not.toBeInTheDocument()
    expect(container.querySelector('.mira-answer-segments')).not.toBeInTheDocument()
    const finalAnswerBody = screen.getByTestId('thread-message-r1').querySelector('.mira-msg-body')
    expect(finalAnswerBody?.textContent).toBe('Done')
  })

  it('keeps process steps in first-seen order even after later steps are approved and completed', () => {
    const thread: ThreadMessage[] = [
      { id: 'u1', kind: 'user', text: 'write files', time: '10:00:00' },
      {
        id: 'r1',
        kind: 'run',
        time: '10:00:01',
        mode: 'normal',
        status: 'waiting_approval',
        thinkText: 'thinking',
        events: [
          {
            id: 'group-a-exec',
            kind: 'tool_execute',
            phase: 'thinking',
            anchor: 'thinking',
            name: 'write_file',
            args: { path: 'a.js' },
            groupId: 'group-a',
          },
          {
            id: 'group-a-ask',
            kind: 'approval_requested',
            phase: 'thinking',
            anchor: 'thinking',
            name: 'write_file',
            summary: 'write_file: a.js',
            reason: 'Tool write_file requires user confirmation',
            groupId: 'group-a',
          },
          {
            id: 'group-b-exec',
            kind: 'tool_execute',
            phase: 'thinking',
            anchor: 'thinking',
            name: 'write_file',
            args: { path: 'b.py' },
            groupId: 'group-b',
          },
          {
            id: 'group-b-ask',
            kind: 'approval_requested',
            phase: 'thinking',
            anchor: 'thinking',
            name: 'write_file',
            summary: 'Select workspace folder',
            reason: 'This action requires a workspace',
            groupId: 'group-b',
          },
          {
            id: 'group-b-resolved',
            kind: 'approval_resolved',
            phase: 'thinking',
            anchor: 'thinking',
            name: 'approval',
            approved: true,
            groupId: 'group-b',
          },
          {
            id: 'group-b-result',
            kind: 'tool_result',
            phase: 'thinking',
            anchor: 'thinking',
            name: 'write_file',
            ok: true,
            payload: { ok: true, path: 'b.py' },
            groupId: 'group-b',
          },
          {
            id: 'group-c-exec',
            kind: 'tool_execute',
            phase: 'thinking',
            anchor: 'thinking',
            name: 'write_file',
            args: { path: 'c.ts' },
            groupId: 'group-c',
          },
          {
            id: 'group-c-ask',
            kind: 'approval_requested',
            phase: 'thinking',
            anchor: 'thinking',
            name: 'write_file',
            summary: 'write_file: c.ts',
            reason: 'Tool write_file requires user confirmation',
            groupId: 'group-c',
          },
          {
            id: 'group-c-resolved',
            kind: 'approval_resolved',
            phase: 'thinking',
            anchor: 'thinking',
            name: 'approval',
            approved: true,
            groupId: 'group-c',
          },
          {
            id: 'group-c-result',
            kind: 'tool_result',
            phase: 'thinking',
            anchor: 'thinking',
            name: 'write_file',
            ok: true,
            payload: { ok: true, path: 'c.ts' },
            groupId: 'group-c',
          },
        ],
        finalText: 'Need approval',
        answerSegments: [],
      } satisfies RunThreadMessage,
    ]

    const { container } = render(
      <App
        __testInitialState={{
          chats: [{ id: 'c1', title: 'Chat 1', workspacePath: null }],
          selectedChatId: 'c1',
          chatMessages: { c1: thread },
          disableAutoRuntime: true,
        }}
      />,
    )

    const steps = Array.from(container.querySelectorAll('.mira-process-step'))
    const texts = steps.map((node) => node.textContent ?? '')

    expect(texts).toHaveLength(3)
    expect(texts[0]).toContain('正在写入 a.js')
    expect(texts[1]).toContain('正在确认工作区')
    expect(texts[2]).toContain('正在写入 c.ts')
  })
})
