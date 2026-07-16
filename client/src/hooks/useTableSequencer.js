import { useCallback, useEffect, useRef, useState } from 'react'
import { EVENT, diffGameStates, isMidHandPhase, parseCardCode } from '../utils/gameStateDiff'
import { BADGE_LIFETIME, DWELL, FLIGHT_LIFETIME, MAX_QUEUE_DELAY, prefersReducedMotion } from '../utils/motion'
import { soundManager } from '../utils/soundManager'

// 把整包到达的权威 gameState 转换为有节奏的"展示状态"：
// - displayState：牌桌渲染用的快照，最多落后权威态 ~2.5s
// - seatEvents / potFlights / boardReveal / revealedHands：驱动瞬态动画
// - displayHandResult：结算弹窗延迟到获胜动画播完才释放
// 权威态（gameState）始终直接喂给 ActionDock/HeroPanel，玩家输入永不被动画阻塞。
export function useTableSequencer({ gameState, handResult, heroId }) {
  const [displayState, setDisplayState] = useState(gameState)
  const [displayHandResult, setDisplayHandResult] = useState(null)
  const [seatEvents, setSeatEvents] = useState({})
  const [boardReveal, setBoardReveal] = useState({ animateFrom: -1, token: 0 })
  const [potFlights, setPotFlights] = useState([])
  const [revealedHands, setRevealedHands] = useState({})

  const queueRef = useRef([])
  const drainTimerRef = useRef(null)
  const drainingRef = useRef(false)
  const fastForwardRef = useRef(false)
  // 已进入队列的最新快照（diff 基准），不是当前渲染的 displayState
  const diffBaseRef = useRef(gameState)
  // displayState 的同步镜像（React 状态更新是异步的，事件处理需要读到即时值）
  const displayRef = useRef(gameState)
  const pendingResultRef = useRef(null)
  const awaitingResultRef = useRef(false)
  const cleanupTimersRef = useRef(new Set())
  const flightIdRef = useRef(0)

  const applyDisplay = useCallback((next) => {
    displayRef.current = next
    setDisplayState(next)
  }, [])

  const scheduleCleanup = useCallback((fn, delay) => {
    const timer = window.setTimeout(() => {
      cleanupTimersRef.current.delete(timer)
      fn()
    }, delay)
    cleanupTimersRef.current.add(timer)
  }, [])

  const pushSeatEvent = useCallback((playerId, kind, amount) => {
    const id = `${playerId}-${Date.now()}-${kind}`
    setSeatEvents((current) => ({ ...current, [playerId]: { id, kind, amount } }))
    scheduleCleanup(() => {
      setSeatEvents((current) => (current[playerId]?.id === id ? { ...current, [playerId]: undefined } : current))
    }, BADGE_LIFETIME)
  }, [scheduleCleanup])

  const pushFlight = useCallback((playerId, direction, amount) => {
    if (prefersReducedMotion()) return
    const id = flightIdRef.current++
    setPotFlights((current) => [...current, { id, playerId, direction, amount }])
    scheduleCleanup(() => {
      setPotFlights((current) => current.filter((flight) => flight.id !== id))
    }, FLIGHT_LIFETIME)
  }, [scheduleCleanup])

  const hardSync = useCallback((snapshot) => {
    queueRef.current = []
    if (drainTimerRef.current) {
      window.clearTimeout(drainTimerRef.current)
      drainTimerRef.current = null
    }
    drainingRef.current = false
    fastForwardRef.current = false
    pendingResultRef.current = null
    awaitingResultRef.current = false
    diffBaseRef.current = snapshot
    applyDisplay(snapshot)
    setSeatEvents({})
    setPotFlights([])
    setRevealedHands({})
    setBoardReveal((current) => ({ animateFrom: -1, token: current.token + 1 }))
  }, [applyDisplay])

  // 从 handResult 载荷构建摊牌事件序列（补翻公共牌 → 亮手牌 → 逐个派彩 → 弹窗）
  const buildShowdownEvents = useCallback((result) => {
    const events = []
    const resultBoard = (result.communityCards ?? []).map(parseCardCode).filter(Boolean)
    events.push({ type: 'REVEAL_BOARD', cards: resultBoard })
    if (result.showAllHands && Array.isArray(result.playersHands) && result.playersHands.length > 0) {
      events.push({ type: 'SHOWDOWN_REVEAL', playersHands: result.playersHands })
    }
    for (const winner of result.winners ?? []) {
      events.push({ type: 'POT_AWARDED', playerId: winner.playerId, amount: winner.amount })
    }
    events.push({ type: 'SHOW_RESULT', result })
    return events
  }, [])

  const processEvent = useCallback((event) => {
    switch (event.type) {
      case EVENT.HAND_STARTED: {
        setSeatEvents({})
        setPotFlights([])
        setRevealedHands({})
        setBoardReveal((current) => ({ animateFrom: -1, token: current.token + 1 }))
        soundManager.playDeal()
        return DWELL.handStarted
      }
      case EVENT.PLAYER_ACTION: {
        const { playerId, kind, amount } = event
        pushSeatEvent(playerId, kind, amount)
        if (kind === 'fold') soundManager.playFold()
        else if (kind === 'check') soundManager.playCheck()
        else if (kind === 'allin') soundManager.playAllIn()
        else soundManager.playBet(amount, diffBaseRef.current?.mainPot ?? 0)
        if (kind !== 'fold' && kind !== 'check' && amount > 0) {
          pushFlight(playerId, 'toPot', amount)
        }
        return DWELL[kind] ?? DWELL.call
      }
      case EVENT.STREET_DEALT: {
        const { startIndex, cards, street } = event
        const current = displayRef.current
        if (current) {
          const board = (current.communityCards ?? []).slice(0, startIndex).concat(cards)
          applyDisplay({ ...current, gameState: street, communityCards: board })
        }
        setBoardReveal((state) => ({ animateFrom: startIndex, token: state.token + 1 }))
        cards.forEach((_, index) => {
          soundManager.play('flipCard', { delayMs: index * DWELL.perStreetCard, throttleMs: 0 })
        })
        return cards.length * DWELL.perStreetCard + DWELL.streetSettle
      }
      case 'REVEAL_BOARD': {
        const { cards } = event
        const current = displayRef.current
        if (!current) return 0
        const shown = current.communityCards ?? []
        if (cards.length <= shown.length) return 0
        const revealedFrom = shown.length
        applyDisplay({ ...current, communityCards: cards })
        setBoardReveal((state) => ({ animateFrom: revealedFrom, token: state.token + 1 }))
        const newCount = cards.length - revealedFrom
        for (let index = 0; index < newCount; index++) {
          soundManager.play('flipCard', { delayMs: index * DWELL.perStreetCard, throttleMs: 0 })
        }
        return newCount * DWELL.perStreetCard + DWELL.streetSettle
      }
      case 'SHOWDOWN_REVEAL': {
        const map = {}
        for (const playerHand of event.playersHands) {
          if (Array.isArray(playerHand.hand) && playerHand.hand.length > 0) {
            map[playerHand.playerId] = playerHand.hand.map((card) => ({ suit: card.suit, rank: card.rank }))
          }
        }
        if (Object.keys(map).length === 0) return 0
        setRevealedHands(map)
        return DWELL.showdownReveal
      }
      case 'POT_AWARDED': {
        pushSeatEvent(event.playerId, 'win', event.amount)
        pushFlight(event.playerId, 'toSeat', event.amount)
        soundManager.playPotCollect()
        if (event.playerId === heroId) soundManager.playWin()
        return DWELL.potAwarded
      }
      case 'SHOW_RESULT': {
        setDisplayHandResult(event.result)
        return 0
      }
      case EVENT.HAND_ENDED: {
        if (pendingResultRef.current) {
          const result = pendingResultRef.current
          pendingResultRef.current = null
          queueRef.current.unshift(...buildShowdownEvents(result))
        } else {
          awaitingResultRef.current = true
        }
        return 0
      }
      case 'SYNC': {
        applyDisplay(event.snapshot)
        return 0
      }
      default:
        return 0
    }
  }, [applyDisplay, buildShowdownEvents, heroId, pushFlight, pushSeatEvent])

  const stepRef = useRef(null)
  stepRef.current = () => {
    const event = queueRef.current.shift()
    if (!event) {
      drainingRef.current = false
      fastForwardRef.current = false
      return
    }
    // 快进模式：丢弃装饰事件，直接推进到最新状态
    if (fastForwardRef.current
      && event.type !== 'SYNC' && event.type !== 'SHOW_RESULT' && event.type !== EVENT.HAND_ENDED) {
      stepRef.current()
      return
    }
    const dwell = processEvent(event)
    const wait = prefersReducedMotion() || fastForwardRef.current ? 0 : dwell
    if (wait > 0) {
      drainTimerRef.current = window.setTimeout(() => stepRef.current(), wait)
    } else {
      stepRef.current()
    }
  }

  const drain = useCallback(() => {
    if (drainingRef.current) return
    drainingRef.current = true
    stepRef.current()
  }, [])

  const estimateDwell = (event) => {
    switch (event.type) {
      case EVENT.HAND_STARTED: return DWELL.handStarted
      case EVENT.PLAYER_ACTION: return DWELL[event.kind] ?? DWELL.call
      case EVENT.STREET_DEALT: return event.cards.length * DWELL.perStreetCard + DWELL.streetSettle
      case 'REVEAL_BOARD': return 2 * DWELL.perStreetCard + DWELL.streetSettle
      case 'SHOWDOWN_REVEAL': return DWELL.showdownReveal
      case 'POT_AWARDED': return DWELL.potAwarded
      default: return 0
    }
  }

  // 权威 gameState 变化 → diff 入队
  useEffect(() => {
    if (!gameState) return
    const phase = gameState.gameState
    if (phase === 'WAITING' || phase === 'GAME_OVER' || !diffBaseRef.current) {
      hardSync(gameState)
      return
    }
    if (gameState === diffBaseRef.current) return
    const events = diffGameStates(diffBaseRef.current, gameState)
    diffBaseRef.current = gameState
    queueRef.current.push(...events, { type: 'SYNC', snapshot: gameState })
    const totalDwell = queueRef.current.reduce((sum, event) => sum + estimateDwell(event), 0)
    if (totalDwell > MAX_QUEUE_DELAY) fastForwardRef.current = true
    drain()
  }, [gameState, hardSync, drain])

  // handResult 到达/清除
  useEffect(() => {
    if (!handResult) {
      setDisplayHandResult(null)
      pendingResultRef.current = null
      return
    }
    if (awaitingResultRef.current) {
      // HAND_ENDED 已处理（服务端延迟发送结果的情况）：直接入队播放
      awaitingResultRef.current = false
      queueRef.current.push(...buildShowdownEvents(handResult))
      drain()
      return
    }
    if (isMidHandPhase(diffBaseRef.current?.gameState)) {
      // 结果先于 SHOWDOWN_COMPLETE 快照到达（当前服务端顺序）：等 HAND_ENDED 时展开
      pendingResultRef.current = handResult
      return
    }
    // 其余情况（重连中途收到结果等）直接显示
    setDisplayHandResult(handResult)
  }, [handResult, buildShowdownEvents, drain])

  // 轮到英雄行动的提示音基于权威态，不延迟
  const prevTurnRef = useRef(null)
  useEffect(() => {
    const turn = gameState?.currentPlayerTurn ?? null
    if (turn !== prevTurnRef.current && turn === heroId && isMidHandPhase(gameState?.gameState)) {
      soundManager.playYourTurn()
    }
    prevTurnRef.current = turn
  }, [gameState, heroId])

  // 标签页重新可见时硬同步，避免后台积压的队列慢慢重放
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible' && queueRef.current.length > 0) {
        hardSync(diffBaseRef.current)
      }
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [hardSync])

  // 卸载清理
  useEffect(() => () => {
    if (drainTimerRef.current) window.clearTimeout(drainTimerRef.current)
    const timers = cleanupTimersRef.current
    timers.forEach((timer) => window.clearTimeout(timer))
    timers.clear()
  }, [])

  return { displayState, displayHandResult, seatEvents, boardReveal, potFlights, revealedHands }
}
