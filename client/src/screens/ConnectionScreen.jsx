import { Button } from '../components/ui/Primitives'
import { Icon } from '../components/ui/Icon'
import styles from './ConnectionScreen.module.css'

const content = {
  connecting: { icon: 'loader', title: '连接房间中', description: '正在连接服务并同步牌桌，请稍候。' },
  reconnecting: { icon: 'loader', title: '正在重新连接', description: '正在恢复身份与当前牌局，未收到响应时会自动重试。' },
  disconnected: { icon: 'offline', title: '牌桌暂时离线', description: '请检查网络连接，系统也会继续尝试恢复会话。' },
  'in-use': { icon: 'offline', title: '此身份正在其他页面使用', description: '原页面保留操作权。选择接管后，原页面会停止操作。' },
  replaced: { icon: 'offline', title: '已在其他页面接管', description: '此页面已停止操作，不会自动争抢连接。' },
  expired: { icon: 'offline', title: '房间或身份已失效', description: '房间可能已关闭或服务已重启。请返回首页重新加入。' },
  'protocol-error': { icon: 'offline', title: '游戏已更新', description: '请刷新页面以使用最新版本。' },
}
export default function ConnectionScreen({ kind = 'connecting', roomId, onRetry, onHome, onTakeover }) {
  const state = content[kind] ?? content.connecting
  const isLoading = ['connecting', 'reconnecting'].includes(kind)
  return <main className={styles.screen}><section className={styles.status} aria-live="polite">
    <div className={`${styles.icon} ${isLoading ? styles.spinning : ''}`}><Icon name={state.icon} size={30} /></div>
    <h1>{state.title}</h1><p className={styles.description}>{state.description}</p>
    {roomId && <p className={styles.room}>房间 <strong>{roomId}</strong></p>}
    {kind === 'disconnected' && onRetry && <Button variant="ghost" onClick={onRetry}>重新连接</Button>}
    {kind === 'in-use' && onTakeover && <Button onClick={onTakeover}>接管此身份</Button>}
    {kind === 'protocol-error' && <Button onClick={() => window.location.reload()}>刷新页面</Button>}
    {onHome && <Button variant="ghost" onClick={onHome}>返回首页</Button>}
  </section></main>
}
