import { CircleDollarSign, WifiOff } from 'lucide-react'
import { getPlayerRole } from './gameState'
import styles from './PlayerSeat.module.css'

const statusCopy = {
  folded: '已弃牌',
  'all-in': '全押',
  'out-of-chips': '筹码耗尽',
  disconnected: '已离线',
}

export default function PlayerSeat({ placement, players, gameState, isHero }) {
  const { player, seatIndex, x, y } = placement
  const isCurrentTurn = gameState.currentPlayerTurn === player.id
  const isFolded = player.status === 'folded'
  const isOffline = player.connected === false || player.status === 'disconnected'
  const roles = getPlayerRole(player, players, gameState)
  const stateLabel = statusCopy[player.status] ?? (isCurrentTurn ? '思考中' : '等待')

  return (
    <article
      className={`${styles.seat} ${isCurrentTurn ? styles.current : ''} ${isFolded || isOffline ? styles.dimmed : ''}`}
      style={{ '--seat-x': `${x}%`, '--seat-y': `${y}%` }}
      data-seat-index={seatIndex}
      aria-label={`${player.nickname}，${stateLabel}`}
    >
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
    </article>
  )
}
