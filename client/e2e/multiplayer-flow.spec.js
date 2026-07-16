import { expect, test } from '@playwright/test'

// 真实双人对局流程：验证行动气泡、发牌节奏与延迟结算
// （连真实 server，走完整 socket 流程；服务端节奏默认 600/1200ms）

async function enterTable(page, nickname) {
  await page.goto('/')
  await page.getByLabel('昵称').fill(nickname)
}

async function actorPage(pages) {
  // 轮询找出当前轮到行动的页面
  for (let attempt = 0; attempt < 40; attempt++) {
    for (const page of pages) {
      if (await page.getByText('轮到你行动').isVisible().catch(() => false)) return page
    }
    await pages[0].waitForTimeout(250)
  }
  throw new Error('没有页面轮到行动')
}

test('双人对局：加注气泡、翻牌揭示与延迟结算', async ({ browser }) => {
  test.setTimeout(90_000)
  const contextA = await browser.newContext()
  const contextB = await browser.newContext()
  const pageA = await contextA.newPage()
  const pageB = await contextB.newPage()

  // A 创建房间
  await enterTable(pageA, '玩家甲')
  await pageA.getByRole('button', { name: /创建新房间/ }).click()
  const roomId = (await pageA.getByTestId('room-code').textContent()).trim()
  expect(roomId).toBeTruthy()

  // B 加入房间
  await enterTable(pageB, '玩家乙')
  await pageB.getByLabel('房间号').fill(roomId)
  await pageB.getByRole('button', { name: /加入房间/ }).click()
  await expect(pageB.getByTestId('room-code')).toHaveText(roomId)

  // A 开始牌局
  await pageA.getByRole('button', { name: /开始牌局/ }).click()
  await expect(pageA.getByTestId('table-stage')).toBeVisible()
  await expect(pageB.getByTestId('table-stage')).toBeVisible()

  // 第一个行动者加注 → 观察者页面出现"加注"气泡
  const first = await actorPage([pageA, pageB])
  const observer = first === pageA ? pageB : pageA
  await first.getByRole('button', { name: /^加注/ }).click()
  await first.getByRole('button', { name: /确认加注/ }).click()
  await expect(observer.getByRole('status').filter({ hasText: '加注' }).first()).toBeVisible({ timeout: 5000 })

  // 对方跟注 → 翻牌：两个页面都出现 3 张公共牌（排程器逐张揭示）
  const second = await actorPage([pageA, pageB])
  await second.getByRole('button', { name: /^跟注/ }).click()
  for (const page of [pageA, pageB]) {
    await expect(async () => {
      const count = await page.locator('section[aria-label="公共牌"] span[aria-label]').count()
      expect(count).toBeGreaterThanOrEqual(3)
    }).toPass({ timeout: 8000 })
  }

  // 弃牌结束本手 → 延迟后两边都出现结算弹窗
  const third = await actorPage([pageA, pageB])
  await third.getByRole('button', { name: '弃牌' }).click()
  await expect(pageA.getByRole('heading', { name: '本手结算' })).toBeVisible({ timeout: 10_000 })
  await expect(pageB.getByRole('heading', { name: '本手结算' })).toBeVisible({ timeout: 10_000 })

  await contextA.close()
  await contextB.close()
})

test('reduced-motion 下结算立即弹出、无动画等待', async ({ browser }) => {
  test.setTimeout(90_000)
  const contextA = await browser.newContext({ reducedMotion: 'reduce' })
  const contextB = await browser.newContext({ reducedMotion: 'reduce' })
  const pageA = await contextA.newPage()
  const pageB = await contextB.newPage()

  await enterTable(pageA, '静态甲')
  await pageA.getByRole('button', { name: /创建新房间/ }).click()
  const roomId = (await pageA.getByTestId('room-code').textContent()).trim()

  await enterTable(pageB, '静态乙')
  await pageB.getByLabel('房间号').fill(roomId)
  await pageB.getByRole('button', { name: /加入房间/ }).click()
  await pageA.getByRole('button', { name: /开始牌局/ }).click()

  const first = await actorPage([pageA, pageB])
  await first.getByRole('button', { name: '弃牌' }).click()
  // 服务端仍有 1.2s 结算延迟，但客户端不再追加动画停留
  await expect(pageA.getByRole('heading', { name: '本手结算' })).toBeVisible({ timeout: 6000 })
  await expect(pageB.getByRole('heading', { name: '本手结算' })).toBeVisible({ timeout: 6000 })

  await contextA.close()
  await contextB.close()
})
