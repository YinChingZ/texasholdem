import { createInviteLink, readInviteRoom } from '../utils/roomInvite'
import TrainingWorkspace from './training/TrainingWorkspace'
import ReportLibrary from './training/ReportLibrary'
import { useCallback, useEffect, useRef, useState } from 'react'
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
    playerId,
    recoveryVersion,
    showLastResult,
    takeover,
    returnHome,
    roomSettings,
    connectionStatus,
    hasSessionTarget,
    entryConnectionIssue,
    isReconnecting,
    leaveRoom,
    attemptReconnect,
    notices,
    dismissNotice,
    error,
    clearError,
  } = useSocket()

  const [showReports, setShowReports] = useState(false)
  const trainingCommand = useCallback((event, payload = {}) => socket.emit(event, { roomId: room?.id, ...payload }), [socket, room?.id])
  const [nickname, setNickname] = useState('')
  const [roomIdInput, setRoomIdInput] = useState(() => readInviteRoom(window.location.href))
  const [showSoundSettings, setShowSoundSettings] = useState(false)
  const [copySuccess, setCopySuccess] = useState(false)
  const [showLeaderboard, setShowLeaderboard] = useState(false)
  const leaderboardSessionRef = useRef(null)
  const [showAllHands, setShowAllHands] = useState(true)
  const [initialChips, setInitialChips] = useState(1000)
  const [spectatorRoomId, setSpectatorRoomId] = useState(null)

  const { displayState, displayHandResult, seatEvents, boardReveal, potFlights, revealedHands, tableAwards } = useTableSequencer({
    gameState,
    handResult,
    heroId: playerId ?? socket?.id,
    recoveryVersion,
  })
  const { messages, removeMessage } = useGlobalMessages(displayState)
  useDocumentTitle(gameState, playerId ?? socket?.id)

  useEffect(() => {
    const savedNickname = localStorage.getItem('texasholdem_nickname')
    if (savedNickname) setNickname(savedNickname)
  }, [])

  useEffect(() => {
    const session = gameState?.sessionId ?? 'preview'
    if (gameState?.gameState === 'GAME_OVER' && gameState.leaderboard && !handResult && leaderboardSessionRef.current !== session) {
      leaderboardSessionRef.current = session
      setShowLeaderboard(true)
    }
    if (gameState?.gameState !== 'GAME_OVER') leaderboardSessionRef.current = null
  }, [gameState, handResult])

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

  const clearEntryNotices = () => {
    clearError?.()
    for (const notice of notices ?? []) dismissNotice(notice.id)
  }

  const createRoom = () => {
    clearEntryNotices()
    if (!nickname) return
    localStorage.setItem('texasholdem_nickname', nickname)
    socket.emit('createRoom', { nickname })
  }

  const joinRoom = () => {
    clearEntryNotices()
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
      await navigator.clipboard.writeText(createInviteLink(window.location.href, room.id))
      setCopySuccess(true)
      setTimeout(() => setCopySuccess(false), 2000)
    } catch {
      window.prompt('请手动复制邀请链接', createInviteLink(window.location.href, room.id))
    }
  }

  const viewModel = useGameViewModel({
    room,
    gameState,
    connectionStatus,
    hasSessionTarget,
    isReconnecting,
    socketId: playerId ?? socket?.id,
    isRoomCreator,
    isSpectator,
    playerId,
    recoveryVersion,
    showLastResult,
    takeover,
    returnHome,
  })

  const spectatorDialog = (
    <ConfirmDialog
      open={Boolean(spectatorRoomId)}
      title="牌局正在进行"
      description="这个房间已经开局。你可以先旁观，在两手之间申请入座。"
      confirmLabel="以旁观者加入"
      tone="primary"
      onClose={() => setSpectatorRoomId(null)}
      onConfirm={() => {
        socket.emit('joinRoom', { roomId: spectatorRoomId, nickname, asSpectator: true })
        setSpectatorRoomId(null)
      }}
    />
  )

  const noticeToasts = (viewModel.screen === 'welcome' ? [] : notices ?? []).map((notice) => (
    <GlobalMessage
      key={`notice-${notice.id}`}
      type="default"
      message={notice.message}
      show
      duration={3200}
      onComplete={() => dismissNotice(notice.id)}
    />
  ))

  const errorToast = error && viewModel.screen !== 'welcome' ? <GlobalMessage key={`error-${error}`} type="default" message={error} show duration={5000} onComplete={() => clearError?.()} /> : null
  const withSpectatorDialog = (screen) => <>{screen}{spectatorDialog}{noticeToasts}{errorToast}</>

  if (viewModel.screen === 'welcome' && showReports) return <ReportLibrary onBack={() => setShowReports(false)} />
  if (viewModel.screen === 'welcome') {
    return withSpectatorDialog(<WelcomeScreen nickname={nickname} roomId={roomIdInput} onNicknameChange={value => { clearEntryNotices(); setNickname(value) }} onRoomIdChange={value => { clearEntryNotices(); setRoomIdInput(value) }} onCreateTraining={() => { clearEntryNotices(); localStorage.setItem('texasholdem_nickname', nickname); socket.emit('createTraining', { nickname }) }} onShowReports={() => setShowReports(true)} onCreateRoom={createRoom} onJoinRoom={joinRoom} connectionStatus={connectionStatus} connectionIssue={entryConnectionIssue} onRetry={attemptReconnect} error={error} notice={notices?.at(-1)?.message} />)
  }
  if (['in-use', 'replaced', 'expired', 'protocol-error'].includes(connectionStatus)) return withSpectatorDialog(<ConnectionScreen kind={connectionStatus} roomId={room?.id} onTakeover={takeover} onHome={returnHome} />)
  if (viewModel.screen === 'connecting') return withSpectatorDialog(<ConnectionScreen kind="connecting" roomId={room?.id} onHome={returnHome} />)
  if (viewModel.screen === 'reconnecting') return withSpectatorDialog(<ConnectionScreen kind="reconnecting" roomId={room?.id} onHome={returnHome} />)
  if (viewModel.screen === 'disconnected') return withSpectatorDialog(<ConnectionScreen kind="disconnected" roomId={room?.id} onRetry={attemptReconnect} onHome={returnHome} />)

  if (gameState?.mode === 'training') return <TrainingWorkspace key={gameState.sessionId} state={gameState} privateCards={privateCards} onCommand={trainingCommand} onHome={leaveRoom} error={error} />

  if (viewModel.screen === 'lobby') {
    return withSpectatorDialog(
      <LobbyScreen
        room={room}
        gameState={gameState}
        currentUserId={playerId ?? socket?.id}
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

  if (!gameState?.players) return <ConnectionScreen kind="connecting" roomId={room?.id} onHome={returnHome} />

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
        tableAwards={tableAwards}
        privateCards={privateCards}
        currentUserId={playerId ?? socket?.id}
        isRoomCreator={isRoomCreator}
        isSpectator={isSpectator}
        connectionStatus={connectionStatus}
        onCopyInvite={copyRoomId}
        copySuccess={copySuccess}
        onPlayerAction={playerAction}
        onLeaveRoom={leaveRoom}
        onCloseRoom={closeRoom}
        onEndGame={endGame}
        onResetGame={resetGame}
        onShowLeaderboard={() => setShowLeaderboard(true)}
        onSoundSettings={() => setShowSoundSettings(true)}
        onShowLastResult={showLastResult}
        onCommand={(event, payload = {}) => socket.emit(event, { roomId: room.id, ...payload })}
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
      {errorToast}
      {spectatorDialog}
    </>
  )
}
