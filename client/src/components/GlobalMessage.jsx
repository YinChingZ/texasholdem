import { useEffect, useState } from 'react'
import { CircleDollarSign, LogOut, MessageCircle, Trophy, Zap } from 'lucide-react'
import styles from './GlobalMessage.module.css'

const messageConfig = {
  allin: { Icon: Zap, label: '全押', tone: 'danger' },
  fold: { Icon: LogOut, label: '弃牌', tone: 'neutral' },
  win: { Icon: Trophy, label: '获胜', tone: 'success' },
  bet: { Icon: CircleDollarSign, label: '下注', tone: 'gold' },
  default: { Icon: MessageCircle, label: '牌桌消息', tone: 'neutral' },
}

export default function GlobalMessage({ message, type = 'default', show, onComplete, duration = 3000 }) {
  const [phase, setPhase] = useState(show ? 'entered' : 'hidden')

  useEffect(() => {
    if (!show || !message) {
      setPhase('hidden')
      return undefined
    }

    setPhase('entered')
    const exitDelay = Math.max(0, duration - 200)
    const exitTimer = window.setTimeout(() => setPhase('exiting'), exitDelay)
    const completeTimer = window.setTimeout(() => {
      setPhase('hidden')
      onComplete?.()
    }, duration)

    return () => {
      window.clearTimeout(exitTimer)
      window.clearTimeout(completeTimer)
    }
  }, [show, message, duration, onComplete])

  if (phase === 'hidden') return null
  const config = messageConfig[type] ?? messageConfig.default
  const { Icon } = config

  return (
    <div className={`${styles.message} ${styles[config.tone]} ${phase === 'exiting' ? styles.exiting : ''}`} role="status" aria-live="polite">
      <span className={styles.icon}><Icon size={19} /></span>
      <span className={styles.copy}><strong>{config.label}</strong><small>{message}</small></span>
    </div>
  )
}
