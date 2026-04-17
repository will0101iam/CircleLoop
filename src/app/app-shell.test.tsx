import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import App from '../App'

describe('App shell', () => {
  it('renders compact unbound workspace text and minimax label', () => {
    render(<App />)

    expect(screen.getByText('Workspace')).toBeInTheDocument()
    expect(screen.getByText('未绑定')).toBeInTheDocument()
    expect(screen.queryByText('当前尚未选择工作区')).not.toBeInTheDocument()
    expect(screen.getByText('MiniMax')).toBeInTheDocument()
  })
})
