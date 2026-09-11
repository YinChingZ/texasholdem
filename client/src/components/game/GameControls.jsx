import { DoorOpen, Lock, RotateCcw, Settings, Trophy } from 'lucide-react'
import { Button } from '../ui/Primitives'
import styles from './GameControls.module.css'
import ThemeToggle from '../ui/ThemeToggle'

export default function GameControls({
  gameState,
  isRoomCreator,
  onRequestLeave,
  onRequestClose,
  onRequestEnd,
  onRequestReset,
  onShowLeaderboard,
  onSoundSettings,
  onCommand,
}) {
  const isGameOver = gameState.gameState === 'GAME_OVER'

  return (
    <section className={styles.controls} aria-label="牌桌控制">
      <p className={styles.rule}>{gameState.settings?.showAllHands !== false ? '结算显示所有手牌' : '结算仅显示赢家手牌'}</p>
      <div className={styles.grid}>
        <ThemeToggle />
        <Button variant="ghost" onClick={onSoundSettings}><Settings size={16} />音效设置</Button>
        <Button variant="ghost" onClick={onRequestLeave}><DoorOpen size={16} />退出牌局</Button>
        {isRoomCreator && !isGameOver && <Button variant="ghost" onClick={onRequestEnd}><Trophy size={16} />结束牌局</Button>}
        {isRoomCreator && (isGameOver || gameState.phase === 'ERROR') && <Button variant="secondary" onClick={onRequestReset}><RotateCcw size={16} />新牌局</Button>}
        {isGameOver && <Button variant="ghost" onClick={onShowLeaderboard}><Trophy size={16} />排行榜</Button>}
        {gameState.allowedActions?.releaseSeat && gameState.members?.filter(member => member.role === 'player' && !member.connected).map(member => <Button key={member.id} variant="ghost" onClick={() => onCommand('releaseSeat', { playerId: member.id })}>释放 {member.nickname} 的座位</Button>)}
        {isRoomCreator && <Button variant="ghost" onClick={onRequestClose}><Lock size={16} />关闭房间</Button>}
      </div>
    </section>
  )
}
