import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { SocketContext } from '../contexts/socket-context'
import { createPreviewValue } from '../dev/previewFixtures'
import LobbyScreen from './LobbyScreen'

function renderLobby(state = 'lobby-host', overrides = {}) {
  const context = createPreviewValue(state)
  const props = {
    room: context.room,
    gameState: context.gameState,
    currentUserId: context.socket.id,
    isRoomCreator: context.isRoomCreator,
    isSpectator: context.isSpectator,
    showAllHands: true,
    initialChips: 1000,
    copySuccess: false,
    onCopyRoomId: vi.fn(),
    onShowAllHandsChange: vi.fn(),
    onInitialChipsChange: vi.fn(),
    onSaveChips: vi.fn(),
    onStartGame: vi.fn(),
    onLeaveRoom: vi.fn(),
    onCloseRoom: vi.fn(),
    onSwitchToPlayer: vi.fn(),
    onSwitchToSpectator: vi.fn(),
    ...overrides,
  }
  return {
    props,
    ...render(<SocketContext.Provider value={context}><LobbyScreen {...props} /></SocketContext.Provider>),
  }
}

describe('LobbyScreen', () => {
  it('shows host settings and enables starting with enough players', async () => {
    const user = userEvent.setup()
    const { props } = renderLobby('lobby-host')
    expect(screen.getByRole('heading', { name: /牌局设置/ })).toBeInTheDocument()
    const start = screen.getByRole('button', { name: /开始牌局/ })
    expect(start).toBeEnabled()
    await user.click(start)
    expect(props.onStartGame).toHaveBeenCalledOnce()
  })

  it('keeps a one-player room from starting', () => {
    renderLobby('lobby-one')
    expect(screen.getByRole('button', { name: /开始牌局/ })).toBeDisabled()
    expect(screen.getByText('等待牌友加入')).toBeInTheDocument()
  })

  it('uses a confirmation dialog before a guest becomes a spectator', async () => {
    const user = userEvent.setup()
    const { props } = renderLobby('lobby-guest')
    expect(screen.queryByRole('heading', { name: /牌局设置/ })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '旁观' }))
    expect(screen.getByRole('alertdialog')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '开始旁观' }))
    expect(props.onSwitchToSpectator).toHaveBeenCalledOnce()
  })

  it('disables invalid chip settings', () => {
    renderLobby('lobby-host', { initialChips: 100 })
    expect(screen.getByRole('button', { name: '保存' })).toBeDisabled()
    expect(screen.getByText(/请输入 500/)).toBeInTheDocument()
  })
})
