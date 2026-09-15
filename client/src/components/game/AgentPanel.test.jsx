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
    fireEvent.click(screen.getByText('高级：本地 MCP / HTTP 凭证'))
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

it('pairs without saving the code and offers all three client configurations', async () => {
  const pending = { ...state, self: { role: 'player', agent: { status: 'pending', expiresAt: 999999 } } }
  const command = vi.fn().mockResolvedValue({ ok: true, pairingCode: 'ABCD-1234-ABCD-5678', pairingExpiresAt: 300000, snapshot: pending })
  const { rerender } = render(<AgentPanel gameState={state} onCommand={command} />)
  fireEvent.click(screen.getByRole('button', { name: 'Agent 托管' }))
  fireEvent.click(screen.getByText('① 首次连接：添加牌桌工具'))
  fireEvent.change(screen.getByLabelText('使用的客户端'), { target: { value: 'claude' } })
  expect(screen.getByText(/claude mcp add --transport http/)).toBeVisible()
  fireEvent.change(screen.getByLabelText('使用的客户端'), { target: { value: 'deepseek' } })
  expect(screen.getByText(/transport: streamable-http/)).toBeVisible()
  fireEvent.click(screen.getByRole('button', { name: '生成配对码' }))
  await waitFor(() => expect(command).toHaveBeenCalledWith('createAgentPairing'))
  rerender(<AgentPanel gameState={pending} onCommand={command} />)
  await waitFor(() => expect(screen.getByLabelText('一次性配对码')).toHaveValue('ABCD-1234-ABCD-5678'))
  fireEvent.keyDown(window, { key: 'Escape' })
  fireEvent.click(screen.getByRole('button', { name: 'Agent 托管' }))
  expect(screen.queryByLabelText('一次性配对码')).not.toBeInTheDocument()
})
