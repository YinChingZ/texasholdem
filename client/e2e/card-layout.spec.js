import { expect, test } from '@playwright/test'

async function expectCardPartsFit(page) {
  const cards = page.locator('[data-card-part="suit"]')
  await expect(cards.first()).toBeVisible()
  const failures = await cards.evaluateAll(elements => elements.flatMap(pip => {
    const face = pip.parentElement
    const top = face.querySelector('[data-card-part="top-index"]')
    const bottom = face.querySelector('[data-card-part="bottom-index"]')
    if (!face.getBoundingClientRect().width || !face.getBoundingClientRect().height) return [] // Collapsed showdown details.
    const bounds = { left: 0, top: 0, right: face.clientWidth, bottom: face.clientHeight }
    // Measure in the card's local coordinates: the hero's decorative rotation
    // makes axis-aligned screen rectangles intersect even for separated glyphs.
    const parts = [top, pip, bottom].filter(el => getComputedStyle(el).display !== 'none')
    const rects = parts.map(el => ({ left: el.offsetLeft, top: el.offsetTop, right: el.offsetLeft + el.offsetWidth, bottom: el.offsetTop + el.offsetHeight }))
    const outside = rects.some(r => r.left < bounds.left - 1 || r.right > bounds.right + 1 || r.top < bounds.top - 1 || r.bottom > bounds.bottom + 1)
    const overlaps = rects.some((r, i) => rects.slice(i + 1).some(s => r.left < s.right && r.right > s.left && r.top < s.bottom && r.bottom > s.top))
    return outside || overlaps ? [{ card: face.textContent, width: face.clientWidth, outside, overlaps }] : []
  }))
  expect(failures).toEqual([])
}

for (const [width, height] of [[1440, 900], [390, 844], [844, 390]]) {
  test(`settlement card indices and suit never overlap at ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height })
    await page.goto('/?uiPreview=result&theme=light')
    await expect(page.getByRole('dialog', { name: '本手结算' })).toBeVisible()
    await expectCardPartsFit(page)
    await page.getByText('摊牌明细', { exact: true }).click()
    await expectCardPartsFit(page)
    await page.screenshot({ animations: 'disabled', path: test.info().outputPath(`settlement-${width}.png`) })
  })
}

test('settlement cards remain separated at 200% zoom', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1100 })
  await page.goto('/?uiPreview=result&theme=light')
  await page.getByRole('dialog', { name: '本手结算' }).waitFor()
  await page.evaluate(() => { document.documentElement.style.zoom = '2' })
  await expectCardPartsFit(page)
  await page.screenshot({ animations: 'disabled', path: test.info().outputPath('settlement-zoom-200.png') })
})

test('hero cards and mini revealed cards also fit their parent-assigned widths', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/?uiPreview=game-reveal-eight&theme=light')
  await expectCardPartsFit(page)
})
