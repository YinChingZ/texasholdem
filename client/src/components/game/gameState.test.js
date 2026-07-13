import { describe, expect, it } from 'vitest'
import { arrangePlayers, deriveActionState, getPlayerRole, getQuickRaiseOptions } from './gameState'

const players = Array.from({ length: 8 }, (_, index) => ({
  id: `player-${index + 1}`,
  nickname: `玩家 ${index + 1}`,
  chips: 1000,
  currentBet: index === 0 ? 20 : 40,
}))

describe('arrangePlayers', () => {
  it.each([2, 4, 6, 8])('places %i players in unique seats', (count) => {
    const placements = arrangePlayers(players.slice(0, count), 'player-1')
    expect(placements).toHaveLength(count)
    expect(new Set(placements.map(({ x, y }) => `${x}-${y}`)).size).toBe(count)
  })

  it('anchors the chosen player at the bottom and preserves clockwise order', () => {
    const placements = arrangePlayers(players.slice(0, 4), 'player-3')
    expect(placements[0]).toMatchObject({ player: { id: 'player-3' }, x: 50, y: 87 })
    expect(placements.map(({ player }) => player.id)).toEqual(['player-3', 'player-4', 'player-1', 'player-2'])
  })
})

describe('deriveActionState', () => {
  it('allows check and raise when the player has matched the bet', () => {
    const state = deriveActionState(players[1], { currentPlayerTurn: 'player-2', currentBet: 40, bigBlind: 20 })
    expect(state).toMatchObject({ canCheck: true, canCall: false, canRaise: true, callAmount: 0 })
  })

  it('allows call but prevents a raise when only an all-in call is possible', () => {
    const player = { ...players[0], chips: 20, currentBet: 20 }
    const state = deriveActionState(player, { currentPlayerTurn: 'player-1', currentBet: 60, bigBlind: 20 })
    expect(state).toMatchObject({ canCheck: false, canCall: true, canRaise: false, isAllInCall: true })
  })

  it('disables all actions outside the player turn', () => {
    const state = deriveActionState(players[0], { currentPlayerTurn: 'player-2', currentBet: 40, bigBlind: 20 })
    expect(state).toMatchObject({ isPlayerTurn: false, canCheck: false, canCall: false, canRaise: false })
  })

  it('creates unique quick raise amounts inside the legal range', () => {
    const options = getQuickRaiseOptions({ minRaiseAmount: 40, maxRaiseAmount: 300 }, 160)
    expect(options.map(({ amount }) => amount)).toEqual([40, 80, 160, 300])
  })
})

describe('getPlayerRole', () => {
  it('maps dealer and blinds from server player indexes', () => {
    expect(getPlayerRole(players[2], players, { dealerPosition: 2, smallBlindPosition: 3, bigBlindPosition: 4 })).toEqual(['D'])
    expect(getPlayerRole(players[4], players, { dealerPosition: 2, smallBlindPosition: 3, bigBlindPosition: 4 })).toEqual(['BB'])
  })
})
