import { useEffect, useState } from 'react'
import { ChevronDown, CircleDollarSign } from 'lucide-react'
import { deriveActionState, getQuickRaiseOptions } from './gameState'
import styles from './ActionDock.module.css'

export default function ActionDock({ player, gameState, isSpectator, onAction }) {
  const actionState = deriveActionState(player, gameState)
  const [raiseOpen, setRaiseOpen] = useState(false)
  const [raiseAmount, setRaiseAmount] = useState(actionState.minRaiseAmount)
  const quickOptions = getQuickRaiseOptions(actionState, gameState?.mainPot ?? 0)

  useEffect(() => {
    setRaiseAmount(Math.min(actionState.maxRaiseAmount, actionState.minRaiseAmount))
    if (!actionState.isPlayerTurn) setRaiseOpen(false)
  }, [actionState.isPlayerTurn, actionState.minRaiseAmount, actionState.maxRaiseAmount])

  if (isSpectator) {
    return <div className={styles.status}><strong>旁观模式</strong><span>你可以观看牌局与参与聊天。</span></div>
  }

  if (!player || gameState?.gameState === 'GAME_OVER') {
    return <div className={styles.status}><strong>本局已结束</strong><span>等待房主开始下一局。</span></div>
  }

  if (!actionState.isPlayerTurn) {
    const activePlayer = gameState.players?.find((item) => item.id === gameState.currentPlayerTurn)
    return (
      <div className={styles.status} data-testid="waiting-action">
        <strong>等待 {activePlayer?.nickname ?? '其他玩家'} 行动</strong>
        <span>最高下注 {actionState.currentBet}，你的筹码 {actionState.playerChips}。</span>
      </div>
    )
  }

  const middleAction = actionState.canCheck
    ? { label: '过牌', action: 'check' }
    : { label: actionState.isAllInCall ? `全押 ${actionState.playerChips}` : `跟注 ${Math.min(actionState.callAmount, actionState.playerChips)}`, action: 'call' }

  return (
    <section className={styles.dock} aria-label="玩家操作">
      <div className={styles.prompt}>
        <span>轮到你行动</span>
        <small>最高下注 {actionState.currentBet}</small>
      </div>

      <div className={styles.coreActions}>
        <button className={`${styles.actionButton} ${styles.fold}`} type="button" onClick={() => onAction('fold')}>弃牌</button>
        <button className={`${styles.actionButton} ${styles.call}`} type="button" onClick={() => onAction(middleAction.action)}>{middleAction.label}</button>
        <button
          className={`${styles.actionButton} ${styles.raise}`}
          type="button"
          disabled={!actionState.canRaise}
          aria-expanded={raiseOpen}
          onClick={() => setRaiseOpen((open) => !open)}
        >
          加注 <ChevronDown aria-hidden="true" size={15} />
        </button>
      </div>

      {raiseOpen && actionState.canRaise && (
        <div className={styles.raisePanel}>
          <div className={styles.quickRaises}>
            {quickOptions.map((option) => (
              <button type="button" key={option.amount} onClick={() => setRaiseAmount(option.amount)}>{option.label}<span>{option.amount}</span></button>
            ))}
          </div>
          <label className={styles.slider}>
            <span>加注金额 <strong><CircleDollarSign size={14} />{raiseAmount}</strong></span>
            <input
              aria-label="加注金额"
              type="range"
              min={actionState.minRaiseAmount}
              max={Math.max(actionState.minRaiseAmount, actionState.maxRaiseAmount)}
              value={raiseAmount}
              onChange={(event) => setRaiseAmount(Number(event.target.value))}
            />
            <small><span>{actionState.minRaiseAmount}</span><span>{actionState.maxRaiseAmount}</span></small>
          </label>
          <button className={styles.confirmRaise} type="button" onClick={() => onAction('raise', raiseAmount)}>
            确认加注 {raiseAmount}
          </button>
        </div>
      )}
    </section>
  )
}
