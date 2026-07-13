import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { SocketContext } from '../contexts/socket-context'
import { createPreviewValue } from '../dev/previewFixtures'
import HandResult from './HandResult'
import { parseResultCard } from './resultModels'

describe('HandResult', () => {
  it('normalizes string and object cards', () => {
    expect(parseResultCard('10h')).toEqual({ rank: '10', suit: 'Hearts' })
    expect(parseResultCard({ rank: 'K', suit: 'Clubs' })).toEqual({ rank: 'K', suit: 'Clubs' })
    expect(parseResultCard(null)).toBeNull()
  })

  it('keeps the prepareNextHand socket contract for the host', () => {
    const context = createPreviewValue('result-split')
    const emit = vi.fn()
    const onClose = vi.fn()
    render(
      <SocketContext.Provider value={{ ...context, socket: { ...context.socket, emit } }}>
        <HandResult result={context.handResult} socket={{ emit }} roomId="CLUB24" gameState={context.gameState} onClose={onClose} />
      </SocketContext.Provider>,
    )
    expect(screen.getAllByText('主池平分')).toHaveLength(2)
    fireEvent.click(screen.getByRole('button', { name: '开始下一手' }))
    expect(emit).toHaveBeenCalledWith('prepareNextHand', { roomId: 'CLUB24' })
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('does not offer another hand when only one player has chips', () => {
    const context = createPreviewValue('result-last-player')
    render(
      <SocketContext.Provider value={context}>
        <HandResult result={context.handResult} socket={context.socket} roomId="CLUB24" gameState={context.gameState} onClose={() => {}} />
      </SocketContext.Provider>,
    )
    expect(screen.queryByRole('button', { name: '开始下一手' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: '结束游戏' })).toBeVisible()
  })
})
