import { Check, Link, MessageCircle, SlidersHorizontal, Spade } from 'lucide-react'
import styles from './GameHeader.module.css'
export default function GameHeader({ roomId, gameState, isSpectator, connectionStatus, unreadCount, onCopyInvite, copySuccess, onOpenChat, onOpenControls }) {
  return <header className={styles.header}>
    <div className={styles.room}><Spade size={19} fill="currentColor" /><strong>{roomId}</strong><span>盲注 {gameState.smallBlind ?? 5}/{gameState.bigBlind ?? 10}</span></div>
    <div className={styles.tools}>
      {!['connected', 'synced'].includes(connectionStatus) && <span className={styles.warning} role="status">连接异常</span>}
      {onCopyInvite && <button type="button" onClick={onCopyInvite} aria-label={copySuccess ? "邀请链接已复制" : "复制邀请链接"} title={copySuccess ? "邀请链接已复制" : "复制邀请链接"}>{copySuccess ? <Check size={20} /> : <Link size={20} />}</button>}
      {isSpectator && <span>旁观</span>}
      <button type="button" onClick={onOpenChat} aria-label={unreadCount ? `聊天，${unreadCount} 条未读` : '聊天'}><MessageCircle size={20} />{unreadCount > 0 && <b>{unreadCount}</b>}</button>
      <button type="button" onClick={onOpenControls} aria-label="牌桌设置"><SlidersHorizontal size={20} /></button>
    </div>
  </header>
}
