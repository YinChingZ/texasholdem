import { describe, expect, it } from 'vitest'
import { deriveScreen } from './useGameViewModel'

const connected = { connectionStatus: 'connected', isReconnecting: false }

describe('deriveScreen', () => {
  it.each([
    ['welcome', { ...connected, room: null, gameState: null }],
    ['connecting', { ...connected, room: { id: 'ROOM1' }, gameState: null }],
    ['lobby', { ...connected, room: { id: 'ROOM1' }, gameState: { gameState: 'WAITING' } }],
    ['game', { ...connected, room: { id: 'ROOM1' }, gameState: { gameState: 'FLOP' } }],
    ['reconnecting', { ...connected, room: null, gameState: null, isReconnecting: true }],
    ['disconnected', { ...connected, room: null, gameState: null, connectionStatus: 'disconnected' }],
  ])('returns %s', (expected, input) => {
    expect(deriveScreen(input)).toBe(expected)
  })
})
