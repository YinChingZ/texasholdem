const seatSlots = {
  1: [[50, 87]],
  2: [[50, 87], [50, 12]],
  3: [[50, 87], [15, 30], [85, 30]],
  4: [[50, 87], [10, 50], [50, 12], [90, 50]],
  5: [[50, 87], [10, 68], [18, 24], [82, 24], [90, 68]],
  6: [[50, 87], [10, 68], [16, 25], [50, 12], [84, 25], [90, 68]],
  7: [[50, 87], [11, 72], [8, 46], [20, 20], [80, 20], [92, 46], [89, 72]],
  8: [[50, 87], [11, 72], [8, 46], [20, 20], [50, 12], [80, 20], [92, 46], [89, 72]],
}

export function arrangePlayers(players = [], anchorId) {
  if (!players.length) return []
  const anchorIndex = Math.max(0, players.findIndex((player) => player.id === anchorId))
  const ordered = [...players.slice(anchorIndex), ...players.slice(0, anchorIndex)]
  const slots = seatSlots[Math.min(8, ordered.length)]

  return ordered.slice(0, 8).map((player, index) => ({
    player,
    seatIndex: index,
    x: slots[index][0],
    y: slots[index][1],
  }))
}

export function deriveActionState(player, gameState) {
  const currentBet = gameState?.currentBet ?? 0
  const bigBlind = gameState?.bigBlind ?? 10
  // 最小加注增量 = 本轮上一次完整加注的大小（服务端下发，回退为大盲），与后端校验一致
  const minRaise = gameState?.minRaise ?? bigBlind
  const playerChips = player?.chips ?? 0
  const playerCurrentBet = player?.currentBet ?? 0
  const callAmount = Math.max(0, currentBet - playerCurrentBet)
  const minRaiseAmount = Math.max(0, minRaise)
  const maxRaiseAmount = Math.max(0, playerChips - callAmount)
  const isPlayerTurn = Boolean(player && gameState?.currentPlayerTurn === player.id)
  const canCheck = isPlayerTurn && callAmount === 0
  const canCall = isPlayerTurn && callAmount > 0 && playerChips > 0
  const canRaise = isPlayerTurn && playerChips > callAmount && maxRaiseAmount >= minRaiseAmount

  return {
    currentBet,
    playerChips,
    playerCurrentBet,
    callAmount,
    minRaiseAmount,
    maxRaiseAmount,
    isPlayerTurn,
    canCheck,
    canCall,
    canRaise,
    isAllInCall: canCall && callAmount >= playerChips,
  }
}

export function getQuickRaiseOptions(actionState, pot = 0) {
  const { minRaiseAmount, maxRaiseAmount } = actionState
  if (maxRaiseAmount < minRaiseAmount) return []

  return [
    { amount: minRaiseAmount, label: '最小' },
    { amount: Math.floor(pot / 2), label: '1/2 池' },
    { amount: pot, label: '满池' },
    { amount: maxRaiseAmount, label: '全押' },
  ].filter(({ amount }, index, all) => (
    amount >= minRaiseAmount
    && amount <= maxRaiseAmount
    && all.findIndex((item) => item.amount === amount) === index
  ))
}

export function getPlayerRole(player, players, gameState) {
  const roles = []
  const index = players.findIndex((item) => item.id === player.id)
  if (index === gameState?.dealerPosition) roles.push('D')
  if (index === gameState?.smallBlindPosition) roles.push('SB')
  if (index === gameState?.bigBlindPosition) roles.push('BB')
  return roles
}
