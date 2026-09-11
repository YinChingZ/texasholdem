export function playerPresentation(player, currentPlayerId, award) {
  const offline = player.connected === false || player.status === 'disconnected'
  let kind = 'waiting'
  let label = ''
  if (award) { kind = 'winner'; label = '获胜' }
  else if (player.status === 'folded') { kind = 'folded'; label = '已弃牌' }
  else if (player.status === 'all-in') { kind = 'allin'; label = 'ALL IN' }
  else if (['out-of-chips', 'out'].includes(player.status)) { kind = 'out'; label = '筹码耗尽' }
  else if (player.id === currentPlayerId && !offline) { kind = 'current'; label = '行动中' }
  else if (offline) { kind = 'offline'; label = '已离线' }
  return { kind, label, offline }
}

export function awardsFromResult(result) {
  const awards = {}
  for (const winner of result?.winners ?? []) {
    const previous = awards[winner.playerId]
    awards[winner.playerId] = { amount: (previous?.amount ?? 0) + (Number(winner.amount) || 0), handDescription: winner.handDescription ?? previous?.handDescription }
  }
  return awards
}
