import { Coins } from 'lucide-react'
import { useAnimatedNumber } from '../../hooks/useAnimatedNumber'
import { DWELL } from '../../utils/motion'
import PokerCard from './PokerCard'
import styles from './CommunityBoard.module.css'

const phaseCopy = {
  PREFLOP: '翻牌前',
  FLOP: '翻牌',
  TURN: '转牌',
  RIVER: '河牌',
  SHOWDOWN: '摊牌',
  SHOWDOWN_COMPLETE: '本手结束',
  GAME_OVER: '牌局结束',
}

export default function CommunityBoard({ gameState, boardReveal }) {
  const communityCards = gameState.communityCards ?? []
  const totalPot = (gameState.mainPot ?? 0) + (gameState.sidePots ?? []).reduce((sum, pot) => sum + (pot.amount ?? pot ?? 0), 0)
  const displayPot = useAnimatedNumber(totalPot)
  const animateFrom = boardReveal?.animateFrom ?? -1

  return (
    <section className={styles.board} aria-label="公共牌">
      <div className={styles.phase}>{phaseCopy[gameState.gameState] ?? gameState.gameState}</div>
      <div className={styles.cards}>
        {Array.from({ length: 5 }).map((_, index) => {
          const card = communityCards[index]
          const shouldFlip = Boolean(card) && animateFrom >= 0 && index >= animateFrom
          return (
            <PokerCard
              key={`${index}-${card ? 'card' : 'empty'}-${shouldFlip ? boardReveal.token : ''}`}
              card={card}
              hidden={!card}
              animate={shouldFlip ? 'flip' : false}
              delay={shouldFlip ? (index - animateFrom) * DWELL.perStreetCard : 0}
            />
          )
        })}
      </div>
      <div className={styles.pot}>
        <Coins aria-hidden="true" size={17} />
        <span>总奖池</span>
        <strong key={totalPot} className={totalPot > 0 ? styles.potPulse : ''}>{displayPot}</strong>
        {(gameState.sidePots?.length ?? 0) > 0 && <small>含 {gameState.sidePots.length} 个边池</small>}
      </div>
    </section>
  )
}
