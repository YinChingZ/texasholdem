import { useEffect, useState } from 'react'
import GlobalMessage from './GlobalMessage'
import HandResult from './HandResult'
import Leaderboard from './Leaderboard'
import SoundSettings from './SoundSettings'
import { ConfirmDialog } from './ui/Primitives'
import { useSocket } from '../contexts/socket-context'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { useGameViewModel } from '../hooks/useGameViewModel'
import { useGlobalMessages } from '../hooks/useGlobalMessages'
import { useTableSequencer } from '../hooks/useTableSequencer'
import ConnectionScreen from '../screens/ConnectionScreen'
import GameScreen from '../screens/GameScreen'
import LobbyScreen from '../screens/LobbyScreen'
import WelcomeScreen from '../screens/WelcomeScreen'

export default function GameTable() {
  const {
    socket,
    gameState,
    privateCards,
    room,
    handResult,
    clearHandResult,
    isRoomCreator,
    isSpectator,
    roomSettings,
    connectionStatus,
    isReconnecting,
    leaveRoom,
    attemptReconnect,
    notices,
    dismissNotice,
  } = useSocket()

  const [nickname, setNickname] = useState('')
  const [roomIdInput, setRoomIdInput] = useState('')
  const [showSoundSettings, setShowSoundSettings] = useState(false)
  const [copySuccess, setCopySuccess] = useState(false)
  const [showLeaderboard, setShowLeaderboard] = useState(false)
  const [showAllHands, setShowAllHands] = useState(true)
  const [initialChips, setInitialChips] = useState(1000)
  const [spectatorRoomId, setSpectatorRoomId] = useState(null)

  const { displayState, displayHandResult, seatEvents, boardReveal, potFlights, revealedHands } = useTableSequencer({
    gameState,
    handResult,
    heroId: socket?.id,
  })
  const { messages, removeMessage } = useGlobalMessages(displayState)
  useDocumentTitle(gameState, socket?.id)

  useEffect(() => {
    const savedNickname = localStorage.getItem('texasholdem_nickname')
    if (savedNickname) setNickname(savedNickname)
  }, [])

  useEffect(() => {
    if (gameState?.gameState === 'GAME_OVER' && gameState.leaderboard) setShowLeaderboard(true)
  }, [gameState])

  useEffect(() => {
    const settings = roomSettings ?? gameState?.settings
    if (typeof settings?.showAllHands === 'boolean') setShowAllHands(settings.showAllHands)
    if (typeof settings?.initialChips === 'number') setInitialChips(settings.initialChips)
  }, [roomSettings, gameState?.settings])

  useEffect(() => {
    if (!socket) return undefined
    const handleGameInProgress = ({ roomId }) => setSpectatorRoomId(roomId)
    socket.on('gameInProgress', handleGameInProgress)
    return () => socket.off('gameInProgress', handleGameInProgress)
  }, [socket, nickname])

  const createRoom = () => {
    if (!nickname) return
    localStorage.setItem('texasholdem_nickname', nickname)
    socket.emit('createRoom', { nickname })
  }

  const joinRoom = () => {
    if (!nickname || !roomIdInput) return
    localStorage.setItem('texasholdem_nickname', nickname)
    socket.emit('joinRoom', { roomId: roomIdInput, nickname })
  }

  const startGame = () => room && socket.emit('startGame', { roomId: room.id })
  const closeRoom = () => room && socket.emit('closeRoom', { roomId: room.id })
  const endGame = () => room && socket.emit('endGame', { roomId: room.id })
  const resetGame = () => {
    if (!room) return
    socket.emit('resetGame', { roomId: room.id })
    setShowLeaderboard(false)
  }
  const switchToPlayer = () => room && socket.emit('switchToPlayer', { roomId: room.id })
  const switchToSpectator = () => room && socket.emit('switchToSpectator', { roomId: room.id })
  const playerAction = (action, betAmount = 0) => room && socket.emit('playerAction', { roomId: room.id, action, betAmount })

  const saveChips = () => {
    const chips = Number.parseInt(initialChips, 10)
    if (room && chips >= 500 && chips <= 50000) socket.emit('updateInitialChips', { roomId: room.id, initialChips: chips })
  }

  const updateSetting = (setting, value) => {
    if (room) socket.emit('updateRoomSettings', { roomId: room.id, settings: { [setting]: value } })
  }

  const copyRoomId = async () => {
    try {
      await navigator.clipboard.writeText(room.id)
      setCopySuccess(true)
      setTimeout(() => setCopySuccess(false), 2000)
    } catch (error) {
      console.error('复制房间号失败', error)
    }
  }

  const viewModel = useGameViewModel({
    room,
    gameState,
    connectionStatus,
    isReconnecting,
    socketId: socket?.id,
    isRoomCreator,
    isSpectator,
  })

  const spectatorDialog = (
    <ConfirmDialog
      open={Boolean(spectatorRoomId)}
      title="牌局正在进行"
      description="这个房间已经开局。你可以旁观牌局并参与聊天，但不能在本局中行动。"
      confirmLabel="以旁观者加入"
      tone="primary"
      onClose={() => setSpectatorRoomId(null)}
      onConfirm={() => {
        socket.emit('joinRoom', { roomId: spectatorRoomId, nickname, asSpectator: true })
        setSpectatorRoomId(null)
      }}
    />
  )

  const noticeToasts = (notices ?? []).map((notice) => (
    <GlobalMessage
      key={`notice-${notice.id}`}
      type="default"
      message={notice.message}
      show
      duration={3200}
      onComplete={() => dismissNotice(notice.id)}
    />
  ))

  const withSpectatorDialog = (screen) => <>{screen}{spectatorDialog}{noticeToasts}</>

  if (viewModel.screen === 'welcome') {
    return withSpectatorDialog(<WelcomeScreen nickname={nickname} roomId={roomIdInput} onNicknameChange={setNickname} onRoomIdChange={setRoomIdInput} onCreateRoom={createRoom} onJoinRoom={joinRoom} />)
  }
  if (viewModel.screen === 'connecting') return withSpectatorDialog(<ConnectionScreen kind="connecting" roomId={room?.id} />)
  if (viewModel.screen === 'reconnecting') return withSpectatorDialog(<ConnectionScreen kind="reconnecting" roomId={room?.id} />)
  if (viewModel.screen === 'disconnected') return withSpectatorDialog(<ConnectionScreen kind="disconnected" roomId={room?.id} onRetry={attemptReconnect} />)

  if (viewModel.screen === 'lobby') {
    return withSpectatorDialog(
      <LobbyScreen
        room={room}
        gameState={gameState}
        currentUserId={socket?.id}
        isRoomCreator={isRoomCreator}
        isSpectator={isSpectator}
        showAllHands={showAllHands}
        initialChips={initialChips}
        copySuccess={copySuccess}
        onCopyRoomId={copyRoomId}
        onShowAllHandsChange={(value) => { setShowAllHands(value); updateSetting('showAllHands', value) }}
        onInitialChipsChange={setInitialChips}
        onSaveChips={saveChips}
        onStartGame={startGame}
        onLeaveRoom={leaveRoom}
        onCloseRoom={closeRoom}
        onSwitchToPlayer={switchToPlayer}
        onSwitchToSpectator={switchToSpectator}
      />
    )
  }

  if (!gameState?.players) return <ConnectionScreen kind="connecting" roomId={room?.id} />

  return (
    <>
      <GameScreen
        room={room}
        gameState={gameState}
        displayState={displayState ?? gameState}
        seatEvents={seatEvents}
        boardReveal={boardReveal}
        potFlights={potFlights}
        revealedHands={revealedHands}
        privateCards={privateCards}
        currentUserId={socket?.id}
        isRoomCreator={isRoomCreator}
        isSpectator={isSpectator}
        connectionStatus={connectionStatus}
        onPlayerAction={playerAction}
        onLeaveRoom={leaveRoom}
        onCloseRoom={closeRoom}
        onEndGame={endGame}
        onResetGame={resetGame}
        onShowLeaderboard={() => setShowLeaderboard(true)}
        onSoundSettings={() => setShowSoundSettings(true)}
      />

      {displayHandResult && (
        <HandResult
          result={displayHandResult}
          socket={socket}
          roomId={room.id}
          gameState={gameState}
          onEndGame={endGame}
          onClose={clearHandResult}
        />
      )}
      {showLeaderboard && gameState.leaderboard && (
        <Leaderboard
          players={gameState.leaderboard}
          isRoomCreator={isRoomCreator}
          onNewGame={resetGame}
          onLeaveRoom={leaveRoom}
          onCloseRoom={closeRoom}
          onClose={() => setShowLeaderboard(false)}
        />
      )}
      <SoundSettings isOpen={showSoundSettings} onClose={() => setShowSoundSettings(false)} />
      {messages.map((message) => (
        <GlobalMessage key={message.id} type={message.type} message={message.message} show={message.show} duration={message.duration} onComplete={() => removeMessage(message.id)} />
      ))}
      {noticeToasts}
      {spectatorDialog}
    </>
  )
}
