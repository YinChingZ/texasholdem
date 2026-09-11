import { useState } from 'react'
import { Button } from '../ui/Primitives'
import PokerCard from '../game/PokerCard'
import { parseResultCard } from '../resultModels'
import { downloadReport } from '../../services/trainingReports'
import styles from './Training.module.css'
const actions = { fold: '弃牌', check: '过牌', call: '跟注', bet: '下注', raise: '加注' }
const streets = { PREFLOP: '翻牌前', FLOP: '翻牌', TURN: '转牌', RIVER: '河牌' }
function Cards({ cards = [] }) { return <div className={styles.cards}>{cards.map((raw, i) => <PokerCard key={i} card={parseResultCard(raw)} compact />)}</div> }
function HandReview({ hand, report }) {
  const [step, setStep] = useState(0)
  const [reveal, setReveal] = useState(false)
  const events = hand.events.filter(e => e.type === 'action')
  const event = events[step]
  const name = id => report.players.find(p => p.id === id)?.nickname || id
  const notes = report.notes.filter(n => n.activeHandNumber === hand.number ? n.actionIndex <= step : n.handNumber < hand.number)
  const hero = hand.holes.find(h => h.playerId === report.heroId)
  return <section className={styles.panel} aria-label={`第 ${hand.number} 手复盘`}>
    <h2>第 {hand.number} 手 · 按当时信息回看</h2>
    <p>盲注：{hand.events.filter(e => e.type === 'blind').map(e => `${name(e.playerId)} ${e.amount}`).join('，')}</p>
    <p>你的底牌</p><Cards cards={hero?.hand} />
    {event && <>
      <div className={styles.tools}><Button disabled={step === 0} onClick={() => { setStep(step - 1); setReveal(false) }}>上一步</Button><span>行动 {step + 1} / {events.length}</span><Button disabled={step === events.length - 1} onClick={() => { setStep(step + 1); setReveal(false) }}>下一步</Button></div>
      <p>{streets[event.before.street]} · {name(event.before.playerId)} 行动前：底池 {event.before.pot}，需跟注 {event.before.call}，剩余筹码 {event.before.chips}。</p>
      <p>庄家 {name(event.before.positions.dealer)} · 小盲 {name(event.before.positions.smallBlind)} · 大盲 {name(event.before.positions.bigBlind)}</p>
      <Cards cards={event.before.board} />
      <div className={styles.table}><table><thead><tr><th>玩家</th><th>筹码</th><th>本轮投入</th><th>状态</th></tr></thead><tbody>{event.before.players.map(p => <tr key={p.id}><td>{name(p.id)}</td><td>{p.chips}</td><td>{p.currentBet}</td><td>{{ 'in-game': '在局', folded: '已弃牌', 'all-in': '全押' }[p.status] || p.status}</td></tr>)}</tbody></table></div>
      <ol>{events.slice(0, step + 1).map((e, i) => <li key={i}>{streets[e.before.street]} · {name(e.before.playerId)}：{actions[e.action]}{e.invested > 0 ? `，实际投入 ${e.invested}` : ''}</li>)}</ol>
    </>}
    <details><summary>这个行动前已有的观察记录</summary>{notes.length ? notes.map((n, i) => <p className={styles.note} key={i}>{name(n.playerId)}：{n.text || '空白记录'} · {n.confidence === 'confident' ? '较有把握' : '初步猜测'}</p>) : <p>当时尚无观察记录。</p>}</details>
    <Button onClick={() => setReveal(!reveal)}>{reveal ? '隐藏额外信息' : '揭示底牌与后续结果'}</Button>
    {reveal && <div><p><strong>训练额外揭示</strong>：以下信息在当时不一定可见，不应用来倒推当时判断必然正确或错误。</p><p>最终公共牌</p><Cards cards={hand.result.communityCards} />{hand.holes.filter(h => h.playerId !== report.heroId).map(h => <div key={h.playerId}><p>{name(h.playerId)}</p><Cards cards={h.hand} /></div>)}<p>派彩：{hand.result.winners.map(w => `${name(w.playerId)} ${w.amount}`).join('，')}</p></div>}
  </section>
}
export default function TrainingReport({ report, onBack, saveError, saved }) {
  const [handNumber, setHandNumber] = useState(report.selected[0])
  const hand = report.hands.find(h => h.number === handNumber)
  return <main className={styles.page}>
    <div className={styles.header}><h1>观察练习报告</h1><Button onClick={onBack}>返回首页</Button></div>
    <p>完成 {report.completed} 手 · {new Date(report.finishedAt).toLocaleString()} · 不设总分</p>
    {saveError && <p role="alert" className={styles.error}>报告未能保存到此浏览器：{saveError}。请下载 JSON 留存。</p>}
    {saved && <p role="status">报告已保存在此浏览器。</p>}
    <Button variant="ghost" onClick={() => downloadReport(report)}>下载报告 JSON</Button>
    <p>{report.feedback}</p>
    <div className={styles.grid}>{report.opponents.map(o => <section className={styles.panel} key={o.id}><h2>{o.nickname} · 本场实际行为</h2>{Object.entries(o.metrics).map(([key, m]) => <p key={key}>{{ vpip: '主动入池（按有行动机会的手牌）', raises: '加注（按可加注行动）', folds: '面对下注弃牌（按行动）' }[key]}：{m.opportunities ? `${m.count} / ${m.opportunities}` : '暂无样本'}{m.hands.length > 0 && <span> · 第 {[...new Set(m.hands)].join('、')} 手</span>}</p>)}<details><summary>判断变化</summary>{report.notes.filter(n => n.playerId === o.id).map((n, i) => <div className={styles.note} key={i}><small>完成 {n.handNumber} 手时 · {new Date(n.at).toLocaleTimeString()} · {n.confidence === 'confident' ? '较有把握' : '初步猜测'}</small><p>{n.text || '空白记录'}</p><span>关联手牌：{n.hands.join('、') || '未关联'}</span></div>)}{!report.notes.some(n => n.playerId === o.id) && <p>尚未记录判断。</p>}</details></section>)}</div>
    <h2>重点复盘</h2><div className={styles.tools}>{report.selected.map(n => <Button key={n} onClick={() => setHandNumber(n)} aria-pressed={n === handNumber}>第 {n} 手</Button>)}</div>
    {hand && <HandReview key={hand.handId} hand={hand} report={report} />}
    <details className={styles.panel}><summary>查看预设倾向（短样本可能未体现）</summary>{report.opponents.map(o => <p key={o.id}>{o.nickname}：{o.profile.label}</p>)}<p>策略版本：{report.version}。这些是行为概率倾向，并不决定每次行动；本练习不提供专业最优策略评分。</p></details>
  </main>
}
