import ChipFlight from './ChipFlight'
import CommunityBoard from './CommunityBoard'
import PlayerSeat from './PlayerSeat'
import { arrangePlayers } from './gameState'
import { layoutTable } from './tableLayout'
import { useMediaQuery } from '../../hooks/useMediaQuery'
import styles from './TableStage.module.css'

export default function TableStage({ gameState, seatEvents = {}, boardReveal, potFlights = [], revealedHands = {}, currentUserId, isSpectator, privateCards = [], livePlayer, tableAwards = {}, onInspect }) {
  const players = gameState.players ?? []
  const mobile = useMediaQuery('(max-width: 700px)')
  const landscape = useMediaQuery('(orientation: landscape) and (max-height: 500px) and (min-width: 701px)')
  const anchorId = isSpectator ? gameState.creator : currentUserId
  const layout = layoutTable(arrangePlayers(players, anchorId), mobile, landscape, Object.keys(revealedHands).length > 0)
  return (
    <section className={styles.stage} aria-label={`${players.length} 人牌桌`} data-testid="table-stage" data-players={players.length} data-rows={layout.rows} data-revealed={Object.keys(revealedHands).length > 0}>
      {layout.placements.map(placement => <PlayerSeat onInspect={onInspect} key={placement.player.id} placement={placement} players={players} gameState={gameState} actionEvent={seatEvents[placement.player.id]} revealedCards={revealedHands[placement.player.id]} isHero={!isSpectator && placement.player.id === currentUserId} privateCards={privateCards} livePlayer={livePlayer} award={tableAwards[placement.player.id]} />)}
      {potFlights.map(flight => <ChipFlight key={flight.id} flight={flight} placements={layout.placements} pot={layout.pot} />)}
      <CommunityBoard gameState={gameState} boardReveal={boardReveal} layout={layout} />
    </section>
  )
}
