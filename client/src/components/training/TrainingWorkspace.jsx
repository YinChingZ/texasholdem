import { useEffect, useState } from 'react'
import TableStage from '../game/TableStage'
import ActionDock from '../game/ActionDock'
import { Button } from '../ui/Primitives'
import ModalDialog from '../ui/ModalDialog'
import ThemeToggle from '../ui/ThemeToggle'
import TrainingReport from './TrainingReport'
import TrainingCoach from './TrainingCoach'
import { saveReport } from '../../services/trainingReports'
import styles from './Training.module.css'

function ObservationEditor({ opponent, state, onCommand, onClose }) {
  const previous = state.training.notes.filter(n => n.playerId === opponent.id).at(-1)
  const [text, setText] = useState(previous?.text || '')
  const [confidence, setConfidence] = useState(previous?.confidence || 'tentative')
  const [hands, setHands] = useState(previous?.hands || [])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const save = async () => {
    setBusy(true)
    const result = await onCommand('saveObservation', { playerId: opponent.id, text, confidence, hands })
    setBusy(false)
    if (result?.ok) onClose()
    else setError(result?.message || '保存未确认，请重试；未关闭你的笔记。')
  }
  return <ModalDialog title={`观察 ${opponent.nickname}`} onClose={onClose} closeLabel="关闭观察笔记" footer={<Button disabled={busy} onClick={save}>保存观察</Button>}>
    <label className={styles.field}>你的判断<textarea maxLength={2000} value={text} onChange={e => setText(e.target.value)} placeholder="例如：翻牌经常下注，转牌容易放弃。依据是什么？" /></label>
    <label className={styles.field}>把握程度<select value={confidence} onChange={e => setConfidence(e.target.value)}><option value="tentative">初步猜测</option><option value="confident">较有把握</option></select></label>
    <fieldset><legend>关联已完成的手牌</legend><div className={styles.tools}>{Array.from({ length: state.training.completed }, (_, i) => i + 1).map(n => <label key={n}><input type="checkbox" checked={hands.includes(n)} onChange={e => setHands(e.target.checked ? [...hands, n] : hands.filter(h => h !== n))} />第 {n} 手</label>)}</div>{!state.training.completed && <p>完成第一手后可关联证据。</p>}</fieldset>
    {error && <p role="alert">{error}</p>}
  </ModalDialog>
}
export default function TrainingWorkspace({ state, privateCards, onCommand, onHome, error }) {
  const [hints, setHints] = useState(true)
  const [opponent, setOpponent] = useState(null)
  const [report, setReport] = useState(null)
  const [saveError, setSaveError] = useState('')
  const [saved, setSaved] = useState(false)
  const [fetchError, setFetchError] = useState('')
  const [retry, setRetry] = useState(0)
  const [confirmEnd, setConfirmEnd] = useState(false)
  const [now, setNow] = useState(Date.now())
  const [clockOffset, setClockOffset] = useState(0)
  useEffect(() => { setClockOffset(state.serverNow - Date.now()) }, [state.serverNow])
  const heroId = state.self.playerId
  const player = state.players.find(p => p.id === heroId)
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 500); return () => clearInterval(timer) }, [])
  useEffect(() => {
    if (state.phase !== 'ENDED') return
    let active = true
    onCommand('getTrainingReport').then(async response => {
      if (!active) return
      if (!response?.report) { setFetchError('报告获取未完成，请重试。'); return }
      setReport(response.report); setFetchError('')
      try { await saveReport(response.report); if (active) setSaved(true) }
      catch (error) { if (active) setSaveError(error.message || '存储不可用') }
    })
    return () => { active = false }
  }, [state.phase, onCommand, retry])
  if (report) return <TrainingReport report={report} saved={saved} saveError={saveError} onBack={onHome} />
  if (state.phase === 'ENDED') return <main className={styles.page}><h1>正在准备观察报告</h1>{fetchError && <p role="alert">{fetchError}</p>}<Button onClick={() => setRetry(retry + 1)}>重新获取报告</Button></main>
  const seconds = Math.max(0, Math.ceil((state.nextHandAt - now - clockOffset) / 1000))
  return <main className={`${styles.page} ${styles.practice}`}>
    <header className={styles.header}><h1>观察练习 · {state.training.completed} / 20 手</h1><ThemeToggle /></header>
    <p>观察三名对手，用具体行动支持判断。盲注 5/10 · 每手重置筹码至 1000 · 不淘汰</p>
    <div className={styles.tools}>
      <Button onClick={() => onCommand(state.paused ? 'resumeGame' : 'pauseGame')}>{state.paused ? '继续练习' : '暂停练习'}</Button>
      <Button variant="ghost" onClick={() => setConfirmEnd(true)}>结束练习</Button>
      <label><input type="checkbox" checked={hints} onChange={e => setHints(e.target.checked)} />规则提示</label>
      {player?.status === 'folded' && !state.training.fast && <Button onClick={() => onCommand('fastForward')}>快速看完</Button>}
    </div>
    {hints && <details className={styles.panel}><summary>规则与观察提示</summary><p>庄家按钮决定行动顺序；小盲与大盲是强制投入，不能作为“主动入池”的证据。跟注补齐当前差额，加注是在跟注之外额外投入。免费过牌不需要投入筹码。</p><p>观察同一对手在不同位置、街道和下注尺度下的行为。一次摊牌只是一个样本；不确定时可以保留判断。</p></details>}
    {error && <p role="alert" className={styles.error}>{error}</p>}
    {state.phase === 'ERROR' && <section className={styles.panel}><p role="alert">练习状态异常，请退出后重新开始。</p><Button onClick={onHome}>返回首页</Button></section>}
    <div className={styles.trainingLayout}><div className={styles.trainingPlay}>
    <TableStage gameState={state} currentUserId={heroId} privateCards={privateCards} livePlayer={player} onInspect={id => setOpponent(state.players.find(p => p.id === id))} />
    {state.paused ? <p role="status">练习已暂停，所有行动已停止。</p> : <ActionDock player={player} gameState={state} onAction={(action, betAmount) => onCommand('playerAction', { action, betAmount })} />}
    {state.nextHandAt && !state.paused && <p role="status">下一手将在 {seconds} 秒后开始</p>}
    {state.endRequested && <p role="status">本手结算后生成报告，请完成剩余行动。</p>}
    </div><TrainingCoach coach={state.training.coach} paused={state.paused} onPause={() => onCommand('pauseGame')} /></div>
    <section className={styles.panel}><h2>对手观察</h2><p>点击头像或姓名记录观察；每次保存都会保留判断变化。</p><div className={styles.tools}>{state.players.filter(p => p.id !== heroId).map(p => <Button key={p.id} variant="ghost" onClick={() => setOpponent(p)}>观察 {p.nickname}</Button>)}</div></section>
    {state.training.pendingPrompt && <section className={styles.panel} aria-label="手间观察提示"><h2>你对哪位对手有了新的判断？依据是哪一手？</h2><p>可通过上方对手入口保存笔记，也可以跳过。此时不会自动开下一手。</p><Button onClick={() => onCommand('dismissObservation')}>完成记录，继续</Button> <Button variant="ghost" onClick={() => onCommand('dismissObservation')}>跳过观察</Button></section>}
    <details className={styles.panel}><summary>公开行动记录</summary>{state.training.history?.map(hand => <details key={hand.number}><summary>第 {hand.number} 手</summary><ol>{hand.events.map((event, i) => <li key={i}>{event.type === 'action' ? `${{PREFLOP:'翻牌前',FLOP:'翻牌',TURN:'转牌',RIVER:'河牌'}[event.before.street]} · ${state.players.find(p => p.id === event.before.playerId)?.nickname}：${{fold:'弃牌',check:'过牌',call:'跟注',raise:'加注',bet:'下注'}[event.action]}，投入 ${event.invested}` : event.type === 'blind' ? `${state.players.find(p => p.id === event.playerId)?.nickname}：强制盲注 ${event.amount}` : `公共牌：${event.cards.map(c => typeof c === 'string' ? c : `${c.rank}${{Hearts:'♥',Diamonds:'♦',Clubs:'♣',Spades:'♠'}[c.suit]}`).join(' ')}`}</li>)}</ol></details>)}</details>
    {state.lastResult && <details className={styles.panel}><summary>查看上一手结果</summary><p>{state.lastResult.winners.map(w => `${w.nickname} 获得 ${w.amount}`).join('，')}</p><p>{state.lastResult.playersHands.map(p => `${p.nickname}：${p.hand.map(c => `${c.rank}${{Hearts:'♥',Diamonds:'♦',Clubs:'♣',Spades:'♠'}[c.suit]}`).join(' ')}（${p.handDescription}）`).join('；') || '未发生多人摊牌，底牌保持隐藏。'}</p><p>弃牌底牌仅在练习结束后的复盘中额外揭示。</p></details>}
    {opponent && <ObservationEditor key={opponent.id} opponent={opponent} state={state} onCommand={onCommand} onClose={() => setOpponent(null)} />}
    {confirmEnd && <ModalDialog title="结束观察练习？" onClose={() => setConfirmEnd(false)} footer={<Button onClick={() => { setConfirmEnd(false); onCommand('endGame') }}>确认结束</Button>}><p>{state.training.completed ? '本手结算后生成报告。若尚有你的行动，请继续完成；暂停状态将解除。' : '尚未完成任何手牌，将直接退出，不生成报告。'}</p></ModalDialog>}
  </main>
}
