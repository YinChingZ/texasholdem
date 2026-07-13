import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { SocketContext } from '../contexts/socket-context'
import { useChat } from './useChat'

function createSocket() {
  const listeners = new Map()
  return {
    listeners,
    emit: vi.fn(),
    on: vi.fn((event, listener) => listeners.set(event, listener)),
    off: vi.fn((event) => listeners.delete(event)),
  }
}

describe('useChat', () => {
  it('counts messages while hidden and clears unread when shown', () => {
    const socket = createSocket()
    const wrapper = ({ children }) => <SocketContext.Provider value={{ socket }}>{children}</SocketContext.Provider>
    const { result, rerender } = renderHook(({ visible }) => useChat('ROOM1', visible), { wrapper, initialProps: { visible: false } })

    act(() => socket.listeners.get('newMessage')({ sender: '牌友', message: '你好' }))
    expect(result.current.unreadCount).toBe(1)
    rerender({ visible: true })
    expect(result.current.unreadCount).toBe(0)
  })

  it('keeps the existing sendMessage socket protocol', () => {
    const socket = createSocket()
    const wrapper = ({ children }) => <SocketContext.Provider value={{ socket }}>{children}</SocketContext.Provider>
    const { result } = renderHook(() => useChat('ROOM1', true), { wrapper })

    act(() => result.current.setDraft('  一起开局  '))
    act(() => result.current.sendMessage())
    expect(socket.emit).toHaveBeenCalledWith('sendMessage', { roomId: 'ROOM1', message: '一起开局' })
    expect(result.current.draft).toBe('')
  })
})
