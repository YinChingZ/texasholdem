import { describe, expect, it } from 'vitest'
import { EVENT, diffGameStates, parseCardCode } from './gameStateDiff'

const player = (id, overrides = {}) => ({
  id,
  nickname: id,
  chips: 1000,
  status: 'in-game',
  currentBet: 0,
  hasActed: false,
  ...overrides,
})

const snapshot = (overrides = {}) => ({
  gameState: 'PREFLOP',
  communityCards: [],
  currentBet: 0,
  mainPot: 0,
  currentPlayerTurn: null,
  players: [],
  ...overrides,
})

describe('parseCardCode', () => {
  it('解析服务端字符串牌面', () => {
    expect(parseCardCode('Th')).toEqual({ suit: 'Hearts', rank: '10' })
    expect(parseCardCode('As')).toEqual({ suit: 'Spades', rank: 'A' })
    expect(parseCardCode('2d')).toEqual({ suit: 'Diamonds', rank: '2' })
  })

  it('对象牌面原样返回', () => {
    const card = { suit: 'Clubs', rank: 'K' }
    expect(parseCardCode(card)).toBe(card)
  })
})

describe('diffGameStates', () => {
  it('开手快照只产生 HAND_STARTED，盲注不产生玩家动作', () => {
    const prev = snapshot({
      gameState: 'WAITING',
      players: [player('a'), player('b')],
    })
    const next = snapshot({
      gameState: 'PREFLOP',
      currentBet: 10,
      mainPot: 15,
      currentPlayerTurn: 'a',
      players: [
        player('a', { chips: 995, currentBet: 5 }),
        player('b', { chips: 990, currentBet: 10 }),
      ],
    })
    const events = diffGameStates(prev, next)
    expect(events).toEqual([{ type: EVENT.HAND_STARTED }])
  })

  it('推断加注动作与金额', () => {
    const prev = snapshot({
      currentBet: 10,
      currentPlayerTurn: 'a',
      players: [player('a', { chips: 990, currentBet: 10 }), player('b', { chips: 990, currentBet: 10 })],
    })
    const next = snapshot({
      currentBet: 50,
      currentPlayerTurn: 'b',
      players: [player('a', { chips: 950, currentBet: 50 }), player('b', { chips: 990, currentBet: 10 })],
    })
    expect(diffGameStates(prev, next)).toEqual([
      { type: EVENT.PLAYER_ACTION, playerId: 'a', kind: 'raise', amount: 50 },
    ])
  })

  it('筹码与下注不变且回合移走视为过牌', () => {
    const prev = snapshot({
      gameState: 'FLOP',
      currentPlayerTurn: 'a',
      communityCards: [{}, {}, {}],
      players: [player('a'), player('b')],
    })
    const next = snapshot({
      gameState: 'FLOP',
      currentPlayerTurn: 'b',
      communityCards: [{}, {}, {}],
      players: [player('a'), player('b')],
    })
    expect(diffGameStates(prev, next)).toEqual([
      { type: EVENT.PLAYER_ACTION, playerId: 'a', kind: 'check', amount: 0 },
    ])
  })

  it('收尾跟注与发街同快照时，动作排在发街之前（金额取筹码差）', () => {
    const prev = snapshot({
      gameState: 'PREFLOP',
      currentBet: 50,
      currentPlayerTurn: 'b',
      players: [player('a', { chips: 950, currentBet: 50 }), player('b', { chips: 990, currentBet: 10 })],
    })
    const flop = [{ suit: 'Hearts', rank: 'A' }, { suit: 'Clubs', rank: '7' }, { suit: 'Spades', rank: '2' }]
    const next = snapshot({
      gameState: 'FLOP',
      currentBet: 0,
      currentPlayerTurn: 'a',
      communityCards: flop,
      players: [player('a', { chips: 950, currentBet: 0 }), player('b', { chips: 950, currentBet: 0 })],
    })
    expect(diffGameStates(prev, next)).toEqual([
      { type: EVENT.PLAYER_ACTION, playerId: 'b', kind: 'call', amount: 40 },
      { type: EVENT.STREET_DEALT, street: 'FLOP', startIndex: 0, cards: flop },
    ])
  })

  it('全押状态变化优先于金额推断', () => {
    const prev = snapshot({
      currentBet: 100,
      currentPlayerTurn: 'a',
      players: [player('a', { chips: 80, currentBet: 0 }), player('b', { chips: 900, currentBet: 100 })],
    })
    const next = snapshot({
      currentBet: 100,
      currentPlayerTurn: 'b',
      players: [player('a', { chips: 0, currentBet: 80, status: 'all-in' }), player('b', { chips: 900, currentBet: 100 })],
    })
    expect(diffGameStates(prev, next)).toEqual([
      { type: EVENT.PLAYER_ACTION, playerId: 'a', kind: 'allin', amount: 80 },
    ])
  })

  it('弃牌直接结束手牌（清场抹掉状态）仍推断为弃牌，并追加 HAND_ENDED', () => {
    const prev = snapshot({
      gameState: 'TURN',
      currentBet: 200,
      currentPlayerTurn: 'a',
      communityCards: [{}, {}, {}, {}],
      players: [player('a', { chips: 500, currentBet: 0 }), player('b', { chips: 300, currentBet: 200 })],
    })
    const next = snapshot({
      gameState: 'SHOWDOWN_COMPLETE',
      currentPlayerTurn: null,
      communityCards: [],
      players: [player('a', { chips: 500 }), player('b', { chips: 700 })],
    })
    expect(diffGameStates(prev, next)).toEqual([
      { type: EVENT.PLAYER_ACTION, playerId: 'a', kind: 'fold', amount: 0 },
      { type: EVENT.HAND_ENDED },
    ])
  })

  it('按 id 匹配玩家：座位重排不误报', () => {
    const prev = snapshot({
      gameState: 'FLOP',
      currentPlayerTurn: 'a',
      communityCards: [{}, {}, {}],
      players: [player('a', { chips: 500 }), player('b', { chips: 800 })],
    })
    const next = snapshot({
      gameState: 'FLOP',
      currentPlayerTurn: 'b',
      communityCards: [{}, {}, {}],
      players: [player('b', { chips: 800 }), player('a', { chips: 500 })],
    })
    expect(diffGameStates(prev, next)).toEqual([
      { type: EVENT.PLAYER_ACTION, playerId: 'a', kind: 'check', amount: 0 },
    ])
  })

  it('非行动者转为弃牌（断线代弃）也会产生弃牌事件', () => {
    const prev = snapshot({
      gameState: 'FLOP',
      currentPlayerTurn: 'a',
      communityCards: [{}, {}, {}],
      players: [player('a'), player('b'), player('c')],
    })
    const next = snapshot({
      gameState: 'FLOP',
      currentPlayerTurn: 'b',
      communityCards: [{}, {}, {}],
      players: [player('a'), player('b'), player('c', { status: 'folded' })],
    })
    expect(diffGameStates(prev, next)).toContainEqual(
      { type: EVENT.PLAYER_ACTION, playerId: 'c', kind: 'fold', amount: 0 },
    )
  })

  it('行动者筹码增加（结算入账）时不产生动作事件', () => {
    const prev = snapshot({
      gameState: 'RIVER',
      currentPlayerTurn: 'a',
      communityCards: [{}, {}, {}, {}, {}],
      players: [player('a', { chips: 500 }), player('b', { chips: 300 })],
    })
    const next = snapshot({
      gameState: 'SHOWDOWN_COMPLETE',
      currentPlayerTurn: null,
      communityCards: [],
      players: [player('a', { chips: 900 }), player('b', { chips: 300 })],
    })
    expect(diffGameStates(prev, next)).toEqual([{ type: EVENT.HAND_ENDED }])
  })
})
