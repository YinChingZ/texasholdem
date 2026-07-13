import { expect, test } from '@playwright/test'

test('host and guest can create, join, and start a real room', async ({ browser }) => {
  const hostContext = await browser.newContext()
  const guestContext = await browser.newContext()
  const host = await hostContext.newPage()
  const guest = await guestContext.newPage()

  try {
    await host.goto('/')
    await host.getByLabel('昵称').fill('房主')
    await host.getByRole('button', { name: /创建新房间/ }).click()
    await expect(host.getByRole('heading', { name: /等待更多牌友/ })).toBeVisible()
    const roomId = await host.getByTestId('room-code').textContent()

    await guest.goto('/')
    await guest.getByLabel('昵称').fill('访客')
    await guest.getByLabel('房间号').fill(roomId)
    await guest.getByRole('button', { name: /加入房间/ }).click()

    await expect(host.getByText('2/8 玩家')).toBeVisible()
    await expect(guest.getByRole('heading', { name: /牌友已到/ })).toBeVisible()
    await host.getByRole('button', { name: /开始牌局/ }).click()

    await expect(host.locator('.game-main-container')).toBeVisible()
    await expect(guest.locator('.game-main-container')).toBeVisible()
  } finally {
    await hostContext.close()
    await guestContext.close()
  }
})

test('mobile lobby chat opens as a sheet and closes with Escape', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/?uiPreview=lobby-host')
  await page.getByRole('button', { name: '聊天' }).click()
  const chatSheet = page.getByRole('dialog', { name: '牌桌聊天' })
  await expect(chatSheet).toBeVisible()
  await expect(page.getByRole('textbox', { name: '发送消息' })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(chatSheet).not.toBeVisible()
})

const lobbyVisuals = [
  { state: 'lobby-host', theme: 'light', name: 'host-desktop', width: 1440, height: 900 },
  { state: 'lobby-guest', theme: 'light', name: 'guest-tablet', width: 768, height: 1024 },
  { state: 'lobby-one', theme: 'light', name: 'one-mobile', width: 390, height: 844 },
  { state: 'lobby-full', theme: 'light', name: 'full-desktop', width: 1440, height: 900 },
  { state: 'lobby-host', theme: 'dark', name: 'host-dark-desktop', width: 1440, height: 900 },
]

for (const fixture of lobbyVisuals) {
  test(`@visual lobby ${fixture.name}`, async ({ page }) => {
    await page.setViewportSize({ width: fixture.width, height: fixture.height })
    await page.goto(`/?uiPreview=${fixture.state}&theme=${fixture.theme}`)
    await expect(page.getByRole('heading', { name: /房间名册/ })).toBeVisible()
    await expect(page).toHaveScreenshot(`lobby-${fixture.name}.png`, {
      animations: 'disabled',
      fullPage: true,
    })
  })
}

test('@visual lobby mobile chat sheet', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/?uiPreview=lobby-host&theme=light')
  await page.getByRole('button', { name: '聊天' }).click()
  await expect(page.getByRole('dialog', { name: '牌桌聊天' })).toBeVisible()
  await expect(page).toHaveScreenshot('lobby-mobile-chat.png', {
    animations: 'disabled',
    fullPage: false,
  })
})
