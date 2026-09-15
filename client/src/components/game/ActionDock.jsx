import { useEffect, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { formatChips } from './tableLayout'
import { soundManager } from '../../utils/soundManager'
import { deriveActionState, getQuickRaiseOptions } from './gameState'
import styles from './ActionDock.module.css'

export default function ActionDock({ player, gameState, isSpectator, onAction }) {
  const actionState = deriveActionState(player, gameState)
  const [raiseOpen, setRaiseOpen] = useState(false)
  const [raiseAmount, setRaiseAmount] = useState(actionState.minRaiseAmount)
  const validRaise = Number.isInteger(raiseAmount) && raiseAmount >= actionState.minRaiseAmount && raiseAmount <= actionState.maxRaiseAmount
  const quickOptions = getQuickRaiseOptions(actionState, gameState?.mainPot ?? 0)

  const act = (action, amount) => {
    soundManager.playClick()
    onAction(action, amount)
  }

  useEffect(() => {
    setRaiseAmount(Math.min(actionState.maxRaiseAmount, actionState.minRaiseAmount))
    if (!actionState.isPlayerTurn) setRaiseOpen(false)
  }, [actionState.isPlayerTurn, actionState.minRaiseAmount, actionState.maxRaiseAmount])

  if (gameState?.self?.agent?.status === 'controlled') return <div className={styles.status}><strong>Agent 正在代打</strong><span>接回操作后可自行出牌。</span></div>

  if (isSpectator) {
    return <div className={styles.status}><strong>旁观模式</strong></div>
  }

  if (!player || gameState?.gameState === 'GAME_OVER') {
    return <div className={styles.status}><strong>本局已结束</strong><span>等待新场次开始。</span></div>
  }

  if (['SHOWDOWN', 'SHOWDOWN_COMPLETE'].includes(gameState?.gameState)) {
    return <div className={styles.status}><strong>{gameState.gameState === 'SHOWDOWN' ? '正在摊牌' : '本手结束'}</strong><span>等待下一手开始</span></div>
  }

  if (player.status === 'all-in') return <div className={styles.status}><strong>你已全押</strong><span>等待本手结算</span></div>

  if (!actionState.isPlayerTurn || player.status === 'folded' || !['PREFLOP', 'FLOP', 'TURN', 'RIVER'].includes(gameState?.gameState)) {
    const activePlayer = gameState.players?.find((item) => item.id === gameState.currentPlayerTurn)
    return (
      <div className={styles.status} data-testid="waiting-action">
        <strong>等待 {activePlayer?.nickname ?? '其他玩家'} 行动</strong>

      </div>
    )
  }

  const middleAction = actionState.canCheck
    ? { label: '过牌', action: 'check' }
    : { label: actionState.isAllInCall ? `全押 ${formatChips(actionState.playerChips)}` : `跟注 ${formatChips(Math.min(actionState.callAmount, actionState.playerChips))}`, action: 'call' }

  return (
    <section className={styles.dock} aria-label="玩家操作">
      <div className={styles.prompt}>
        <span>轮到你行动</span>
        <small>需跟注 {formatChips(Math.min(actionState.callAmount, actionState.playerChips))}</small>
      </div>

      <div className={styles.coreActions}>
        <button className={`${styles.actionButton} ${styles.fold}`} type="button" onClick={() => act('fold')}>弃牌</button>
        <button className={`${styles.actionButton} ${styles.call}`} type="button" onClick={() => act(middleAction.action)}>{middleAction.label}</button>
        <button
          className={`${styles.actionButton} ${styles.raise}`}
          type="button"
          disabled={!actionState.canRaise}
          aria-expanded={raiseOpen}
          onClick={() => { soundManager.playClick(); setRaiseOpen((open) => !open) }}
        >
          加注 <ChevronDown aria-hidden="true" size={15} />
        </button>
      </div>

      {gameState.legalActions?.all_in && !actionState.canRaise && !actionState.isAllInCall && <button className={styles.actionButton} onClick={() => act('all_in')}>全押 {formatChips(actionState.playerChips)}</button>}
      {raiseOpen && actionState.canRaise && (
        <div className={styles.raisePanel}>
          <div className={styles.quickRaises}>
            {quickOptions.map((option) => (
              <button type="button" key={option.amount} onClick={() => setRaiseAmount(option.amount)}>{option.label}<span>{formatChips(option.amount)}</span></button>
            ))}
          </div>
          <label className={styles.numberField}>额外加注
            <input aria-label="额外加注金额" type="number" min={actionState.minRaiseAmount} max={actionState.maxRaiseAmount} step="1" value={raiseAmount} onChange={event => setRaiseAmount(event.target.value === '' ? '' : Number(event.target.value))} />
          </label>
          <label className={styles.slider}>
            <span>额外加注 <strong>{formatChips(raiseAmount)}</strong></span>
            <input
              aria-label="加注金额"
              type="range"
              min={actionState.minRaiseAmount}
              max={Math.max(actionState.minRaiseAmount, actionState.maxRaiseAmount)}
              value={raiseAmount}
              onChange={(event) => setRaiseAmount(Number(event.target.value))}
            />
            <small><span>{formatChips(actionState.minRaiseAmount)}</span><span>{formatChips(actionState.maxRaiseAmount)}</span></small>
          </label>
          <button className={styles.confirmRaise} type="button" disabled={!validRaise} onClick={() => act(gameState.legalActions ? 'raise_to' : 'raise', gameState.legalActions ? actionState.currentBet + raiseAmount : raiseAmount)}>
            确认加注 {formatChips(raiseAmount)}
          </button>
        </div>
      )}
    </section>
  )
}
