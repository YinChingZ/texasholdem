import { expect, test } from '@playwright/test'

test('two real players can complete a legal action', async ({ browser }) => {
  const hostContext = await browser.newContext()
  const guestContext = await browser.newContext()
  const host = await hostContext.newPage()
  const guest = await guestContext.newPage()

  try {
    await host.goto('/')
    await host.getByLabel('昵称').fill('行动房主')
    await host.getByRole('button', { name: /创建新房间/ }).click()
    const roomId = await host.getByTestId('room-code').textContent()

    await guest.goto('/')
    await guest.getByLabel('昵称').fill('行动访客')
    await guest.getByLabel('房间号').fill(roomId)
    await guest.getByRole('button', { name: /加入房间/ }).click()
    await expect(host.getByText('2/8 玩家')).toBeVisible()
    await host.getByRole('button', { name: /开始牌局/ }).click()

    const hostAction = host.getByRole('button', { name: /^(过牌|跟注|全押)/ })
    const guestAction = guest.getByRole('button', { name: /^(过牌|跟注|全押)/ })
    await expect.poll(async () => await hostAction.count() + await guestAction.count()).toBe(1)
    const actingPage = await hostAction.count() ? host : guest
    await actingPage.getByRole('button', { name: /^(过牌|跟注|全押)/ }).click()
    await expect(actingPage.getByTestId('waiting-action')).toBeVisible()
  } finally {
    await hostContext.close()
    await guestContext.close()
  }
})

const gameVisuals = [
  { state: 'game-two', theme: 'light', name: 'two-1280', width: 1280, height: 720 },
  { state: 'game-turn', theme: 'light', name: 'turn-1440', width: 1440, height: 900 },
  { state: 'game-six', theme: 'light', name: 'six-1600', width: 1600, height: 900 },
  { state: 'game-eight', theme: 'light', name: 'eight-1440', width: 1440, height: 900 },
  { state: 'game-waiting', theme: 'dark', name: 'waiting-dark-1280', width: 1280, height: 720 },
  { state: 'game-no-raise', theme: 'light', name: 'no-raise-1280', width: 1280, height: 720 },
  { state: 'spectator', theme: 'dark', name: 'spectator-1600', width: 1600, height: 900 },
]

for (const fixture of gameVisuals) {
  test(`@visual game ${fixture.name}`, async ({ page }) => {
    await page.setViewportSize({ width: fixture.width, height: fixture.height })
    await page.goto(`/?uiPreview=${fixture.state}&theme=${fixture.theme}`)
    await expect(page.getByTestId('table-stage')).toBeVisible()
    await expect(page).toHaveScreenshot(`game-${fixture.name}.png`, {
      animations: 'disabled',
      fullPage: false,
    })
  })
}

test('@visual game raise panel', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/?uiPreview=game-turn&theme=light')
  await page.getByRole('button', { name: /加注/ }).click()
  await expect(page.getByRole('slider', { name: '加注金额' })).toBeVisible()
  await expect(page).toHaveScreenshot('game-raise-panel-1440.png', {
    animations: 'disabled',
    fullPage: false,
  })
})
