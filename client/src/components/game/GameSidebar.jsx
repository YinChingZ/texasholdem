import ChatPanel from '../lobby/ChatPanel'
import GameControls from './GameControls'
import styles from './GameSidebar.module.css'

export default function GameSidebar({
  gameState,
  isRoomCreator,
  chat,
  onRequestLeave,
  onRequestClose,
  onRequestEnd,
  onRequestReset,
  onShowLeaderboard,
  onSoundSettings,
}) {
  return (
    <aside className={styles.sidebar} aria-label="聊天和游戏控制">
      <GameControls gameState={gameState} isRoomCreator={isRoomCreator} onRequestLeave={onRequestLeave} onRequestClose={onRequestClose} onRequestEnd={onRequestEnd} onRequestReset={onRequestReset} onShowLeaderboard={onShowLeaderboard} onSoundSettings={onSoundSettings} />
      <div className={styles.chat}><ChatPanel messages={chat.messages} draft={chat.draft} onDraftChange={chat.setDraft} onSend={chat.sendMessage} /></div>
    </aside>
  )
}
