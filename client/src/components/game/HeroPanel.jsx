import { CircleDollarSign, Eye } from 'lucide-react'
import ActionDock from './ActionDock'
import PokerCard from './PokerCard'
import styles from './HeroPanel.module.css'

export default function HeroPanel({ player, privateCards, gameState, isSpectator, onAction }) {
  return (
    <section className={styles.hud} aria-label="本人手牌与操作区">
      <div className={styles.hero}>
        {isSpectator ? (
          <div className={styles.spectator}><Eye size={19} /><span><strong>旁观牌局</strong><small>手牌仅玩家本人可见</small></span></div>
        ) : (
          <>
            <div className={`${styles.cards} ${player?.status === 'folded' ? styles.mucked : ''}`} aria-label="你的手牌">
              {privateCards.map((card, index) => (
                <PokerCard compact card={card} animate="deal" delay={index * 120} key={`${card.suit}-${card.rank}-${index}`} />
              ))}
            </div>
            <div className={styles.heroStats}>
              <span>你的筹码 <strong><CircleDollarSign size={14} />{player?.chips ?? 0}</strong></span>
              <span>本轮下注 <strong>{player?.currentBet ?? 0}</strong></span>
            </div>
          </>
        )}
      </div>
      <ActionDock player={player} gameState={gameState} isSpectator={isSpectator} onAction={onAction} />
    </section>
  )
}
