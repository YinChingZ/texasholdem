import ChipFlight from './ChipFlight'
import CommunityBoard from './CommunityBoard'
import PlayerSeat from './PlayerSeat'
import { arrangePlayers } from './gameState'
import styles from './TableStage.module.css'

const playerStateCopy = {
  folded: '已弃牌',
  'all-in': '全押',
  'out-of-chips': '筹码耗尽',
  disconnected: '已离线',
}

export default function TableStage({
  gameState,
  seatEvents = {},
  boardReveal,
  potFlights = [],
  revealedHands = {},
  currentUserId,
  isSpectator,
}) {
  const players = gameState.players ?? []
  const anchorId = isSpectator ? gameState.creator : currentUserId
  const placements = arrangePlayers(players, anchorId)

  return (
    <section className={styles.stage} aria-label={`${players.length} 人牌桌`} data-testid="table-stage">
      <div className={styles.rail} aria-hidden="true" />
      <div className={styles.feltMark} aria-hidden="true"><span>CLUB TABLE</span><small>NO LIMIT HOLD’EM</small></div>
      <div className={styles.mobilePlayers} data-testid="mobile-player-strip">
        {placements.map(({ player }) => (
          <div
            className={`${styles.mobilePlayer} ${gameState.currentPlayerTurn === player.id ? styles.mobileCurrent : ''} ${player.status === 'folded' ? styles.mobileFolded : ''}`}
            key={player.id}
            aria-label={`${player.nickname}，${playerStateCopy[player.status] ?? (gameState.currentPlayerTurn === player.id ? '思考中' : '等待')}`}
          >
            <strong>{player.nickname}{!isSpectator && player.id === currentUserId ? ' · 你' : ''}</strong>
            <span>
              {playerStateCopy[player.status] ?? (gameState.currentPlayerTurn === player.id ? '思考中' : '等待')}
              {' · '}{player.chips ?? 0}{(player.currentBet ?? 0) > 0 ? ` / 注 ${player.currentBet}` : ''}
            </span>
          </div>
        ))}
      </div>
      <div className={styles.desktopSeats}>
        {placements.map((placement) => (
          <PlayerSeat
            key={placement.player.id}
            placement={placement}
            players={players}
            gameState={gameState}
            actionEvent={seatEvents[placement.player.id]}
            revealedCards={revealedHands[placement.player.id]}
            isHero={!isSpectator && placement.player.id === currentUserId}
          />
        ))}
      </div>
      {potFlights.map((flight) => (
        <ChipFlight key={flight.id} flight={flight} placements={placements} />
      ))}
      <CommunityBoard gameState={gameState} boardReveal={boardReveal} />
    </section>
  )
}
