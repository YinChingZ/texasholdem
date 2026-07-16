// 把服务端整包推送的 gameState 快照差分为有序的游戏事件，
// 供 useTableSequencer 转换成有节奏的音效 / 动画序列。纯函数，可单测。

export const EVENT = {
  HAND_STARTED: 'HAND_STARTED',
  PLAYER_ACTION: 'PLAYER_ACTION',
  STREET_DEALT: 'STREET_DEALT',
  HAND_ENDED: 'HAND_ENDED',
}

const MID_HAND_PHASES = new Set(['PREFLOP', 'FLOP', 'TURN', 'RIVER', 'SHOWDOWN'])

export function isMidHandPhase(phase) {
  return MID_HAND_PHASES.has(phase)
}

// 解析服务端 handResult 中 "Th"/"Ad" 形式的牌面字符串为 {suit, rank}
const SUIT_CODES = { h: 'Hearts', d: 'Diamonds', c: 'Clubs', s: 'Spades' }

export function parseCardCode(code) {
  if (!code) return null
  if (typeof code === 'object') return code
  const rankCode = code.slice(0, -1)
  const suitCode = code.slice(-1).toLowerCase()
  return {
    suit: SUIT_CODES[suitCode] ?? suitCode,
    rank: rankCode === 'T' ? '10' : rankCode,
  }
}

// 推断上一快照中轮到行动的玩家做了什么
function inferActorEvent(prev, next, handEnded) {
  const actorId = prev.currentPlayerTurn
  if (!actorId) return null
  const before = (prev.players ?? []).find((p) => p.id === actorId)
  const after = (next.players ?? []).find((p) => p.id === actorId)
  if (!before || !after) return null

  const chipsSpent = (before.chips ?? 0) - (after.chips ?? 0)

  if (after.status === 'folded' && before.status !== 'folded') {
    return { type: EVENT.PLAYER_ACTION, playerId: actorId, kind: 'fold', amount: 0 }
  }
  if (after.status === 'all-in' && before.status !== 'all-in') {
    return { type: EVENT.PLAYER_ACTION, playerId: actorId, kind: 'allin', amount: Math.max(chipsSpent, 0) }
  }
  if (chipsSpent > 0) {
    const sameStreet = next.gameState === prev.gameState
    const tableBetRaised = (next.currentBet ?? 0) > (prev.currentBet ?? 0)
    if (sameStreet && tableBetRaised && after.currentBet === next.currentBet) {
      const kind = (prev.currentBet ?? 0) > 0 ? 'raise' : 'bet'
      return { type: EVENT.PLAYER_ACTION, playerId: actorId, kind, amount: after.currentBet }
    }
    return { type: EVENT.PLAYER_ACTION, playerId: actorId, kind: 'call', amount: chipsSpent }
  }
  if (chipsSpent < 0) {
    // 行动者筹码不减反增：结算把奖池发给了他（弃牌获胜等），动作本身无法还原，跳过
    return null
  }
  if (handEnded) {
    // 手牌因该动作直接结束且清场抹掉了状态：唯一无消耗的收尾动作是弃牌
    return { type: EVENT.PLAYER_ACTION, playerId: actorId, kind: 'fold', amount: 0 }
  }
  return { type: EVENT.PLAYER_ACTION, playerId: actorId, kind: 'check', amount: 0 }
}

// diff 两个相邻快照 → 有序事件数组（不含 SYNC，由调用方追加）
export function diffGameStates(prev, next) {
  const events = []
  if (!next) return events

  const prevPhase = prev?.gameState
  const nextPhase = next.gameState
  const handStarted = nextPhase === 'PREFLOP' && (!prev || !isMidHandPhase(prevPhase))
  const handEnded = Boolean(prev)
    && isMidHandPhase(prevPhase)
    && (nextPhase === 'SHOWDOWN_COMPLETE' || nextPhase === 'GAME_OVER')

  if (handStarted) {
    events.push({ type: EVENT.HAND_STARTED })
  }

  // 手牌开始的快照里筹码变化来自盲注，不推断玩家动作（修掉旧实现的盲注误报）
  if (!handStarted && prev && isMidHandPhase(prevPhase)) {
    const actorEvent = inferActorEvent(prev, next, handEnded)
    if (actorEvent) events.push(actorEvent)

    // 非行动者的弃牌（断线代弃等）
    const nextById = new Map((next.players ?? []).map((p) => [p.id, p]))
    for (const before of prev.players ?? []) {
      if (before.id === prev.currentPlayerTurn) continue
      const after = nextById.get(before.id)
      if (after && after.status === 'folded' && before.status !== 'folded') {
        events.push({ type: EVENT.PLAYER_ACTION, playerId: before.id, kind: 'fold', amount: 0 })
      }
    }
  }

  // 公共牌增加 → 发街（动作事件排在发街之前）
  const prevCards = prev?.communityCards ?? []
  const nextCards = next.communityCards ?? []
  if (!handStarted && isMidHandPhase(nextPhase) && nextCards.length > prevCards.length) {
    events.push({
      type: EVENT.STREET_DEALT,
      street: nextPhase,
      startIndex: prevCards.length,
      cards: nextCards.slice(prevCards.length),
    })
  }

  if (handEnded) {
    events.push({ type: EVENT.HAND_ENDED })
  }

  return events
}
