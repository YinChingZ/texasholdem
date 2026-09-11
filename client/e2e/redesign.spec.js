import { expect, test } from '@playwright/test'

const viewports = [[360, 640], [390, 844], [430, 932], [768, 1024], [1024, 768], [1280, 720], [1440, 900], [1920, 1080], [844, 390]]
for (const [width, height] of viewports) {
  test(`all eight stacks and bets remain readable at ${width}x${height}`, async ({ page }) => {
    await page.setViewportSize({ width, height })
    await page.goto('/?uiPreview=game-stress&theme=dark')
    await expect(page.getByTestId('player-stack')).toHaveCount(8)
    await expect(page.getByTestId('seat-bet')).toHaveCount(8)
    await page.waitForTimeout(400)
    const failures = await page.evaluate(() => {
      const failures = []
      const elements = [...document.querySelectorAll('[data-testid="player-stack"], [data-testid="seat-bet"], section[aria-label="公共牌"], [data-testid="pot-amount"], [aria-label="你的手牌"]')]
      const rects = elements.map(el => ({ label: el.getAttribute('aria-label') || el.textContent, rect: el.getBoundingClientRect() }))
      for (const [i, el] of elements.entries()) {
        const { rect, label } = rects[i]
        if (rect.left < 0 || rect.right > innerWidth || rect.top < 0 || rect.bottom > innerHeight) failures.push(`outside: ${label}`)
        if (el.scrollWidth > el.clientWidth + 1) failures.push(`clipped: ${label}`)
        if (el.matches('[data-testid="player-stack"]') && parseFloat(getComputedStyle(el).fontSize) < 16) failures.push(`small: ${label}`)
        for (let j = i + 1; j < rects.length; j++) {
          const other = rects[j].rect
          if (Math.min(rect.right, other.right) - Math.max(rect.left, other.left) > 1 && Math.min(rect.bottom, other.bottom) - Math.max(rect.top, other.top) > 1) failures.push(`overlap: ${label} / ${rects[j].label}`)
        }
      }
      return failures
    })
    expect(failures).toEqual([])
  })
}

test('desktop chat stays closed, preserves table size, and returns to the live action', async ({ page }) => {
  await page.goto('/?uiPreview=game-turn&theme=dark')
  await expect(page.getByRole('textbox', { name: '发送消息' })).toHaveCount(0)
  const before = await page.getByTestId('table-stage').boundingBox()
  await page.getByRole('button', { name: '聊天', exact: true }).click()
  await expect(page.getByRole('dialog', { name: '牌桌聊天' })).toBeVisible()
  expect(await page.getByTestId('table-stage').boundingBox()).toEqual(before)
  await page.getByRole('textbox', { name: '发送消息' }).fill('hello')
  await expect(page.getByRole('textbox', { name: '发送消息' })).toBeFocused()
  await page.getByRole('button', { name: '轮到你，返回牌桌' }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page.getByRole('button', { name: '聊天', exact: true })).toBeFocused()
})

test('raise amount input rejects invalid increments without changing table geometry', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 640 })
  await page.goto('/?uiPreview=game-turn&theme=dark')
  const before = await page.getByTestId('table-stage').boundingBox()
  await page.getByRole('button', { name: /^加注/ }).click()
  const amount = page.getByRole('spinbutton', { name: '额外加注金额' })
  for (const invalid of ['', '0', '9999999', '20.5']) {
    await amount.fill(invalid)
    await expect(page.getByRole('button', { name: /^确认加注/ })).toBeDisabled()
  }
  await amount.fill('40')
  await expect(page.getByRole('button', { name: '确认加注 40' })).toBeEnabled()
  expect(await page.getByTestId('table-stage').boundingBox()).toEqual(before)
})

test('real eight-player table keeps private cards separate and mobile chat can return to action', async ({ browser }) => {
  test.setTimeout(90000)
  const contexts = []
  const pages = []
  try {
    for (let index = 0; index < 8; index++) {
      const context = await browser.newContext({ viewport: index === 1 ? { width: 360, height: 640 } : { width: 1280, height: 720 } })
      contexts.push(context)
      const page = await context.newPage()
      pages.push(page)
      await page.goto('/')
      await page.getByLabel('昵称').fill(`验收玩家${index + 1}`)
      if (index === 0) await page.getByRole('button', { name: '创建新房间' }).click()
      else {
        await page.getByLabel('房间号').fill(await pages[0].getByTestId('room-code').textContent())
        await page.getByRole('button', { name: '加入房间' }).click()
      }
      await expect(page.getByTestId('room-code')).toBeVisible()
    }
    await expect(pages[0].getByRole('heading', { name: '玩家 8/8' })).toBeVisible()
    await pages[0].getByRole('button', { name: '开始游戏' }).click()
    for (const page of pages) {
      await expect(page.getByTestId('player-stack')).toHaveCount(8)
      await expect(page.locator('[aria-label="你的手牌"] > span[aria-label]')).toHaveCount(2)
      await expect(page.locator('[data-seat-index]:not([data-seat-index="0"]) [aria-label$="的手牌"]')).toHaveCount(0)
    }
    const phone = pages[1]
    await phone.getByRole('button', { name: '聊天', exact: true }).click()
    await phone.getByRole('textbox', { name: '发送消息' }).fill('八人桌测试')
    await phone.getByRole('button', { name: '发送消息', exact: true }).click()
    await expect(pages[0].getByRole('button', { name: /聊天，1 条未读/ })).toBeVisible()
    await phone.keyboard.press('Escape')
    const actor = await Promise.all(pages.map(async page => await page.getByRole('button', { name: /^(过牌|跟注|全押)/ }).count() ? page : null))
    const actingPage = actor.find(Boolean)
    expect(actingPage).toBeTruthy()
    await actingPage.getByRole('button', { name: /^(过牌|跟注|全押)/ }).click()
    await expect(actingPage.getByTestId('waiting-action')).toBeVisible()
  } finally { for (const context of contexts) await context.close() }
})

for (const [width, height] of [[360, 640], [390, 844], [768, 1024], [1440, 900], [844, 390]]) {
  test(`revealed hands do not obscure stacks at ${width}x${height}`, async ({ page }) => {
    await page.setViewportSize({ width, height })
    await page.goto('/?uiPreview=game-reveal-eight&theme=dark')
    await expect(page.locator('[data-seat-index] [aria-label$="的手牌"]')).toHaveCount(8)
    await page.waitForTimeout(500)
    const collisions = await page.evaluate(() => {
      const hands = [...document.querySelectorAll('[data-seat-index] [aria-label$="的手牌"]')]
      const stacks = [...document.querySelectorAll('[data-testid="player-stack"], section[aria-label="公共牌"], [data-testid="pot-amount"]')]
      const seats = [...document.querySelectorAll('[data-seat-index]')]
      const collisions = []
      const intersects = (a, b) => Math.min(a.right,b.right) - Math.max(a.left,b.left) > 1 && Math.min(a.bottom,b.bottom) - Math.max(a.top,b.top) > 1
      hands.forEach((hand, index) => {
        const rect = hand.getBoundingClientRect()
        if (rect.top < 48 || rect.bottom > innerHeight || rect.left < 0 || rect.right > innerWidth) collisions.push(`outside ${index}`)
        for (const stack of stacks) if (intersects(rect, stack.getBoundingClientRect())) collisions.push(`stack ${index}`)
        for (const seat of seats) if (!seat.contains(hand) && intersects(rect, seat.getBoundingClientRect())) collisions.push(`seat ${index}`)
        hands.slice(index + 1).forEach(other => { if (intersects(rect, other.getBoundingClientRect())) collisions.push(`hand ${index}`) })
      })
      return collisions
    })
    expect(collisions).toEqual([])
  })
}

test('pot details use main plus side pots without counting current bets twice', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/?uiPreview=game-side-pots&theme=dark')
  await expect(page.getByTestId('pot-amount')).toHaveText('280')
  await page.getByRole('button', { name: '查看边池明细' }).click()
  const dialog = page.getByRole('dialog', { name: '底池明细' })
  await expect(dialog).toContainText('主池 180')
  await expect(dialog).toContainText('边池 1100')
  await page.keyboard.press('Escape')
  await expect(dialog).toHaveCount(0)
})

test('a failed room join displays a local error that clears when the room number changes', async ({ page }) => {
  await page.goto('/')
  await page.getByLabel('昵称').fill('错误提示测试')
  await page.getByLabel('房间号').fill('missing-room')
  await page.getByRole('button', { name: '加入房间' }).click()
  await expect(page.getByRole('alert')).toContainText('房间')
  await page.getByLabel('房间号').fill('another-room')
  await expect(page.getByRole('alert')).toHaveCount(0)
})
