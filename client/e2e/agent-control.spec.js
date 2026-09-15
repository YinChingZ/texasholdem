import { test, expect } from '@playwright/test'

async function enter(page, name, room) {
  await page.goto('/')
  await page.getByLabel('昵称').fill(name)
  if (room) { await page.getByLabel('房间号').fill(room); await page.getByRole('button', { name: /加入房间/ }).click() }
  else await page.getByRole('button', { name: /创建新房间/ }).click()
  return (await page.getByTestId('room-code').textContent()).trim()
}
async function grant(page) {
  await page.getByRole('button', { name: 'Agent 托管', exact: true }).click()
  await page.getByText('高级：本地 MCP / HTTP 凭证', { exact: true }).click()
  await page.getByRole('button', { name: '生成授权', exact: true }).click()
  const field = page.getByLabel('Agent 凭证', { exact: true })
  await expect(field).toBeVisible()
  const token = await field.inputValue()
  const persisted = await page.evaluate(() => JSON.stringify({ local: { ...localStorage }, session: { ...sessionStorage } }))
  expect(persisted.includes(token)).toBe(false)
  await page.keyboard.press('Escape')
  return token
}

test('普通房间：移动端授权、慢速桌、网页恢复、关网页代打与人工接管', async ({ browser, request, baseURL }) => {
  const a = await browser.newContext({ viewport: { width: 390, height: 844 } })
  const b = await browser.newContext()
  const pa = await a.newPage(), pb = await b.newPage()
  try {
    const room = await enter(pa, '托管甲'); await enter(pb, '托管乙', room)
    await pa.getByLabel('每步思考时间').selectOption('120000')
    const ta = await grant(pa), tb = await grant(pb)
    const api = async (token, path, body) => {
      const result = await request.fetch(`${baseURL}/api/agent/v1/${path}`, {
        method: body === undefined ? 'GET' : 'POST', headers: { Authorization: `Bearer ${token}` }, ...(body === undefined ? {} : { data: body }),
      })
      return result.json()
    }
    expect((await api(ta, 'connect', {})).ok).toBe(true)
    expect((await api(tb, 'connect', {})).ok).toBe(true)
    await expect(pa.getByText('Agent 托管 · 在线', { exact: true })).toBeVisible()
    await pa.getByRole('button', { name: '开始游戏', exact: true }).click()
    await expect(pa.getByTestId('table-stage')).toBeVisible()
    await expect(pa.getByText('Agent 正在代打')).toBeVisible()
    const before = (await api(ta, 'observation')).observation
    expect(before.turnDeadline - before.serverNow).toBeGreaterThan(110000)
    await pa.reload()
    await expect(pa.getByText('Agent 正在代打')).toBeVisible()
    const after = (await api(ta, 'observation')).observation
    expect(after.privateCards).toEqual(before.privateCards)
    expect(after.turnDeadline).toBe(before.turnDeadline)
    await pb.close()
    const bState = (await api(tb, 'observation')).observation
    expect(bState.self.sittingOut).toBe(false)
    expect(bState.players.find(p => p.id === bState.self.playerId).connected).toBe(true)
    await pa.screenshot({ path: '/tmp/holdem-agent-mobile.png', fullPage: true })
    await pa.getByRole('button', { name: '接回操作', exact: true }).click()
    await expect(pa.getByText('Agent 正在代打')).not.toBeVisible()
    expect((await api(ta, 'observation')).code).toBe('INVALID_GRANT')
    const current = (await api(tb, 'observation')).observation
    if (current.legalActions) expect((await api(tb, 'actions', {
      requestId: 'browser-close-action', handId: current.handId, turnId: current.turnId,
      controlVersion: current.self.controlVersion, action: 'fold',
    })).ok).toBe(true)
    else await pa.getByRole('button', { name: '弃牌', exact: true }).click()
    await expect(pa.getByRole('heading', { name: '本手结算' })).toBeVisible({ timeout: 10000 })
  } finally { await a.close(); await b.close() }
})
