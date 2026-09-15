import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import AgentPanel from './AgentPanel'
const state = { roomId: 'r', agentEnabled: true, phase: 'LOBBY', self: { role: 'player', agent: { status: 'none' } } }
describe('Agent 托管面板', () => {
  it('feature is hidden for disabled, spectators and training', () => {
    const { rerender } = render(<AgentPanel gameState={{ ...state, agentEnabled: false }} />)
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
    rerender(<AgentPanel gameState={{ ...state, mode: 'training' }} />)
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
    rerender(<AgentPanel gameState={{ ...state, self: { role: 'spectator' } }} />)
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })
  it('shows one-time credential and clears it when panel closes', async () => {
    const pending = { ...state, self: { role: 'player', agent: { status: 'pending', expiresAt: 42 } } }
    const command = vi.fn().mockResolvedValue({ ok: true, agentToken: 'secret-test', snapshot: pending })
    const { rerender } = render(<AgentPanel gameState={state} onCommand={command} />)
    fireEvent.click(screen.getByRole('button', { name: 'Agent 托管' }))
    fireEvent.click(screen.getByRole('button', { name: '生成授权' }))
    await waitFor(() => expect(command).toHaveBeenCalledWith('createAgentGrant'))
    rerender(<AgentPanel gameState={pending} onCommand={command} />)
    await waitFor(() => expect(screen.getByLabelText('Agent 凭证')).toHaveValue('secret-test'))
    fireEvent.keyDown(window, { key: 'Escape' })
    fireEvent.click(screen.getByRole('button', { name: 'Agent 托管' }))
    expect(screen.queryByLabelText('Agent 凭证')).not.toBeInTheDocument()
  })
  it('reclaims control directly without another confirmation', async () => {
    const command = vi.fn().mockResolvedValue({ ok: true })
    render(<AgentPanel gameState={{ ...state, self: { role: 'player', agent: { status: 'controlled', online: true } } }} onCommand={command} />)
    fireEvent.click(screen.getByRole('button', { name: '接回操作' }))
    await waitFor(() => expect(command).toHaveBeenCalledWith('reclaimControl'))
  })
})
