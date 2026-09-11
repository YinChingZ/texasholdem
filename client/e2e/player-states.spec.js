import { expect, test } from '@playwright/test'

for (const [width, height, theme] of [[1440, 900, 'dark'], [360, 640, 'dark'], [844, 390, 'dark'], [1440, 900, 'light']]) {
  test(`persistent player states fit ${width} ${theme}`, async ({ page }) => {
    await page.setViewportSize({ width, height })
    await page.goto(`/?uiPreview=game-player-states&theme=${theme}`)
    await expect(page.locator('[data-player-state="allin"]')).toContainText('ALL IN')
    await expect(page.locator('[data-player-state="folded"]')).toHaveCount(2)
    await expect(page.locator('[data-player-state="offline"]')).toContainText('已离线')
    await expect(page.locator('[data-player-state="current"]')).toContainText('123,456')
    expect(await page.getByTestId('player-status').evaluateAll(elements => elements.filter(el => {
      const r = el.getBoundingClientRect()
      return el.scrollWidth > el.clientWidth + 1 || r.left < 0 || r.right > innerWidth || r.bottom > innerHeight
    }).map(el => el.textContent))).toEqual([])
  })
}
for (const [width, height, theme] of [[1440, 900, 'dark'], [360, 640, 'dark'], [1440, 900, 'light']]) {
  test(`@visual player states ${width} ${theme}`, async ({ page }) => {
    await page.setViewportSize({ width, height })
    await page.goto(`/?uiPreview=game-player-states&theme=${theme}`)
    await expect(page.getByTestId('player-stack')).toHaveCount(8)
    await expect(page).toHaveScreenshot(`player-states-${width}-${theme}.png`, { animations: 'disabled' })
  })
}
