import { CircleDollarSign, WifiOff } from 'lucide-react'
import ActionBadge from './ActionBadge'
import PokerCard from './PokerCard'
import { getPlayerRole } from './gameState'
import styles from './PlayerSeat.module.css'

const statusCopy = {
  folded: '已弃牌',
  'all-in': '全押',
  'out-of-chips': '筹码耗尽',
  disconnected: '已离线',
}

export default function PlayerSeat({ placement, players, gameState, actionEvent, revealedCards, isHero }) {
  const { player, seatIndex, x, y } = placement
  const isCurrentTurn = gameState.currentPlayerTurn === player.id
  const isFolded = player.status === 'folded'
  const isOffline = player.connected === false || player.status === 'disconnected'
  const isWinner = actionEvent?.kind === 'win'
  const roles = getPlayerRole(player, players, gameState)
  const stateLabel = statusCopy[player.status] ?? (isCurrentTurn ? '思考中' : '等待')

  return (
    <article
      className={`${styles.seat} ${isCurrentTurn ? styles.current : ''} ${isFolded || isOffline ? styles.dimmed : ''} ${isWinner ? styles.winner : ''}`}
      style={{ '--seat-x': `${x}%`, '--seat-y': `${y}%` }}
      data-seat-index={seatIndex}
      aria-label={`${player.nickname}，${stateLabel}`}
    >
      <ActionBadge event={actionEvent} />
      <div className={styles.identity}>
        <span className={styles.avatar}>{player.nickname?.slice(0, 1).toUpperCase()}</span>
        <span className={styles.name}>
          <strong>{player.nickname}{isHero ? '（你）' : ''}</strong>
          <small>{stateLabel}</small>
        </span>
        {isOffline && <WifiOff aria-label="离线" size={14} />}
      </div>
      <div className={styles.stack}>
        <span><CircleDollarSign aria-hidden="true" size={13} />{player.chips ?? 0}</span>
        {(player.currentBet ?? 0) > 0 && <em>下注 {player.currentBet}</em>}
      </div>
      {roles.length > 0 && <div className={styles.roles}>{roles.map((role) => <span key={role}>{role}</span>)}</div>}
      {!isHero && revealedCards?.length > 0 && (
        <div className={styles.reveal} aria-label={`${player.nickname} 的手牌`}>
          {revealedCards.map((card, index) => (
            <PokerCard key={`${card.suit}-${card.rank}`} card={card} compact animate="flip" delay={index * 140} />
          ))}
        </div>
      )}
    </article>
  )
}
