import { useState } from 'react'
import { Coins } from 'lucide-react'
import { useAnimatedNumber } from '../../hooks/useAnimatedNumber'
import { DWELL } from '../../utils/motion'
import PokerCard from './PokerCard'
import MobileSheet from '../ui/MobileSheet'
import { formatChips, TABLE_ANCHORS } from './tableLayout'
import styles from './CommunityBoard.module.css'
export default function CommunityBoard({ gameState, boardReveal, layout = TABLE_ANCHORS.desktop }) {
  const [details, setDetails] = useState(false)
  const cards = gameState.communityCards ?? []
  const sidePots = gameState.sidePots ?? []
  const totalPot = (gameState.mainPot ?? 0) + sidePots.reduce((sum, pot) => sum + (pot.amount ?? pot ?? 0), 0)
  const displayPot = useAnimatedNumber(totalPot)
  const animateFrom = boardReveal?.animateFrom ?? -1
  return (<>
    <div className={styles.pot} style={{ left: `${layout.pot.x}%`, top: `${layout.pot.y}%` }}>
      <span>底池</span><strong data-testid="pot-amount">{formatChips(displayPot)}</strong>
      {sidePots.length > 0 && <button onClick={() => setDetails(true)} aria-label="查看边池明细">含 {sidePots.length} 个边池</button>}
    </div>
    <section className={styles.board} aria-label="公共牌" style={{ left: `${layout.board.x}%`, top: `${layout.board.y}%` }}>
      {Array.from({ length: 5 }).map((_, index) => {
        const card = cards[index]
        const flip = Boolean(card) && animateFrom >= 0 && index >= animateFrom
        return <PokerCard key={`${index}-${card ? 'card' : 'empty'}-${flip ? boardReveal.token : ''}`} card={card} hidden={!card} animate={flip ? 'flip' : false} delay={flip ? (index - animateFrom) * DWELL.perStreetCard : 0} />
      })}
    </section>
    <MobileSheet open={details} title="底池明细" onClose={() => setDetails(false)}>
      <div className={styles.details}><p><Coins size={18} />主池 <strong>{formatChips(gameState.mainPot)}</strong></p>{sidePots.map((pot, index) => <p key={index}>边池 {index + 1}<strong>{formatChips(pot.amount ?? pot)}</strong></p>)}</div>
    </MobileSheet>
  </>)
}
