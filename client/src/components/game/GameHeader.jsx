import { Eye, EyeOff, MessageCircle, Radio, ShieldCheck, SlidersHorizontal } from 'lucide-react'
import { Badge } from '../ui/Primitives'
import styles from './GameHeader.module.css'

const phaseCopy = {
  PREFLOP: '翻牌前', FLOP: '翻牌', TURN: '转牌', RIVER: '河牌', SHOWDOWN: '摊牌', GAME_OVER: '已结束',
}

export default function GameHeader({ roomId, gameState, isSpectator, connectionStatus, unreadCount, onOpenChat, onOpenControls }) {
  const showHands = gameState.settings?.showAllHands !== false
  return (
    <header className={styles.header}>
      <div className={styles.brand}>德州扑克 <span>/ 牌桌</span></div>
      <div className={styles.room}>
        <span>房间</span><strong>{roomId}</strong><i />
        <span>{phaseCopy[gameState.gameState] ?? gameState.gameState}</span>
      </div>
      <div className={styles.statuses}>
        {connectionStatus !== 'connected' && <Badge tone="danger"><Radio size={12} />连接异常</Badge>}
        <Badge tone="neutral">{showHands ? <Eye size={12} /> : <EyeOff size={12} />}{showHands ? '结算亮牌' : '仅赢家亮牌'}</Badge>
        <Badge tone={isSpectator ? 'neutral' : 'success'}>{isSpectator ? <Eye size={12} /> : <ShieldCheck size={12} />}{isSpectator ? '旁观' : '玩家'}</Badge>
      </div>
      <div className={styles.mobileTools}>
        <button type="button" onClick={onOpenChat} aria-label={unreadCount ? `聊天，${unreadCount} 条未读` : '聊天'}>
          <MessageCircle size={18} />
          {unreadCount > 0 && <span>{unreadCount}</span>}
        </button>
        <button type="button" onClick={onOpenControls} aria-label="牌桌设置"><SlidersHorizontal size={18} /></button>
      </div>
    </header>
  )
}
