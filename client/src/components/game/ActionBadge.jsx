import styles from './ActionBadge.module.css'

const COPY = {
  fold: '弃牌',
  check: '过牌',
  call: '跟注',
  bet: '下注',
  raise: '加注',
  allin: '全押',
  win: '赢得底池',
}

// 座位上方的瞬态行动气泡，由排程器的 seatEvents 驱动；key 用 event.id 保证每次动作重播动画
export default function ActionBadge({ event }) {
  if (!event) return null
  return (
    <span key={event.id} className={`${styles.badge} ${styles[event.kind] ?? ''}`} role="status">
      {COPY[event.kind] ?? event.kind}
      {event.amount > 0 && <strong>{event.amount}</strong>}
    </span>
  )
}
