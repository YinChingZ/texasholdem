import { useState } from 'react'
import styles from './Training.module.css'
const streets = { PREFLOP: '翻牌前', FLOP: '翻牌', TURN: '转牌', RIVER: '河牌' }
function Analysis({ value }) {
  return <>
    <p><strong>{streets[value.street]} · {value.handLabel}</strong></p>
    <ul>{value.insights.map((text, index) => <li key={index}>{text}</li>)}</ul>
    <p className={styles.coachQuestion}>{value.prompt}</p>
    <details><summary>对手证据（仅使用此前公开行动）</summary>{value.evidence.map(e => <p key={e.playerId}><strong>{e.name}：</strong>{e.text}</p>)}</details>
  </>
}
export default function TrainingCoach({ coach, paused, onPause }) {
  const [enabled, setEnabled] = useState(true)
  return <section className={`${styles.panel} ${styles.coach}`} aria-label="实时教练">
    <div className={styles.header}><h2>实时教练</h2><label><input type="checkbox" checked={enabled} onChange={e => setEnabled(e.target.checked)} />开启实时反馈</label></div>
    {enabled && <>
      <p className={styles.coachIntro}>先自己判断，行动后看解释。分析只依据当时可见信息，不代替你作决定。</p>
      {coach?.latest ? <article aria-label="最近一次行动反馈">
        <p aria-live="polite"><strong>第 {coach.latest.handNumber} 手 · {streets[coach.latest.street]} · 你选择了{coach.latest.actionLabel}</strong></p>
        <p className={styles.takeaway}>{coach.latest.takeaway}</p>
        <details key={`${coach.latest.handNumber}-${coach.latest.actionIndex}`}><summary>展开这次决定的依据</summary><Analysis value={coach.latest} /></details>
      </article> : <p>完成你的第一次行动后，这里会解释成本、机会与下次值得检查的地方。</p>}
      {coach?.current && <details className={styles.beforeAdvice}><summary>行动前提示：查看当前局面</summary><Analysis value={coach.current} /></details>}
      {!paused && <button type="button" className={styles.pauseCoach} onClick={onPause}>暂停牌局，仔细阅读</button>}
    </>}
  </section>
}
