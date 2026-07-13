import { expect, test } from '@playwright/test'

test('mobile sheets close with Escape and restore focus', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/?uiPreview=game-turn&theme=light')
  const chatTrigger = page.getByRole('button', { name: '聊天' })
  await chatTrigger.click()
  await expect(page.getByRole('dialog', { name: '牌桌聊天' })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog', { name: '牌桌聊天' })).not.toBeVisible()
  await expect(chatTrigger).toBeFocused()

  await page.getByRole('button', { name: '牌桌设置' }).click()
  await expect(page.getByRole('dialog', { name: '牌桌设置' })).toBeVisible()
  await page.getByRole('button', { name: '关闭牌桌设置' }).first().click({ position: { x: 12, y: 12 } })
  await expect(page.getByRole('dialog', { name: '牌桌设置' })).not.toBeVisible()
})

test('raise panel survives portrait and landscape changes', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/?uiPreview=game-turn&theme=light')
  await page.getByRole('button', { name: /加注/ }).click()
  await expect(page.getByRole('slider', { name: '加注金额' })).toBeVisible()
  await page.setViewportSize({ width: 844, height: 390 })
  await expect(page.getByRole('slider', { name: '加注金额' })).toBeVisible()
  await page.setViewportSize({ width: 390, height: 844 })
  await expect(page.getByRole('slider', { name: '加注金额' })).toBeVisible()
})

test('chat composer remains visible when the viewport height shrinks', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/?uiPreview=game-turn&theme=light')
  await page.getByRole('button', { name: '聊天' }).click()
  await page.setViewportSize({ width: 390, height: 500 })
  const input = page.getByRole('textbox', { name: '发送消息' })
  const send = page.getByRole('button', { name: '发送消息' })
  await expect(input).toBeVisible()
  await expect(send).toBeVisible()
  expect(await input.evaluate((element) => {
    const rect = element.getBoundingClientRect()
    return rect.bottom <= window.innerHeight && rect.top >= 0
  })).toBe(true)
})

const responsiveVisuals = [
  { state: 'game-turn', theme: 'light', name: 'portrait-360', width: 360, height: 800 },
  { state: 'game-eight', theme: 'light', name: 'portrait-390', width: 390, height: 844 },
  { state: 'game-turn', theme: 'light', name: 'landscape-844', width: 844, height: 390 },
  { state: 'game-six', theme: 'light', name: 'tablet-768', width: 768, height: 1024 },
  { state: 'game-eight', theme: 'dark', name: 'tablet-1024', width: 1024, height: 768 },
]

for (const fixture of responsiveVisuals) {
  test(`@visual responsive ${fixture.name}`, async ({ page }) => {
    await page.setViewportSize({ width: fixture.width, height: fixture.height })
    await page.goto(`/?uiPreview=${fixture.state}&theme=${fixture.theme}`)
    await expect(page.getByTestId('table-stage')).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    expect(await page.locator('button:visible').evaluateAll((buttons) => buttons
      .map((button) => ({ label: button.getAttribute('aria-label') || button.textContent.trim(), rect: button.getBoundingClientRect() }))
      .filter(({ rect }) => rect.width < 44 || rect.height < 44)
      .map(({ label, rect }) => `${label}:${Math.round(rect.width)}x${Math.round(rect.height)}`))).toEqual([])
    await expect(page).toHaveScreenshot(`responsive-${fixture.name}.png`, { animations: 'disabled', fullPage: false })
  })
}

test('@visual responsive mobile chat sheet', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/?uiPreview=game-turn&theme=light')
  await page.getByRole('button', { name: '聊天' }).click()
  await expect(page.getByRole('dialog', { name: '牌桌聊天' })).toBeVisible()
  await expect(page).toHaveScreenshot('responsive-mobile-chat.png', { animations: 'disabled', fullPage: false })
})

test('@visual responsive tablet controls drawer', async ({ page }) => {
  await page.setViewportSize({ width: 768, height: 1024 })
  await page.goto('/?uiPreview=game-six&theme=light')
  await page.getByRole('button', { name: '牌桌设置' }).click()
  await expect(page.getByRole('dialog', { name: '牌桌设置' })).toBeVisible()
  await expect(page).toHaveScreenshot('responsive-tablet-controls.png', { animations: 'disabled', fullPage: false })
})

test('@visual responsive landscape raise panel', async ({ page }) => {
  await page.setViewportSize({ width: 844, height: 390 })
  await page.goto('/?uiPreview=game-turn&theme=dark')
  await page.getByRole('button', { name: /加注/ }).click()
  await expect(page.getByRole('slider', { name: '加注金额' })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  await expect(page).toHaveScreenshot('responsive-landscape-raise.png', { animations: 'disabled', fullPage: false })
})
