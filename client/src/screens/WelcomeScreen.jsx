import { Spade } from 'lucide-react'
import { Button, Input } from '../components/ui/Primitives'
import ThemeToggle from '../components/ui/ThemeToggle'
import styles from './WelcomeScreen.module.css'

export default function WelcomeScreen({ nickname, roomId, onNicknameChange, onRoomIdChange, onCreateRoom, onJoinRoom, onCreateTraining, onShowReports, connectionStatus = 'connected', connectionIssue = false, onRetry, error, notice }) {
  const errorCopy = { 'Room not found': '房间不存在，请检查房间号', 'Room is full': '房间已满，请联系房主' }[error] ?? error
  const serviceReady = ['connected', 'synced'].includes(connectionStatus)
  const canCreate = serviceReady && nickname.trim().length > 0
  const canJoin = canCreate && roomId.trim().length > 0
  return (
    <main className={styles.screen}>
      <div className={styles.tools}><ThemeToggle /></div>
      <section className={styles.entry} aria-label="进入牌局">
        <header><Spade size={32} fill="currentColor" /><h1>德州扑克</h1></header>
        <Input id="nickname" label="昵称" autoComplete="nickname" maxLength={20} placeholder="你在牌桌上的名字" value={nickname} onChange={event => onNicknameChange(event.target.value)} />
        <Button disabled={!canCreate} onClick={onCreateTraining} className={styles.fullButton}>观察练习</Button>
        <Button variant="ghost" onClick={onShowReports}>查看练习报告</Button>
        <form onSubmit={event => { event.preventDefault(); if (canCreate) onCreateRoom() }}>
          <Button type="submit" disabled={!canCreate} className={styles.fullButton}>创建新房间</Button>
        </form>
        <div className={styles.divider} aria-hidden="true" />
        <form className={styles.joinForm} onSubmit={event => { event.preventDefault(); if (canJoin) onJoinRoom() }}>
          <Input id="room-id" label="房间号" autoCapitalize="none" autoComplete="off" maxLength={12} placeholder="输入房间号" value={roomId} onChange={event => onRoomIdChange(event.target.value)} />
          <Button type="submit" variant="ghost" disabled={!canJoin}>加入房间</Button>
        </form>
        {!serviceReady && <div className={styles.connection}>
          <p role="status">{connectionIssue ? '暂时无法连接服务，正在自动重试。' : '正在连接服务…'}</p>
          {connectionIssue && onRetry && <Button variant="ghost" onClick={onRetry}>重新连接</Button>}
        </div>}
        {notice && !error && <p className={styles.notice} role="status">{notice}</p>}
        {error && <p className={styles.error} role="alert">{errorCopy}</p>}
      </section>
    </main>
  )
}
