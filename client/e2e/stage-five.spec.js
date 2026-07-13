import { expect, test } from '@playwright/test'

test('settlement dialog closes consistently and keeps the next-hand action', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/?uiPreview=result-split&theme=light')
  await expect(page.getByRole('dialog', { name: '本手结算' })).toBeVisible()
  await expect(page.getByText('主池平分')).toHaveCount(2)
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog', { name: '本手结算' })).not.toBeVisible()
})

test('sound settings persist the mute choice and close from the backdrop', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/?uiPreview=game-turn&theme=light')
  await page.getByRole('button', { name: /音效设置/ }).click()
  await expect(page.getByRole('dialog', { name: '音效设置' })).toBeVisible()
  await page.getByRole('button', { name: '关闭', exact: true }).click()
  await expect(page.getByText('当前保持静音')).toBeVisible()
  await page.getByRole('button', { name: '完成' }).click()
  await page.getByRole('button', { name: /音效设置/ }).click()
  await expect(page.getByRole('button', { name: '关闭', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await page.mouse.click(5, 5)
  await expect(page.getByRole('dialog', { name: '音效设置' })).not.toBeVisible()
})

test('reduced motion removes looping animation from stage-five surfaces', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/?uiPreview=message-allin&theme=dark')
  const iterations = await page.locator('*').evaluateAll((elements) => elements
    .filter((element) => {
      const style = getComputedStyle(element)
      return style.animationName !== 'none' && style.visibility !== 'hidden'
    })
    .map((element) => getComputedStyle(element).animationIterationCount))
  expect(iterations).not.toContain('infinite')
})

const resultVisuals = [
  { state: 'result', theme: 'light', name: 'single-1440', width: 1440, height: 900 },
  { state: 'result-split', theme: 'dark', name: 'split-768', width: 768, height: 1024 },
  { state: 'result-side-pot', theme: 'light', name: 'side-pot-390', width: 390, height: 844 },
  { state: 'result-hidden', theme: 'dark', name: 'hidden-844', width: 844, height: 390 },
]

for (const fixture of resultVisuals) {
  test(`@visual settlement ${fixture.name}`, async ({ page }) => {
    await page.setViewportSize({ width: fixture.width, height: fixture.height })
    await page.goto(`/?uiPreview=${fixture.state}&theme=${fixture.theme}`)
    await expect(page.getByRole('dialog', { name: '本手结算' })).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    await expect(page).toHaveScreenshot(`settlement-${fixture.name}.png`, { animations: 'disabled', fullPage: false })
  })
}

test('@visual final leaderboard', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/?uiPreview=leaderboard&theme=light')
  await expect(page.getByRole('dialog', { name: '最终排行榜' })).toBeVisible()
  await expect(page).toHaveScreenshot('leaderboard-1440.png', { animations: 'disabled', fullPage: false })
})

test('@visual mobile sound settings', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/?uiPreview=game-turn&theme=light')
  await page.getByRole('button', { name: '牌桌设置' }).click()
  await page.getByRole('button', { name: /音效设置/ }).click()
  await expect(page.getByRole('dialog', { name: '音效设置' })).toBeVisible()
  await expect(page).toHaveScreenshot('sound-settings-mobile-390.png', { animations: 'disabled', fullPage: false })
})

test('@visual restrained global action message', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 })
  await page.goto('/?uiPreview=message-allin&theme=dark')
  await expect(page.getByRole('status')).toContainText('北岸宣布全押')
  await expect(page).toHaveScreenshot('global-message-allin-1280.png', { animations: 'disabled', fullPage: false })
})
