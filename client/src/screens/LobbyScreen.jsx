import { useEffect, useState } from 'react'
import {
  Check,
  Copy,
  Crown,
  DoorOpen,
  Eye,
  EyeOff,
  Lock,
  MessageCircle,
  Settings,
  ShieldCheck,
  Users,
  X,
} from 'lucide-react'
import ChatPanel from '../components/lobby/ChatPanel'
import { Badge, Button, ConfirmDialog, Toast } from '../components/ui/Primitives'
import { useChat } from '../hooks/useChat'
import { useMediaQuery } from '../hooks/useMediaQuery'
import styles from './LobbyScreen.module.css'

const confirmations = {
  leave: {
    title: '离开房间？',
    description: '你将退出当前房间，需要使用房间号才能再次加入。',
    confirmLabel: '确认离开',
  },
  close: {
    title: '关闭房间？',
    description: '房间内所有玩家都会被移出，此操作无法撤销。',
    confirmLabel: '关闭房间',
  },
  spectate: {
    title: '切换为旁观者？',
    description: '切换后你将离开玩家座位，但仍可以观看和聊天。',
    confirmLabel: '开始旁观',
  },
}

function ParticipantList({ players, spectators, creatorId, currentUserId }) {
  return (
    <section className={styles.roster} aria-labelledby="participant-title">
      <header className={styles.sectionHeader}>
        <div>
          <p className={styles.kicker}>参与者</p>
          <h2 id="participant-title">房间名册</h2>
        </div>
        <Badge tone={players.length >= 2 ? 'success' : 'neutral'}>{players.length}/8 玩家</Badge>
      </header>

      <ol className={styles.playerList}>
        {players.map((player, index) => (
          <li key={player.id}>
            <span className={styles.seat}>{String(index + 1).padStart(2, '0')}</span>
            <span className={styles.avatar}>{player.nickname?.slice(0, 1).toUpperCase()}</span>
            <span className={styles.participantName}>
              <strong>{player.nickname}</strong>
              <small>{player.id === currentUserId ? '你' : '玩家'}</small>
            </span>
            {player.id === creatorId && <span className={styles.owner}><Crown size={14} />房主</span>}
            <span className={styles.ready}><Check size={14} />已入座</span>
          </li>
        ))}
        {Array.from({ length: Math.max(0, 2 - players.length) }).map((_, index) => (
          <li className={styles.emptySeat} key={`empty-${index}`}>
            <span className={styles.seat}>{String(players.length + index + 1).padStart(2, '0')}</span>
            <span>等待牌友加入</span>
          </li>
        ))}
      </ol>

      {spectators.length > 0 && (
        <div className={styles.spectators}>
          <Eye aria-hidden="true" size={15} />
          <span>旁观</span>
          {spectators.map((spectator) => <strong key={spectator.id}>{spectator.nickname}</strong>)}
        </div>
      )}
    </section>
  )
}

function HostSettings({ showAllHands, initialChips, chipsValid, onShowAllHandsChange, onInitialChipsChange, onSaveChips }) {
  return (
    <section className={styles.settings} aria-labelledby="settings-title">
      <header className={styles.sectionHeader}>
        <div>
          <p className={styles.kicker}>房主权限</p>
          <h2 id="settings-title"><Settings size={17} />牌局设置</h2>
        </div>
      </header>

      <label className={styles.settingRow}>
        <span>
          <strong>结算时显示所有手牌</strong>
          <small>关闭后只展示获胜者手牌。</small>
        </span>
        <input type="checkbox" checked={showAllHands} onChange={(event) => onShowAllHandsChange(event.target.checked)} />
      </label>

      <div className={styles.settingRow}>
        <label htmlFor="initial-chips">
          <strong>初始筹码</strong>
          <small>{chipsValid ? '允许范围 500–50,000。' : '请输入 500–50,000 之间的数值。'}</small>
        </label>
        <div className={styles.chipControl}>
          <input id="initial-chips" type="number" min="500" max="50000" step="100" value={initialChips} onChange={(event) => onInitialChipsChange(event.target.value)} />
          <Button type="button" variant="ghost" disabled={!chipsValid} onClick={onSaveChips}>保存</Button>
        </div>
      </div>
    </section>
  )
}

export default function LobbyScreen({
  room,
  gameState,
  currentUserId,
  isRoomCreator,
  isSpectator,
  showAllHands,
  initialChips,
  copySuccess,
  onCopyRoomId,
  onShowAllHandsChange,
  onInitialChipsChange,
  onSaveChips,
  onStartGame,
  onLeaveRoom,
  onCloseRoom,
  onSwitchToPlayer,
  onSwitchToSpectator,
}) {
  const players = gameState.players ?? []
  const spectators = gameState.spectators ?? []
  const isCompact = useMediaQuery('(max-width: 900px)')
  const [chatOpen, setChatOpen] = useState(false)
  const [confirmation, setConfirmation] = useState(null)
  const chatVisible = !isCompact || chatOpen
  const chat = useChat(room.id, chatVisible)
  const hasEnoughPlayers = players.length >= 2
  const canStart = isRoomCreator && hasEnoughPlayers
  const parsedChips = Number(initialChips)
  const chipsValid = Number.isFinite(parsedChips) && parsedChips >= 500 && parsedChips <= 50000

  useEffect(() => {
    if (!chatOpen) return undefined
    const onKeyDown = (event) => {
      if (event.key === 'Escape') setChatOpen(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [chatOpen])

  const confirmActions = {
    leave: onLeaveRoom,
    close: onCloseRoom,
    spectate: onSwitchToSpectator,
  }
  const confirmationCopy = confirmation ? confirmations[confirmation] : null

  return (
    <main className={styles.shell}>
      <Toast message={copySuccess ? '房间号已复制，可以发给牌友了。' : ''} />

      <header className={styles.topbar}>
        <div className={styles.brand}>德州扑克 <span>/ 等待大厅</span></div>
        <div className={styles.roomCode}>
          <span>房间</span>
          <strong data-testid="room-code">{room.id}</strong>
          <button type="button" onClick={onCopyRoomId} aria-label="复制房间号">
            {copySuccess ? <Check size={16} /> : <Copy size={16} />}
          </button>
        </div>
        <Badge tone={isRoomCreator ? 'gold' : isSpectator ? 'neutral' : 'success'}>
          {isRoomCreator ? <><Crown size={13} />房主</> : isSpectator ? <><Eye size={13} />旁观者</> : <><ShieldCheck size={13} />玩家</>}
        </Badge>
      </header>

      <div className={styles.layout}>
        <div className={styles.mainColumn}>
          <section className={styles.hero}>
            <div>
              <p className={styles.kicker}>房间已建立</p>
              <h1>{hasEnoughPlayers ? '牌友已到，可以开局' : '正在等待更多牌友'}</h1>
              <p>{isRoomCreator ? '邀请至少一位牌友，准备好后由你开始牌局。' : '房主准备好后将开始牌局，你可以先在聊天区交流。'}</p>
            </div>
            <div className={styles.playerCount}>
              <Users aria-hidden="true" size={20} />
              <strong>{players.length}</strong>
              <span>位玩家</span>
            </div>
          </section>

          <div className={styles.contentGrid}>
            <ParticipantList players={players} spectators={spectators} creatorId={gameState.creator} currentUserId={currentUserId} />
            {isRoomCreator && (
              <HostSettings
                showAllHands={showAllHands}
                initialChips={initialChips}
                chipsValid={chipsValid}
                onShowAllHandsChange={onShowAllHandsChange}
                onInitialChipsChange={onInitialChipsChange}
                onSaveChips={onSaveChips}
              />
            )}
          </div>

          <section className={styles.actions} aria-label="大厅操作">
            <div className={styles.startArea}>
              <Button type="button" disabled={!canStart} onClick={onStartGame}>
                {isRoomCreator ? `开始牌局 · ${players.length} 位` : '等待房主开始'}
              </Button>
              {players.length < 2 && <span>至少需要 2 位玩家。</span>}
            </div>
            <div className={styles.secondaryActions}>
              {isSpectator && !isRoomCreator && <Button variant="secondary" onClick={onSwitchToPlayer}><Users size={16} />加入对局</Button>}
              {!isSpectator && !isRoomCreator && <Button variant="ghost" onClick={() => setConfirmation('spectate')}><Eye size={16} />旁观</Button>}
              <Button variant="ghost" onClick={() => setConfirmation('leave')}><DoorOpen size={16} />退出</Button>
              {isRoomCreator && <Button variant="ghost" onClick={() => setConfirmation('close')}><Lock size={16} />关闭房间</Button>}
            </div>
          </section>
        </div>

        {isCompact && chatOpen && <button className={styles.sheetBackdrop} type="button" aria-label="关闭聊天" onClick={() => setChatOpen(false)} />}
        <aside className={`${styles.chatColumn} ${chatOpen ? styles.chatOpen : ''}`} role={isCompact ? 'dialog' : 'complementary'} aria-modal={isCompact ? 'true' : undefined} aria-label="牌桌聊天">
          <div className={styles.sheetHeader}>
            <strong>牌桌聊天</strong>
            <button type="button" onClick={() => setChatOpen(false)} aria-label="关闭聊天"><X size={20} /></button>
          </div>
          <ChatPanel messages={chat.messages} draft={chat.draft} onDraftChange={chat.setDraft} onSend={chat.sendMessage} />
        </aside>
      </div>

      {isCompact && (
        <button className={styles.mobileChat} type="button" onClick={() => setChatOpen(true)}>
          <MessageCircle size={18} />聊天
          {chat.unreadCount > 0 && <span>{chat.unreadCount}</span>}
        </button>
      )}

      <ConfirmDialog
        open={Boolean(confirmationCopy)}
        title={confirmationCopy?.title}
        description={confirmationCopy?.description}
        confirmLabel={confirmationCopy?.confirmLabel}
        onClose={() => setConfirmation(null)}
        onConfirm={() => {
          confirmActions[confirmation]?.()
          setConfirmation(null)
        }}
      />
    </main>
  )
}
