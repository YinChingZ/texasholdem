import { Button } from '../components/ui/Primitives'
import { Icon } from '../components/ui/Icon'
import styles from './ConnectionScreen.module.css'

const content = {
  connecting: {
    icon: 'loader',
    eyebrow: '正在入座',
    title: '连接房间中',
    description: '正在同步牌桌和玩家状态，请稍候。',
  },
  reconnecting: {
    icon: 'loader',
    eyebrow: '会话恢复',
    title: '正在重新连接',
    description: '我们正在恢复你的座位与当前牌局。',
  },
  disconnected: {
    icon: 'offline',
    eyebrow: '连接中断',
    title: '牌桌暂时离线',
    description: '请检查网络连接，系统也会继续尝试恢复会话。',
  },
}

export default function ConnectionScreen({ kind = 'connecting', roomId, onRetry }) {
  const state = content[kind] ?? content.connecting
  const isLoading = kind !== 'disconnected'

  return (
    <main className={styles.screen}>
      <section className={styles.status} aria-live="polite">
        <div className={`${styles.icon} ${isLoading ? styles.spinning : ''}`}>
          <Icon name={state.icon} size={30} />
        </div>
        <p className={styles.eyebrow}>{state.eyebrow}</p>
        <h1>{state.title}</h1>
        <p className={styles.description}>{state.description}</p>
        {roomId && <p className={styles.room}>房间 <strong>{roomId}</strong></p>}
        {kind === 'disconnected' && onRetry && (
          <Button variant="ghost" onClick={onRetry}>重新连接</Button>
        )}
      </section>
    </main>
  )
}
