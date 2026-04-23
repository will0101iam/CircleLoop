import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import App from '../App'

describe('App shell', () => {
  it('renders workspace button in topbar instead of old thread meta row', () => {
    render(<App />)

    expect(screen.getByRole('button', { name: 'Workspace' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Branch' })).toBeInTheDocument()
    expect(screen.getByText('选择工作区')).toBeInTheDocument()
    expect(screen.queryByText('MiniMax')).not.toBeInTheDocument()
    expect(screen.queryByText('Workspace')).not.toBeInTheDocument()
  })
})
