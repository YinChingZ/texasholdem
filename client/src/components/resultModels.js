const suitMapping = {
  h: 'Hearts',
  d: 'Diamonds',
  c: 'Clubs',
  s: 'Spades',
}

export function parseResultCard(card) {
  if (typeof card === 'string' && card.length >= 2) {
    const suitKey = card.slice(-1).toLowerCase()
    return { rank: card.slice(0, -1), suit: suitMapping[suitKey] ?? 'Spades' }
  }
  if (card && typeof card === 'object' && card.rank && card.suit) {
    return { rank: card.rank, suit: card.suit }
  }
  return null
}

export function rankPlayers(players = []) {
  return [...players].sort((a, b) => (Number(b.chips) || 0) - (Number(a.chips) || 0))
}
