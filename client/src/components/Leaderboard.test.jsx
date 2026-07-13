import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import Leaderboard from './Leaderboard'
import { rankPlayers } from './resultModels'

const players = [
  { id: 'a', nickname: '甲', chips: 400 },
  { id: 'b', nickname: '乙', chips: 900 },
  { id: 'c', nickname: '丙', chips: 600 },
]

describe('Leaderboard', () => {
  it('sorts players without changing the input array', () => {
    expect(rankPlayers(players).map((player) => player.nickname)).toEqual(['乙', '丙', '甲'])
    expect(players.map((player) => player.nickname)).toEqual(['甲', '乙', '丙'])
  })

  it('shows host actions and invokes a new game', () => {
    const onNewGame = vi.fn()
    render(<Leaderboard players={players} isRoomCreator onNewGame={onNewGame} onLeaveRoom={() => {}} onCloseRoom={() => {}} onClose={() => {}} />)
    expect(screen.getByText('本局冠军').nextSibling).toHaveTextContent('乙')
    fireEvent.click(screen.getByRole('button', { name: /开始新游戏/ }))
    expect(onNewGame).toHaveBeenCalledOnce()
  })

  it('keeps destructive room controls hidden from guests', () => {
    render(<Leaderboard players={players} isRoomCreator={false} onLeaveRoom={() => {}} onClose={() => {}} />)
    expect(screen.queryByRole('button', { name: '关闭房间' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /离开房间/ })).toBeVisible()
  })
})
