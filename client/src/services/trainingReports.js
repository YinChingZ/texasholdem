const DB = 'texasholdem_training_reports_v1'
function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB, 1)
    request.onupgradeneeded = () => request.result.createObjectStore('reports', { keyPath: 'id' })
    request.onerror = () => reject(request.error)
    request.onblocked = () => reject(new Error('报告存储被其他页面占用'))
    request.onsuccess = () => resolve(request.result)
  })
}
async function transaction(mode, work) {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction('reports', mode)
    let result
    tx.oncomplete = () => { db.close(); resolve(result) }
    tx.onerror = tx.onabort = () => { db.close(); reject(tx.error || new Error('报告存储失败')) }
    work(tx.objectStore('reports'), value => { result = value })
  })
}
export const listReports = () => transaction('readonly', (store, done) => {
  const request = store.getAll()
  request.onsuccess = () => done(request.result.sort((a, b) => b.finishedAt - a.finishedAt))
})
export const deleteReport = id => transaction('readwrite', store => store.delete(id))
export const saveReport = report => transaction('readwrite', store => {
  store.put(report)
  const request = store.getAll()
  request.onsuccess = () => request.result.sort((a, b) => b.finishedAt - a.finishedAt).slice(20).forEach(old => store.delete(old.id))
})
export function downloadReport(report) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' }))
  const a = document.createElement('a'); a.href = url; a.download = `观察练习-${report.id}.json`; a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
