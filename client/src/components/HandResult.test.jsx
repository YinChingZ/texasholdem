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

  it('shows only supplied winning cards on the first view, without inferring opponents’ hands', () => {
    const context = createPreviewValue('result-hidden')
    const result = { ...context.handResult, winners: [{ playerId: 'winner', nickname: 'Winner', amount: 120 }], playersHands: [{ playerId: 'winner', hand: ['Ah', 'Ks'] }] }
    const { baseElement: container } = render(<SocketContext.Provider value={context}>
      <HandResult result={result} socket={context.socket} roomId="CLUB24" gameState={context.gameState} onClose={() => {}} />
    </SocketContext.Provider>)
    const winner = container.querySelector('article')
    expect(winner.querySelector('[aria-label="红桃A"]')).toBeVisible()
    expect(winner.querySelector('[aria-label="黑桃K"]')).toBeVisible()
    expect(screen.getByText('其余手牌已隐藏')).toBeVisible()
    expect(container.querySelectorAll('details article')).toHaveLength(1)
  })

  it('labels historical results and only offers returning to the live table', () => {
    const context = createPreviewValue('result-split')
    const onClose = vi.fn()
    render(<SocketContext.Provider value={context}>
      <HandResult result={{ ...context.handResult, handId: 'previous' }}
        gameState={{ ...context.gameState, handId: 'current', allowedActions: { end: true, nextHand: true } }}
        onClose={onClose} />
    </SocketContext.Provider>)
    expect(screen.getByRole('dialog', { name: '上一手结算' })).toBeVisible()
    expect(screen.queryByRole('button', { name: '开始下一手' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '结束游戏' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '返回牌桌' }))
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
