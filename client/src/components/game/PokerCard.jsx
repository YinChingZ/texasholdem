import styles from './PokerCard.module.css'

const suits = {
  Hearts: { symbol: '♥', name: '红桃', red: true },
  Diamonds: { symbol: '♦', name: '方片', red: true },
  Clubs: { symbol: '♣', name: '梅花', red: false },
  Spades: { symbol: '♠', name: '黑桃', red: false },
}

export default function PokerCard({ card, compact = false, hidden = false }) {
  if (hidden || !card) {
    return <span className={`${styles.card} ${styles.placeholder} ${compact ? styles.compact : ''}`} aria-hidden="true" />
  }

  const suit = suits[card.suit] ?? { symbol: '?', name: card.suit, red: false }
  return (
    <span
      className={`${styles.card} ${suit.red ? styles.red : ''} ${compact ? styles.compact : ''}`}
      aria-label={`${suit.name}${card.rank}`}
    >
      <span>{card.rank}<small>{suit.symbol}</small></span>
      <strong>{suit.symbol}</strong>
    </span>
  )
}
