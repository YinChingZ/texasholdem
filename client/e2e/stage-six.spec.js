import { expect, test } from '@playwright/test'

const viewportMatrix = [
  { width: 320, height: 800 },
  { width: 360, height: 800 },
  { width: 390, height: 844 },
  { width: 480, height: 860 },
  { width: 768, height: 1024 },
  { width: 1024, height: 768 },
  { width: 1280, height: 720 },
  { width: 1600, height: 900 },
]

for (const viewport of viewportMatrix) {
  test(`game has no page overflow at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport)
    await page.goto('/?uiPreview=game-eight&theme=light')
    await expect(page.getByTestId('table-stage')).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  })
}

test('every final deterministic preview state renders without page errors', async ({ page }) => {
  const pageErrors = []
  page.on('pageerror', (error) => pageErrors.push(error.message))
  await page.goto('/?uiPreview=__index__')
  const previewLinks = await page.locator('nav a').evaluateAll((links) => links.map((link) => link.getAttribute('href')))
  expect(previewLinks.length).toBeGreaterThanOrEqual(25)
  for (const href of previewLinks) {
    await page.goto(href)
    await expect(page.locator('#root')).not.toBeEmpty()
  }
  expect(pageErrors).toEqual([])
})

test('320px keeps state text and 44px touch targets', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 })
  await page.goto('/?uiPreview=game-turn&theme=light')
  await expect(page.getByTestId('mobile-player-strip')).toContainText('已弃牌')
  const undersized = await page.locator('button:visible').evaluateAll((buttons) => buttons
    .map((button) => ({ label: button.getAttribute('aria-label') || button.textContent.trim(), rect: button.getBoundingClientRect() }))
    .filter(({ rect }) => rect.width < 44 || rect.height < 44)
    .map(({ label, rect }) => `${label}:${Math.round(rect.width)}x${Math.round(rect.height)}`))
  expect(undersized).toEqual([])
})

test('main game actions remain operable at the 200% zoom equivalent viewport', async ({ page }) => {
  // 1600×900 at 200% browser zoom exposes an effective 800×450 CSS viewport.
  await page.setViewportSize({ width: 800, height: 450 })
  await page.goto('/?uiPreview=game-turn&theme=light')
  const fold = page.getByRole('button', { name: '弃牌' })
  const call = page.getByRole('button', { name: '过牌' })
  const raise = page.getByRole('button', { name: /加注/ })
  await expect(fold).toBeVisible()
  await expect(call).toBeVisible()
  await expect(raise).toBeVisible()
  await raise.click()
  await expect(page.getByRole('slider', { name: '加注金额' })).toBeVisible()
})

test('keyboard focus stays visible on the primary welcome path', async ({ page }) => {
  await page.goto('/?uiPreview=welcome&theme=light')
  await page.keyboard.press('Tab')
  await expect(page.getByRole('button', { name: '切换到夜间模式' })).toBeFocused()
  await page.keyboard.press('Tab')
  await expect(page.getByLabel('昵称')).toBeFocused()
  const focusIndicator = await page.getByLabel('昵称').evaluate((element) => {
    const style = getComputedStyle(element)
    return { outline: style.outlineStyle, shadow: style.boxShadow }
  })
  expect(focusIndicator.outline !== 'none' || focusIndicator.shadow !== 'none').toBe(true)
})

test('light and dark semantic color pairs meet normal-text contrast', async ({ page }) => {
  await page.goto('/?uiPreview=welcome&theme=light')
  const contrastResults = await page.evaluate(() => {
    const parseHex = (value) => {
      const hex = value.trim().replace('#', '')
      return [0, 2, 4].map((index) => Number.parseInt(hex.slice(index, index + 2), 16) / 255)
    }
    const luminance = (value) => {
      const [red, green, blue] = parseHex(value).map((channel) => channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4)
      return 0.2126 * red + 0.7152 * green + 0.0722 * blue
    }
    const contrast = (first, second) => {
      const values = [luminance(first), luminance(second)].sort((a, b) => b - a)
      return (values[0] + 0.05) / (values[1] + 0.05)
    }
    const pairs = [
      ['--color-text', '--color-app'],
      ['--color-text-secondary', '--color-surface'],
      ['--color-gold', '--color-surface-raised'],
      ['--color-success', '--color-surface-raised'],
      ['--color-danger', '--color-surface-raised'],
      ['--color-on-gold', '--color-gold-control'],
      ['--color-on-success', '--color-success-control'],
      ['--color-on-danger', '--color-danger-control'],
    ]
    return ['light', 'dark'].flatMap((theme) => {
      document.documentElement.dataset.theme = theme
      const style = getComputedStyle(document.documentElement)
      return pairs.map(([foreground, background]) => ({
        theme,
        foreground,
        background,
        ratio: contrast(style.getPropertyValue(foreground), style.getPropertyValue(background)),
      }))
    })
  })
  expect(contrastResults.filter(({ ratio }) => ratio < 4.5)).toEqual([])
})

test('@visual final 320px game', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 })
  await page.goto('/?uiPreview=game-eight&theme=light')
  await expect(page.getByTestId('table-stage')).toBeVisible()
  await expect(page).toHaveScreenshot('final-game-320.png', { animations: 'disabled', fullPage: false })
})

test('@visual final 200 percent zoom', async ({ page }) => {
  await page.setViewportSize({ width: 800, height: 450 })
  await page.goto('/?uiPreview=game-turn&theme=dark')
  await expect(page.getByRole('button', { name: /加注/ })).toBeVisible()
  await expect(page).toHaveScreenshot('final-game-zoom-200.png', { animations: 'disabled', fullPage: false })
})
