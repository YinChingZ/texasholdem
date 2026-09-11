import { describe, expect, it } from 'vitest'
import { awardsFromResult, playerPresentation } from './playerPresentation'

describe('persistent player states', () => {
  it.each(['all-in', 'folded'])('preserves %s alongside disconnection and a stale turn', (status) => {
    const state = playerPresentation({ id: 'p', status, connected: false }, 'p')
    expect(state.kind).toBe(status === 'all-in' ? 'allin' : 'folded')
    expect(state.offline).toBe(true)
  })
  it('marks disconnected players without suggesting they can act', () => {
    expect(playerPresentation({ id: 'p', status: 'in-game', connected: false }, 'p').kind).toBe('offline')
  })
  it('shows a winner even when the final stack was all in', () => {
    expect(playerPresentation({ id: 'p', status: 'all-in' }, null, { amount: 200 }).kind).toBe('winner')
  })
  it('aggregates awards across pots, without counting another player’s award', () => {
    expect(awardsFromResult({ winners: [{ playerId: 'a', amount: 100 }, { playerId: 'b', amount: 100 }, { playerId: 'a', amount: 80 }] })).toEqual({ a: { amount: 180 }, b: { amount: 100 } })
    expect(awardsFromResult(null)).toEqual({})
  })
})
