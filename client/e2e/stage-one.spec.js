import { expect, test } from '@playwright/test'

const previewStates = [
  'welcome',
  'connecting',
  'reconnecting',
  'disconnected',
  'lobby-host',
  'lobby-guest',
  'lobby-one',
  'lobby-full',
  'game-turn',
  'game-waiting',
  'spectator',
  'result',
  'leaderboard',
]

test('welcome form enables the expected actions', async ({ page }) => {
  await page.goto('/?uiPreview=welcome')
  const createButton = page.getByRole('button', { name: /创建新房间/ })
  const joinButton = page.getByRole('button', { name: /加入房间/ })

  await expect(createButton).toBeDisabled()
  await page.getByLabel('昵称').fill('河牌猎手')
  await expect(createButton).toBeEnabled()
  await expect(joinButton).toBeDisabled()
  await page.getByLabel('房间号').fill('CLUB24')
  await expect(joinButton).toBeEnabled()
})

test('theme choice persists after reload', async ({ page }) => {
  await page.goto('/?uiPreview=welcome')
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
  await page.getByRole('button', { name: '切换到夜间模式' }).click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await page.reload()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
})

test('all deterministic preview states render without page errors', async ({ page }) => {
  const pageErrors = []
  page.on('pageerror', (error) => pageErrors.push(error.message))

  for (const state of previewStates) {
    await page.goto(`/?uiPreview=${state}`)
    await expect(page.locator('#root')).not.toBeEmpty()
  }

  expect(pageErrors).toEqual([])
})

for (const state of ['welcome', 'connecting', 'disconnected']) {
  for (const viewport of [
    { name: 'desktop', width: 1440, height: 900 },
    { name: 'tablet', width: 768, height: 1024 },
    { name: 'mobile', width: 390, height: 844 },
  ]) {
    test(`@visual ${state} ${viewport.name}`, async ({ page }) => {
      await page.setViewportSize(viewport)
      await page.goto(`/?uiPreview=${state}`)
      await expect(page.locator('main')).toBeVisible()
      await expect(page).toHaveScreenshot(`${state}-${viewport.name}.png`, {
        animations: 'disabled',
        fullPage: true,
      })
    })
  }
}

for (const viewport of [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'mobile', width: 390, height: 844 },
]) {
  test(`@visual welcome dark ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize(viewport)
    await page.goto('/?uiPreview=welcome&theme=dark')
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
    await expect(page).toHaveScreenshot(`welcome-dark-${viewport.name}.png`, {
      animations: 'disabled',
      fullPage: true,
    })
  })
}
