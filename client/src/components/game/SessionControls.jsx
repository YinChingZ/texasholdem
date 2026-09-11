import { useEffect, useState } from 'react'
import { Button } from '../ui/Primitives'
import styles from './SessionControls.module.css'

export default function SessionControls({ gameState, onCommand, onShowLastResult }) {
  const [now, setNow] = useState(Date.now())
  const [offset, setOffset] = useState(0)
  useEffect(() => { setOffset((gameState.serverNow ?? Date.now()) - Date.now()) }, [gameState.serverNow])
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 500); return () => clearInterval(timer) }, [])
  if (!gameState.allowedActions) return null
  const allowed = gameState.allowedActions
  const remaining = deadline => Math.max(0, Math.ceil((deadline - now - offset) / 1000))
  return <section className={styles.bar} aria-label="续局与连接状态">
    <div className={styles.status}>
      {gameState.nextHandAt && <strong>下一手将在 {remaining(gameState.nextHandAt)} 秒后开始</strong>}
      {gameState.turnDeadline && <span>行动剩余 {remaining(gameState.turnDeadline)} 秒</span>}
      {gameState.pauseReason && <strong>{gameState.pauseReason}</strong>}
      {gameState.paused && gameState.turnId && <span>本手结束后暂停</span>}
      {gameState.endRequested && gameState.phase !== 'ENDED' && <span>本手结算后结束本场</span>}
      {gameState.self?.pendingSeat && <span>已申请入座，等待手间空位</span>}
      {gameState.self?.sittingOut && gameState.self?.role === 'player' && <span>你已暂离，下手不会发牌</span>}
    </div>
    <div className={styles.buttons}>
      {allowed.pause && <Button variant="ghost" onClick={() => onCommand('pauseGame')}>暂停续局</Button>}
      {allowed.resume && <Button variant="ghost" onClick={() => onCommand('resumeGame')}>恢复续局</Button>}
      {allowed.nextHand && <Button variant="ghost" onClick={() => onCommand('prepareNextHand')}>立即开始下一手</Button>}
      {allowed.returnToTable && <Button onClick={() => onCommand('returnToTable')}>回到牌桌</Button>}
      {allowed.requestSeat && <Button onClick={() => onCommand('switchToPlayer')}>申请入座</Button>}
      {gameState.lastResult && <Button variant="ghost" onClick={onShowLastResult}>查看上一手</Button>}
    </div>
  </section>
}
