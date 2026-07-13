import { DoorOpen, Lock, RotateCcw, Settings, Trophy } from 'lucide-react'
import { Button } from '../ui/Primitives'
import styles from './GameControls.module.css'

export default function GameControls({
  gameState,
  isRoomCreator,
  onRequestLeave,
  onRequestClose,
  onRequestEnd,
  onRequestReset,
  onShowLeaderboard,
  onSoundSettings,
}) {
  const isGameOver = gameState.gameState === 'GAME_OVER'

  return (
    <section className={styles.controls} aria-label="牌桌控制">
      <header><span>牌桌控制</span><small>{gameState.players?.length ?? 0}/8 玩家</small></header>
      <div className={styles.grid}>
        <Button variant="ghost" onClick={onSoundSettings}><Settings size={16} />音效设置</Button>
        <Button variant="ghost" onClick={onRequestLeave}><DoorOpen size={16} />退出牌局</Button>
        {isRoomCreator && !isGameOver && <Button variant="ghost" onClick={onRequestEnd}><Trophy size={16} />结束牌局</Button>}
        {isRoomCreator && isGameOver && <Button variant="secondary" onClick={onRequestReset}><RotateCcw size={16} />新牌局</Button>}
        {isGameOver && <Button variant="ghost" onClick={onShowLeaderboard}><Trophy size={16} />排行榜</Button>}
        {isRoomCreator && <Button variant="ghost" onClick={onRequestClose}><Lock size={16} />关闭房间</Button>}
      </div>
    </section>
  )
}
