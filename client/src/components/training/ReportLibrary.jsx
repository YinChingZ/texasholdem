import { useEffect, useState } from 'react'
import { listReports, deleteReport } from '../../services/trainingReports'
import { Button } from '../ui/Primitives'
import TrainingReport from './TrainingReport'
import styles from './Training.module.css'
export default function ReportLibrary({ onBack }) {
  const [reports, setReports] = useState([])
  const [selected, setSelected] = useState(null)
  const [error, setError] = useState('')
  useEffect(() => { listReports().then(setReports).catch(() => setError('无法读取此浏览器的报告存储。')) }, [])
  if (selected) return <TrainingReport report={selected} onBack={() => setSelected(null)} saved />
  const remove = async id => {
    try { await deleteReport(id); setReports(reports.filter(r => r.id !== id)) }
    catch { setError('删除失败，请重试。') }
  }
  return <main className={styles.page}><div className={styles.header}><h1>练习报告</h1><Button onClick={onBack}>返回首页</Button></div><p>仅保存在此浏览器，最多保留最近 20 份。</p>{error && <p role="alert">{error}</p>}{!reports.length && !error && <p>暂无已保存报告。</p>}{reports.map(r => <section key={r.id} className={styles.panel}><p>{new Date(r.finishedAt).toLocaleString()} · 完成 {r.completed} 手</p><div className={styles.tools}><Button onClick={() => setSelected(r)}>查看报告</Button><Button variant="ghost" onClick={() => remove(r.id)}>删除报告</Button></div></section>)}</main>
}
