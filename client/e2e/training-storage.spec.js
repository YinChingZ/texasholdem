import { test, expect } from '@playwright/test'
test('IndexedDB 去重、只保留最近二十份、删除及存储失败', async ({ page }) => {
  await page.goto('/')
  const result = await page.evaluate(async () => {
    const store = await import('/src/services/trainingReports.js')
    for (let i = 0; i < 23; i++) await store.saveReport({ id: `fixture-${i}`, finishedAt: i, completed: i })
    await store.saveReport({ id: 'fixture-22', finishedAt: 22, completed: 99 })
    const reports = await store.listReports()
    await store.deleteReport('fixture-22')
    const remaining = await store.listReports()
    const original = window.indexedDB
    Object.defineProperty(window, 'indexedDB', { configurable: true, value: { open() { throw new Error('blocked storage') } } })
    let failure
    try { await store.saveReport({ id: 'failure' }) } catch (error) { failure = error.message }
    Object.defineProperty(window, 'indexedDB', { configurable: true, value: original })
    return { count: reports.length, oldest: reports.at(-1).id, updated: reports[0].completed, remaining: remaining.length, failure }
  })
  expect(result).toEqual({ count: 20, oldest: 'fixture-3', updated: 99, remaining: 19, failure: 'blocked storage' })
})
