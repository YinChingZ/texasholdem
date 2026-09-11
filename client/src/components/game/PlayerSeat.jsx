import { Circle, Minus, Trophy, WifiOff, X, Zap } from 'lucide-react'
import { playerPresentation } from './playerPresentation'
import PlayerAvatar from '../ui/PlayerAvatar'
import ActionBadge from './ActionBadge'
import PokerCard from './PokerCard'
import { getPlayerRole } from './gameState'
import { formatChips } from './tableLayout'
import styles from './PlayerSeat.module.css'
const stateIcons = { folded: X, allin: Zap, current: Circle, offline: WifiOff, out: Minus, winner: Trophy }
export default function PlayerSeat({ placement, players, gameState, actionEvent, revealedCards, isHero, privateCards = [], livePlayer, award, onInspect }) {
  const { player: displayPlayer, seatIndex, x, y, bet } = placement
  const player = isHero && livePlayer ? { ...displayPlayer, chips: livePlayer.chips, status: livePlayer.status } : displayPlayer
  const presentation = playerPresentation(player, gameState.currentPlayerTurn, award)
  const { kind, label: stateLabel, offline: isOffline } = presentation
  const StateIcon = stateIcons[kind]
  const roles = getPlayerRole(player, players, gameState)
  const cards = isHero ? privateCards : revealedCards
  return (<>
    <article role={onInspect && !isHero ? 'button' : undefined} tabIndex={onInspect && !isHero ? 0 : undefined} onClick={() => !isHero && onInspect?.(player.id)} onKeyDown={e => { if (!isHero && onInspect && ['Enter', ' '].includes(e.key)) { e.preventDefault(); onInspect(player.id) } }} className={`${styles.seat} ${isHero ? styles.hero : ''} ${styles[kind] ?? ''}`} style={{ left: `${x}%`, top: `${y}%` }} data-player-state={kind} data-columns={placement.columns} data-band={y > 35 && y < 60 ? 'middle' : undefined} data-edge={y < 15 ? 'top' : x < 50 ? 'left' : x > 50 ? 'right' : 'bottom'} data-seat-index={seatIndex} data-player-id={player.id} aria-label={`${player.nickname}，${stateLabel || '等待'}${isOffline && kind !== 'offline' ? '，已离线' : ''}`}>
      {!isHero && !cards?.length && ['in-game', 'all-in'].includes(player.status) && gameState.gameState !== 'SHOWDOWN_COMPLETE'
        ? <div className={styles.coveredHand} aria-hidden="true"><i /><i /></div>
        : <PlayerAvatar name={player.nickname} className={styles.avatar} />}
      <div className={styles.info}>
        <div className={styles.identity}><strong title={player.nickname}>{player.nickname}{isHero ? ' · 你' : ''}</strong>{isOffline && <WifiOff size={12} aria-label="已离线" />}</div>
        <strong className={styles.stack} data-testid="player-stack" aria-label={`${player.nickname} 剩余筹码`}>{formatChips(player.chips)}</strong>
        <span className={styles.state} data-testid="player-status">
          {actionEvent && !award ? <ActionBadge event={actionEvent} /> : <>{StateIcon && <StateIcon size={11} aria-hidden="true" />}{stateLabel}</>}
        </span>
      </div>
      {roles.length > 0 && <div className={styles.roles}>{roles.map(role => <span key={role}>{role}</span>)}</div>}
      {cards?.length > 0 && <div className={`${isHero ? styles.hand : styles.reveal} ${player.status === 'folded' ? styles.foldedCards : ''}`} aria-label={isHero ? '你的手牌' : `${player.nickname} 的手牌`}>
        {cards.map((card, index) => <PokerCard key={`${card.suit}-${card.rank}`} card={card} compact={!isHero} mini={!isHero} animate={isHero ? 'deal' : 'flip'} delay={index * 120} />)}
      </div>}
    </article>
    {(displayPlayer.currentBet ?? 0) > 0 && !(revealedCards?.length && gameState.gameState === 'SHOWDOWN_COMPLETE') && <div className={styles.bet} style={{ left: `${bet.x}%`, top: `${bet.y}%` }} data-testid="seat-bet" aria-label={`${player.nickname} 本轮下注 ${displayPlayer.currentBet}`}><span className={styles.chips} aria-hidden="true"><i /><i /><i /></span><span>{formatChips(displayPlayer.currentBet)}</span></div>}
  </>)
}
