import { MessageCircle, SlidersHorizontal, Spade } from 'lucide-react'
import styles from './GameHeader.module.css'
export default function GameHeader({ roomId, gameState, isSpectator, connectionStatus, unreadCount, onOpenChat, onOpenControls }) {
  return <header className={styles.header}>
    <div className={styles.room}><Spade size={19} fill="currentColor" /><strong>{roomId}</strong><span>盲注 {gameState.smallBlind ?? 5}/{gameState.bigBlind ?? 10}</span></div>
    <div className={styles.tools}>
      {connectionStatus !== 'connected' && <span className={styles.warning}>连接异常</span>}
      {isSpectator && <span>旁观</span>}
      <button type="button" onClick={onOpenChat} aria-label={unreadCount ? `聊天，${unreadCount} 条未读` : '聊天'}><MessageCircle size={20} />{unreadCount > 0 && <b>{unreadCount}</b>}</button>
      <button type="button" onClick={onOpenControls} aria-label="牌桌设置"><SlidersHorizontal size={20} /></button>
    </div>
  </header>
}
