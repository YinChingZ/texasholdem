import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useTableSequencer } from './useTableSequencer'

vi.mock('../utils/soundManager', () => ({
  soundManager: {
    play: vi.fn(),
    playDeal: vi.fn(),
    playCardFlip: vi.fn(),
    playFold: vi.fn(),
    playCheck: vi.fn(),
    playBet: vi.fn(),
    playAllIn: vi.fn(),
    playPotCollect: vi.fn(),
    playWin: vi.fn(),
    playYourTurn: vi.fn(),
    playClick: vi.fn(),
  },
}))

import { soundManager } from '../utils/soundManager'

const player = (id, overrides = {}) => ({
  id,
  nickname: id,
  chips: 1000,
  status: 'in-game',
  currentBet: 0,
  ...overrides,
})

const snapshot = (overrides = {}) => ({
  gameState: 'PREFLOP',
  communityCards: [],
  currentBet: 0,
  mainPot: 0,
  currentPlayerTurn: null,
  players: [player('hero'), player('villain')],
  ...overrides,
})

function renderSequencer(initialState) {
  return renderHook(
    ({ gameState, handResult }) => useTableSequencer({ gameState, handResult, heroId: 'hero' }),
    { initialProps: { gameState: initialState, handResult: null } },
  )
}

describe('useTableSequencer', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.runOnlyPendingTimers()
    vi.useRealTimers()
    vi.clearAllMocks()
  })

  it('对手动作先出气泡，SYNC 在停留时间后才落地', () => {
    const start = snapshot({ currentPlayerTurn: 'villain', currentBet: 10 })
    const { result, rerender } = renderSequencer(start)

    const afterRaise = snapshot({
      currentPlayerTurn: 'hero',
      currentBet: 60,
      mainPot: 70,
      players: [player('hero'), player('villain', { chips: 940, currentBet: 60 })],
    })
    rerender({ gameState: afterRaise, handResult: null })

    expect(result.current.seatEvents.villain).toMatchObject({ kind: 'raise', amount: 60 })
    expect(soundManager.playBet).toHaveBeenCalled()
    // SYNC 尚未应用：展示态还停留在旧快照
    expect(result.current.displayState.currentBet).toBe(10)

    act(() => vi.advanceTimersByTime(700))
    expect(result.current.displayState.currentBet).toBe(60)
  })

  it('发街逐张揭示并播放翻牌音', () => {
    const preflop = snapshot({ currentPlayerTurn: 'villain' })
    const { result, rerender } = renderSequencer(preflop)

    const flop = snapshot({
      gameState: 'FLOP',
      currentPlayerTurn: 'hero',
      communityCards: [
        { suit: 'Hearts', rank: 'A' },
        { suit: 'Clubs', rank: '7' },
        { suit: 'Spades', rank: '2' },
      ],
    })
    rerender({ gameState: flop, handResult: null })

    act(() => vi.advanceTimersByTime(500))
    expect(result.current.displayState.communityCards).toHaveLength(3)
    expect(result.current.boardReveal.animateFrom).toBe(0)
    expect(soundManager.play).toHaveBeenCalledWith('flipCard', expect.objectContaining({ delayMs: 0 }))
    expect(soundManager.play).toHaveBeenCalledWith('flipCard', expect.objectContaining({ delayMs: 520 }))
  })

  it('结算弹窗要等补牌与派彩动画播完才释放', () => {
    const river = snapshot({
      gameState: 'RIVER',
      currentPlayerTurn: 'villain',
      mainPot: 200,
      communityCards: [{}, {}, {}, {}, {}],
    })
    const { result, rerender } = renderSequencer(river)

    const handResult = {
      winners: [{ playerId: 'hero', nickname: 'hero', amount: 200 }],
      communityCards: ['Ah', '7c', '2s', 'Td', '9h'],
      playersHands: [],
      showAllHands: true,
    }
    // 当前服务端顺序：handResult 先于 SHOWDOWN_COMPLETE 快照到达
    rerender({ gameState: river, handResult })
    expect(result.current.displayHandResult).toBeNull()

    const cleaned = snapshot({
      gameState: 'SHOWDOWN_COMPLETE',
      players: [player('hero', { chips: 1100 }), player('villain', { chips: 900 })],
    })
    rerender({ gameState: cleaned, handResult })

    // 排队中：弹窗仍未释放
    expect(result.current.displayHandResult).toBeNull()

    act(() => vi.advanceTimersByTime(5000))
    expect(result.current.displayHandResult).toBe(handResult)
    expect(soundManager.playPotCollect).toHaveBeenCalled()
    expect(soundManager.playWin).toHaveBeenCalled() // 英雄获胜
  })

  it('WAITING 快照触发硬同步清空队列', () => {
    const mid = snapshot({ currentPlayerTurn: 'villain', currentBet: 10 })
    const { result, rerender } = renderSequencer(mid)

    rerender({
      gameState: snapshot({
        currentPlayerTurn: 'hero',
        currentBet: 60,
        players: [player('hero'), player('villain', { chips: 940, currentBet: 60 })],
      }),
      handResult: null,
    })
    const waiting = snapshot({ gameState: 'WAITING', currentBet: 0 })
    rerender({ gameState: waiting, handResult: null })

    expect(result.current.displayState).toBe(waiting)
    expect(result.current.seatEvents).toEqual({})
  })

  it('轮到英雄行动时播放提示音（基于权威态，不延迟）', () => {
    const start = snapshot({ currentPlayerTurn: 'villain' })
    const { rerender } = renderSequencer(start)
    expect(soundManager.playYourTurn).not.toHaveBeenCalled()

    rerender({ gameState: snapshot({ currentPlayerTurn: 'hero' }), handResult: null })
    expect(soundManager.playYourTurn).toHaveBeenCalledOnce()
  })
})
