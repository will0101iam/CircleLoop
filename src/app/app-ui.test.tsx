import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import App from '../App'

describe('Mira UI', () => {
  it('renders mira shell', () => {
    render(<App />)

    expect(screen.getAllByText('circleloop').length).toBeGreaterThan(0)
    expect(screen.getByRole('button', { name: 'New Chat' })).toBeInTheDocument()
    expect(screen.getByText('Task')).toBeInTheDocument()
    expect(screen.getByText('Customize')).toBeInTheDocument()
    expect(screen.getByText('Recents')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'Settings' }).length).toBeGreaterThan(0)
    expect(screen.getByRole('button', { name: 'Send' })).toBeDisabled()
    expect(screen.getByPlaceholderText(/Ask anything/)).toBeInTheDocument()
    expect(screen.queryByText('你可以在下方输入任务并点击 Send/Run。')).not.toBeInTheDocument()
  })

  it('uses explicit approval action labels when confirmation is required', () => {
    render(<App />)

    expect(screen.queryByRole('button', { name: 'Allow' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Deny' })).not.toBeInTheDocument()
  })
})
