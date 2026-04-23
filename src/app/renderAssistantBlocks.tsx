import { useState, type ReactNode } from 'react'

type AssistantBlock =
  | { kind: 'paragraph'; text: string }
  | { kind: 'list'; items: string[] }
  | { kind: 'code'; language: string | null; code: string }

function flushParagraph(buffer: string[], blocks: AssistantBlock[]) {
  const text = buffer.join('\n').trim()
  if (text) blocks.push({ kind: 'paragraph', text })
  buffer.length = 0
}

function flushList(buffer: string[], blocks: AssistantBlock[]) {
  if (buffer.length > 0) blocks.push({ kind: 'list', items: [...buffer] })
  buffer.length = 0
}

export function parseAssistantBlocks(input: string): AssistantBlock[] {
  const text = typeof input === 'string' ? input.replace(/\r\n/g, '\n') : ''
  const lines = text.split('\n')
  const blocks: AssistantBlock[] = []
  const paragraphBuffer: string[] = []
  const listBuffer: string[] = []
  let inCode = false
  let codeLanguage: string | null = null
  let codeBuffer: string[] = []

  for (const line of lines) {
    const fenceMatch = line.match(/^```([\w-]+)?\s*$/)
    if (fenceMatch) {
      flushParagraph(paragraphBuffer, blocks)
      flushList(listBuffer, blocks)
      if (!inCode) {
        inCode = true
        codeLanguage = fenceMatch[1] ?? null
        codeBuffer = []
      } else {
        blocks.push({ kind: 'code', language: codeLanguage, code: codeBuffer.join('\n') })
        inCode = false
        codeLanguage = null
        codeBuffer = []
      }
      continue
    }

    if (inCode) {
      codeBuffer.push(line)
      continue
    }

    const listMatch = line.match(/^\s*[-*]\s+(.*)$/)
    if (listMatch) {
      flushParagraph(paragraphBuffer, blocks)
      listBuffer.push(listMatch[1] ?? '')
      continue
    }

    if (!line.trim()) {
      flushParagraph(paragraphBuffer, blocks)
      flushList(listBuffer, blocks)
      continue
    }

    flushList(listBuffer, blocks)
    paragraphBuffer.push(line)
  }

  if (inCode) {
    blocks.push({ kind: 'code', language: codeLanguage, code: codeBuffer.join('\n') })
  }
  flushParagraph(paragraphBuffer, blocks)
  flushList(listBuffer, blocks)

  return blocks
}

export function renderAssistantBlocks(text: string): ReactNode {
  const blocks = parseAssistantBlocks(text)
  if (blocks.length === 0) return text

  return blocks.map((block, index) => {
    if (block.kind === 'paragraph') {
      return (
        <p key={`assistant-paragraph-${index}`} className="mira-assistant-paragraph">
          {block.text}
        </p>
      )
    }
    if (block.kind === 'list') {
      return (
        <ul key={`assistant-list-${index}`} className="mira-assistant-list">
          {block.items.map((item, itemIndex) => (
            <li key={`assistant-list-item-${index}-${itemIndex}`}>{item}</li>
          ))}
        </ul>
      )
    }
    return <AssistantCodeBlock key={`assistant-code-${index}`} language={block.language} code={block.code} />
  })
}

function AssistantCodeBlock(props: { language: string | null; code: string }) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    const value = props.code
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value)
    } else {
      const textarea = document.createElement('textarea')
      textarea.value = value
      textarea.style.position = 'fixed'
      textarea.style.opacity = '0'
      document.body.appendChild(textarea)
      textarea.focus()
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
    }
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1200)
  }

  return (
    <div className="mira-assistant-codeblock">
      <div className="mira-assistant-codeblock-toolbar">
        <div className="mira-assistant-codeblock-label">{props.language ?? 'text'}</div>
        <button type="button" className="mira-assistant-codeblock-copy" onClick={() => void handleCopy()}>
          {copied ? 'Copied' : 'Copy code'}
        </button>
      </div>
      <pre>
        <code>{props.code}</code>
      </pre>
    </div>
  )
}
