import { useCallback, useState } from 'react'
import { Check, Copy, Crown, DoorOpen, Eye, Lock, MessageCircle, Settings, SlidersHorizontal, Users } from 'lucide-react'
import PlayerAvatar from '../components/ui/PlayerAvatar'
import ChatPanel from '../components/lobby/ChatPanel'
import { Button, ConfirmDialog, Toast } from '../components/ui/Primitives'
import MobileSheet from '../components/ui/MobileSheet'
import ThemeToggle from '../components/ui/ThemeToggle'
import { useChat } from '../hooks/useChat'
import { formatChips } from '../components/game/tableLayout'
import styles from './LobbyScreen.module.css'
const confirmations = {
  leave: { title: '离开房间？', description: '你将退出当前房间，需要使用房间号才能再次加入。', confirmLabel: '确认离开' },
  close: { title: '关闭房间？', description: '房间内所有玩家都会被移出，此操作无法撤销。', confirmLabel: '关闭房间' },
  spectate: { title: '切换为旁观者？', description: '切换后你将离开玩家座位，但仍可以观看和聊天。', confirmLabel: '开始旁观' },
}
function HostSettings({ showAllHands, initialChips, chipsValid, onShowAllHandsChange, onInitialChipsChange, onSaveChips }) {
  return (
    <section className={styles.settings} aria-label="牌局参数">


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

export default function LobbyScreen({ room, gameState, currentUserId, isRoomCreator, isSpectator, showAllHands, initialChips, copySuccess, onCopyRoomId, onShowAllHandsChange, onInitialChipsChange, onSaveChips, onStartGame, onLeaveRoom, onCloseRoom, onSwitchToPlayer, onSwitchToSpectator }) {
  const players = gameState.players ?? []
  const spectators = Object.values(gameState.spectators ?? {})
  const [panel, setPanel] = useState(null)
  const [confirmation, setConfirmation] = useState(null)
  const closePanel = useCallback(() => setPanel(null), [])
  const chat = useChat(room.id, panel === 'chat')
  const chipsValid = Number.isFinite(Number(initialChips)) && Number(initialChips) >= 500 && Number(initialChips) <= 50000
  const confirmActions = { leave: onLeaveRoom, close: onCloseRoom, spectate: onSwitchToSpectator }
  const requestConfirmation = kind => { setPanel(null); setConfirmation(kind) }
  const confirmationCopy = confirmations[confirmation]
  return <main className={styles.shell}>
    <Toast message={copySuccess ? '邀请链接已复制' : ''} />
    <header className={styles.topbar}>
      <strong>德州扑克</strong>
      <div className={styles.tools}>
        <button aria-label={chat.unreadCount ? `聊天，${chat.unreadCount} 条未读` : '聊天'} onClick={() => setPanel('chat')}><MessageCircle size={20} />{chat.unreadCount > 0 && <b>{chat.unreadCount}</b>}</button>
        <button aria-label="房间菜单" onClick={() => setPanel('menu')}><SlidersHorizontal size={20} /></button>
      </div>
    </header>
    <div className={styles.mainColumn}>
      <section className={styles.roomHeading}>
        <div><span>房间号</span><h1 data-testid="room-code">{room.id}</h1></div>
        <Button variant="ghost" onClick={onCopyRoomId} aria-label="复制邀请链接">{copySuccess ? <Check size={18} /> : <Copy size={18} />}复制邀请</Button>
      </section>
      <section className={styles.roster} aria-labelledby="participant-title">
        <header><h2 id="participant-title">玩家 <span>{players.length}/8</span></h2></header>
        <ul className={styles.playerList}>{players.map(player => <li key={player.id}>
          <PlayerAvatar name={player.nickname} className={styles.avatar} />
          <strong title={player.nickname}>{player.nickname}{player.connected === false && <small>离线</small>}{player.id === currentUserId && <small>你</small>}</strong>
          {player.id === gameState.creator && <span className={styles.owner}><Crown size={14} />房主</span>}
        </li>)}</ul>
        {players.length < 2 && <p className={styles.emptySeat}>等待牌友加入</p>}
        {spectators.length > 0 && <div className={styles.spectators}><Eye size={16} /><span>旁观</span>{spectators.map(player => <span key={player.id}>{player.nickname}</span>)}</div>}
      </section>
      <div className={styles.settingsSummary}><span>初始筹码 <strong>{formatChips(gameState.settings?.initialChips ?? initialChips)}</strong></span><span>{showAllHands ? '结算全部亮牌' : '仅赢家亮牌'}</span>{isRoomCreator && <Button variant="ghost" onClick={() => setPanel('settings')}><Settings size={16} />设置</Button>}</div>
      <section className={styles.actions} aria-label="大厅操作">
        <div className={styles.startArea}><Button disabled={gameState.allowedActions ? !gameState.allowedActions.start : !isRoomCreator || players.length < 2} onClick={onStartGame}>{isRoomCreator ? '开始游戏' : '等待房主开始'}</Button>{players.length < 2 && <span>至少需要 2 位玩家</span>}</div>
        {(isSpectator || !isRoomCreator) && (isSpectator ? <Button variant="ghost" onClick={onSwitchToPlayer}><Users size={16} />加入对局</Button> : <Button variant="ghost" onClick={() => requestConfirmation('spectate')}><Eye size={16} />旁观</Button>)}
      </section>
    </div>
    <MobileSheet open={panel === 'chat'} title="牌桌聊天" onClose={closePanel}><ChatPanel messages={chat.messages} draft={chat.draft} onDraftChange={chat.setDraft} onSend={chat.sendMessage} /></MobileSheet>
    <MobileSheet open={panel === 'settings'} title="牌局设置" onClose={closePanel}>{isRoomCreator && <HostSettings showAllHands={showAllHands} initialChips={initialChips} chipsValid={chipsValid} onShowAllHandsChange={onShowAllHandsChange} onInitialChipsChange={onInitialChipsChange} onSaveChips={onSaveChips} />}</MobileSheet>
    <MobileSheet open={panel === 'menu'} title="房间菜单" onClose={closePanel}><div className={styles.menu}><ThemeToggle /><Button variant="ghost" onClick={() => requestConfirmation('leave')}><DoorOpen size={16} />退出</Button>{isRoomCreator && <Button variant="ghost" onClick={() => requestConfirmation('close')}><Lock size={16} />关闭房间</Button>}</div></MobileSheet>
    <ConfirmDialog open={Boolean(confirmationCopy)} title={confirmationCopy?.title} description={confirmationCopy?.description} confirmLabel={confirmationCopy?.confirmLabel} onClose={() => setConfirmation(null)} onConfirm={() => { confirmActions[confirmation]?.(); setConfirmation(null) }} />
  </main>
}
