import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import WelcomeScreen from './WelcomeScreen'

function renderScreen(overrides = {}) {
  const props = {
    nickname: '',
    roomId: '',
    onNicknameChange: vi.fn(),
    onRoomIdChange: vi.fn(),
    onCreateRoom: vi.fn(),
    onJoinRoom: vi.fn(),
    ...overrides,
  }
  return { props, ...render(<WelcomeScreen {...props} />) }
}

describe('WelcomeScreen', () => {
  it('keeps room actions disabled until required values exist', () => {
    renderScreen()
    expect(screen.getByRole('button', { name: /创建新房间/ })).toBeDisabled()
    expect(screen.getByRole('button', { name: /加入房间/ })).toBeDisabled()
  })

  it('submits the create-room action', async () => {
    const user = userEvent.setup()
    const onCreateRoom = vi.fn()
    renderScreen({ nickname: '河牌猎手', onCreateRoom })
    await user.click(screen.getByRole('button', { name: /创建新房间/ }))
    expect(onCreateRoom).toHaveBeenCalledOnce()
  })

  it('reports input changes and submits join-room', async () => {
    const user = userEvent.setup()
    const onNicknameChange = vi.fn()
    const onRoomIdChange = vi.fn()
    const onJoinRoom = vi.fn()
    renderScreen({ nickname: '北岸', roomId: 'CLUB24', onNicknameChange, onRoomIdChange, onJoinRoom })

    await user.type(screen.getByLabelText('昵称'), 'A')
    await user.type(screen.getByLabelText('房间号'), 'B')
    await user.click(screen.getByRole('button', { name: /加入房间/ }))

    expect(onNicknameChange).toHaveBeenCalled()
    expect(onRoomIdChange).toHaveBeenCalled()
    expect(onJoinRoom).toHaveBeenCalledOnce()
  })
})
