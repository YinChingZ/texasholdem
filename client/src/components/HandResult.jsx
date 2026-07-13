import { Crown, Eye, LockKeyhole, Trophy } from 'lucide-react'
import { useSocket } from '../contexts/socket-context'
import PokerCard from './game/PokerCard'
import ModalDialog from './ui/ModalDialog'
import { Button } from './ui/Primitives'
import { parseResultCard } from './resultModels'
import styles from './HandResult.module.css'

function CardRow({ cards, compact = false, label }) {
  const parsed = (Array.isArray(cards) ? cards : []).map(parseResultCard).filter(Boolean)
  if (!parsed.length) return null
  return (
    <div className={styles.cardGroup}>
      {label && <span className={styles.cardLabel}>{label}</span>}
      <div className={styles.cards}>
        {parsed.map((card, index) => <PokerCard key={`${card.rank}-${card.suit}-${index}`} card={card} compact={compact} />)}
      </div>
    </div>
  )
}

export default function HandResult({ result, socket, roomId, onClose, gameState, onEndGame }) {
  const { isRoomCreator } = useSocket()
  if (!result) return null

  const winners = Array.isArray(result.winners) ? result.winners : []
  const playersHands = Array.isArray(result.playersHands) ? result.playersHands : []
  const rankedPlayers = Array.isArray(result.handComparison?.rankedPlayers) ? result.handComparison.rankedPlayers : []
  const playersWithChips = gameState?.players?.filter((player) => player.chips > 0).length ?? 0
  const onlyOnePlayerLeft = playersWithChips <= 1
  const totalAwarded = winners.reduce((total, winner) => total + (Number(winner.amount) || 0), 0)

  const continueGame = () => {
    if (socket && roomId) socket.emit('prepareNextHand', { roomId })
    onClose()
  }

  const endGame = () => {
    onClose()
    onEndGame?.()
  }

  const footer = isRoomCreator ? (
    <>
      <Button variant="ghost" onClick={onClose}>返回牌桌</Button>
      <Button variant="danger" onClick={endGame}>结束游戏</Button>
      {!onlyOnePlayerLeft && <Button onClick={continueGame}>开始下一手</Button>}
    </>
  ) : (
    <>
      <span className={styles.waiting}>等待房主开始下一手</span>
      <Button variant="ghost" onClick={onClose}>返回牌桌</Button>
    </>
  )

  return (
    <ModalDialog
      title="本手结算"
      eyebrow="Showdown"
      description={totalAwarded ? `本手共结算 ${totalAwarded.toLocaleString('zh-CN')} 筹码` : '本手牌局已经结束'}
      size="large"
      closeLabel="关闭本手结算"
      onClose={onClose}
      footer={footer}
    >
      <div className={styles.layout}>
        <section className={styles.board} aria-labelledby="result-board-title">
          <div className={styles.sectionHeading}>
            <h3 id="result-board-title">公共牌</h3>
            <span>{result.communityCards?.length ?? 0}/5</span>
          </div>
          <CardRow cards={result.communityCards} />
        </section>

        <section className={styles.winners} aria-labelledby="result-winners-title">
          <div className={styles.sectionHeading}>
            <h3 id="result-winners-title"><Trophy size={17} />获胜者</h3>
            <span>{winners.length} 人</span>
          </div>
          <div className={styles.winnerList}>
            {winners.map((winner, index) => (
              <article className={styles.winner} key={`${winner.playerId}-${index}`}>
                <Crown size={19} aria-hidden="true" />
                <div>
                  <strong>{winner.nickname || `玩家 ${winner.playerId}`}</strong>
                  <span>{winner.handDescription || '赢得本手'}</span>
                  {winner.potLabel && <small>{winner.potLabel}</small>}
                </div>
                {winner.amount != null && <b>+{Number(winner.amount).toLocaleString('zh-CN')}</b>}
              </article>
            ))}
          </div>
        </section>
      </div>

      {result.showAllHands === false && (
        <div className={styles.privacyNote} role="note">
          <LockKeyhole size={17} />
          <span><strong>其余手牌已隐藏</strong>房主设置为只公开获胜者手牌。</span>
        </div>
      )}

      {playersHands.length > 0 && (
        <section className={styles.hands} aria-labelledby="player-hands-title">
          <div className={styles.sectionHeading}>
            <h3 id="player-hands-title"><Eye size={17} />摊牌明细</h3>
            <span>{playersHands.length} 位玩家</span>
          </div>
          <div className={styles.handGrid}>
            {playersHands.map((playerHand, index) => {
              const ranking = rankedPlayers.find((player) => player.playerId === playerHand.playerId)
              return (
                <article className={`${styles.playerHand} ${playerHand.isWinner ? styles.winningHand : ''}`} key={`${playerHand.playerId}-${index}`}>
                  <header>
                    <div>
                      <strong>{playerHand.nickname || `玩家 ${playerHand.playerId}`}</strong>
                      <span>{playerHand.handDescription || ranking?.handDescription || '未显示牌型'}</span>
                    </div>
                    {(playerHand.rank || ranking?.rank) && <b>#{playerHand.rank || ranking.rank}</b>}
                  </header>
                  <CardRow cards={playerHand.hand} compact label="底牌" />
                  <CardRow cards={playerHand.bestCards?.slice(0, 5)} compact label="最佳组合" />
                </article>
              )
            })}
          </div>
        </section>
      )}
    </ModalDialog>
  )
}
