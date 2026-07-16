import styles from './PokerCard.module.css'

const suits = {
  Hearts: { symbol: '♥', name: '红桃', red: true },
  Diamonds: { symbol: '♦', name: '方片', red: true },
  Clubs: { symbol: '♣', name: '梅花', red: false },
  Spades: { symbol: '♠', name: '黑桃', red: false },
}

// animate: false | 'flip'（翻面揭示，公共牌）| 'deal'（滑入，发底牌）
export default function PokerCard({ card, compact = false, hidden = false, animate = false, delay = 0 }) {
  if (hidden || !card) {
    return <span className={`${styles.card} ${styles.placeholder} ${compact ? styles.compact : ''}`} aria-hidden="true" />
  }

  const suit = suits[card.suit] ?? { symbol: '?', name: card.suit, red: false }
  const animationClass = animate === 'flip' ? styles.flip : animate === 'deal' ? styles.deal : ''
  return (
    <span
      className={`${styles.card} ${compact ? styles.compact : ''} ${animationClass}`}
      style={delay > 0 ? { '--card-delay': `${delay}ms` } : undefined}
      aria-label={`${suit.name}${card.rank}`}
    >
      <span className={styles.inner}>
        <span className={styles.back} aria-hidden="true" />
        <span className={`${styles.face} ${suit.red ? styles.red : ''}`}>
          <span>{card.rank}<small>{suit.symbol}</small></span>
          <strong>{suit.symbol}</strong>
        </span>
      </span>
    </span>
  )
}
