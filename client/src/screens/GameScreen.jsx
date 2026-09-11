import { useCallback, useState } from 'react'
import SessionControls from '../components/game/SessionControls'
import GameControls from '../components/game/GameControls'
import GameHeader from '../components/game/GameHeader'
import ActionDock from '../components/game/ActionDock'
import TableStage from '../components/game/TableStage'
import ChatPanel from '../components/lobby/ChatPanel'
import MobileSheet from '../components/ui/MobileSheet'
import { ConfirmDialog } from '../components/ui/Primitives'
import { useChat } from '../hooks/useChat'
import styles from './GameScreen.module.css'

const confirmations = {
  leave: { title: '退出牌局？', description: '你将离开当前房间，需要使用房间号才能再次加入。', label: '确认退出' },
  close: { title: '关闭房间？', description: '所有玩家都会被移出，当前未结算手牌将终止，此操作无法撤销。', label: '关闭房间' },
  end: { title: '结束本场牌局？', description: '本手完成结算后结束本场，并显示排行榜。', label: '结束牌局' },
  reset: { title: '开始新牌局？', description: '所有玩家将返回等待状态并重新准备。', label: '开始新牌局' },
}

export default function GameScreen({
  room,
  gameState,
  displayState,
  seatEvents,
  boardReveal,
  potFlights,
  revealedHands,
  tableAwards,
  privateCards,
  currentUserId,
  isRoomCreator,
  isSpectator,
  connectionStatus,
  onPlayerAction,
  onLeaveRoom,
  onCloseRoom,
  onEndGame,
  onResetGame,
  onShowLeaderboard,
  onSoundSettings,
  onShowLastResult,
  onCommand,
}) {
  const tableState = displayState ?? gameState
  const [confirmation, setConfirmation] = useState(null)
  const [mobilePanel, setMobilePanel] = useState(null)
  const closeMobilePanel = useCallback(() => setMobilePanel(null), [])
  const chat = useChat(room.id, mobilePanel === 'chat')
  const player = gameState.players?.find((item) => item.id === currentUserId) ?? null
  const confirmationCopy = confirmation ? confirmations[confirmation] : null
  const actions = { leave: onLeaveRoom, close: onCloseRoom, end: onEndGame, reset: onResetGame }

  const requestConfirmation = (kind) => {
    closeMobilePanel()
    setConfirmation(kind)
  }

  const controls = (
    <GameControls
      gameState={gameState}
      isRoomCreator={isRoomCreator}
      onRequestLeave={() => requestConfirmation('leave')}
      onRequestClose={() => requestConfirmation('close')}
      onRequestEnd={() => requestConfirmation('end')}
      onRequestReset={() => requestConfirmation('reset')}
      onShowLeaderboard={() => { closeMobilePanel(); onShowLeaderboard() }}
      onSoundSettings={() => { closeMobilePanel(); onSoundSettings() }}
      onCommand={onCommand}
    />
  )

  return (
    <main className={`game-main-container ${styles.shell}`}>
      <GameHeader
        roomId={room.id}
        gameState={gameState}
        isSpectator={isSpectator}
        connectionStatus={connectionStatus}
        unreadCount={chat.unreadCount}
        onOpenChat={() => setMobilePanel('chat')}
        onOpenControls={() => setMobilePanel('controls')}
      />
      <div className={styles.body}>
        <div className={styles.playColumn}>
          <TableStage
            gameState={tableState}
            seatEvents={seatEvents}
            boardReveal={boardReveal}
            potFlights={potFlights}
            revealedHands={revealedHands}
            tableAwards={tableAwards}
            currentUserId={currentUserId}
            isSpectator={isSpectator}
            privateCards={privateCards}
            livePlayer={player}
          />
          <SessionControls gameState={gameState} onCommand={onCommand} onShowLastResult={onShowLastResult} />
          <div className={styles.actionArea}><ActionDock player={player} gameState={gameState} isSpectator={isSpectator} onAction={onPlayerAction} /></div>
        </div>

      </div>
      <MobileSheet open={mobilePanel === 'chat'} title="牌桌聊天" onClose={closeMobilePanel}>
        <div className={styles.chatBody}>
        {gameState.currentPlayerTurn === currentUserId && <button className={styles.returnToTable} onClick={closeMobilePanel}>轮到你，返回牌桌</button>}
        <ChatPanel messages={chat.messages} draft={chat.draft} onDraftChange={chat.setDraft} onSend={chat.sendMessage} />
        </div>
      </MobileSheet>
      <MobileSheet open={mobilePanel === 'controls'} title="牌桌设置" onClose={closeMobilePanel}>
        {controls}
      </MobileSheet>
      <ConfirmDialog
        open={Boolean(confirmationCopy)}
        title={confirmationCopy?.title}
        description={confirmationCopy?.description}
        confirmLabel={confirmationCopy?.label}
        onClose={() => setConfirmation(null)}
        onConfirm={() => {
          actions[confirmation]?.()
          setConfirmation(null)
        }}
      />
    </main>
  )
}
