import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { parseAssistantBlocks, renderAssistantBlocks } from './renderAssistantBlocks'

describe('renderAssistantBlocks', () => {
  it('parses paragraphs, lists, and fenced code blocks', () => {
    const blocks = parseAssistantBlocks('intro\n\n- one\n- two\n\n```ts\nconst x = 1\n```\n\noutro')

    expect(blocks).toEqual([
      { kind: 'paragraph', text: 'intro' },
      { kind: 'list', items: ['one', 'two'] },
      { kind: 'code', language: 'ts', code: 'const x = 1' },
      { kind: 'paragraph', text: 'outro' },
    ])
  })

  it('renders code blocks without raw fences', () => {
    render(<div>{renderAssistantBlocks('```python\nprint("hello")\n```')}</div>)

    expect(screen.getByText('python')).toBeInTheDocument()
    expect(screen.getByText('print("hello")')).toBeInTheDocument()
    expect(screen.queryByText('```python')).not.toBeInTheDocument()
  })
})
