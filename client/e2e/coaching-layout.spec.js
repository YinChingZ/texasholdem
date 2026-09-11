import { test, expect } from '@playwright/test'
async function collisions(page) {
  return page.getByTestId('table-stage').evaluate(stage => {
    const seats=[...stage.querySelectorAll('[data-player-id]')]
    const bets=[...stage.querySelectorAll('[data-testid="seat-bet"]')]
    const board=stage.querySelector('[aria-label="公共牌"]')
    const pot=stage.querySelector('[data-testid="pot-amount"]').parentElement
    const overlaps=(a,b)=>{const r=a.getBoundingClientRect(),s=b.getBoundingClientRect();return Math.min(r.right,s.right)-Math.max(r.left,s.left)>1&&Math.min(r.bottom,s.bottom)-Math.max(r.top,s.top)>1}
    const errors=[]
    for(const bet of bets)for(const target of [...seats,board,pot])if(overlaps(bet,target))errors.push(`${bet.getAttribute('aria-label')} covers ${target.getAttribute('aria-label')||'pot'}`)
    if(overlaps(board,pot))errors.push('board covers pot')
    const bounds=stage.getBoundingClientRect()
    for(const seat of seats){const rect=seat.getBoundingClientRect();if(rect.bottom>bounds.bottom+1)errors.push('seat overflows table bottom');if(overlaps(seat,board)||overlaps(seat,pot))errors.push('seat covers board or pot')}
    return errors
  })
}
for(const [width,height] of [[1440,900],[1024,768],[390,844],[844,390]]) {
  test(`wagers remain separate from seats and the board at ${width}x${height}`,async({page})=>{
    await page.setViewportSize({width,height})
    for(const state of ['game-turn','game-stress']) {
      await page.goto(`/?uiPreview=${state}&theme=light`)
      await expect(page.getByTestId('table-stage')).toBeVisible()
      expect(await collisions(page)).toEqual([])
      expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
    }
  })
}
test('training offers live advice, action feedback and restores it after refresh',async({page})=>{
  test.setTimeout(45000)
  await page.setViewportSize({width:1173,height:850})
  await page.goto('/?theme=light');await page.getByLabel('昵称').fill('教练验收')
  await page.getByRole('button',{name:'观察练习',exact:true}).click()
  await expect(page.getByRole('button',{name:'弃牌',exact:true})).toBeVisible({timeout:15000})
  expect(await collisions(page)).toEqual([])
  await page.getByText('行动前提示：查看当前局面',{exact:true}).click()
  await expect(page.getByText(/当前可以免费过牌|需投入|打平门槛/).first()).toBeVisible()
  await page.getByRole('button',{name:'弃牌',exact:true}).click()
  await expect(page.getByText(/你选择了弃牌/)).toBeVisible()
  await page.getByRole('button',{name:'暂停牌局，仔细阅读',exact:true}).click()
  await page.getByText('展开这次决定的依据',{exact:true}).click()
  await page.screenshot({path:'/tmp/coaching-desktop.png',fullPage:true,animations:'disabled'})
  await page.reload();await expect(page.getByText(/你选择了弃牌/)).toBeVisible({timeout:15000})
  await expect(page.getByRole('button',{name:'继续练习',exact:true})).toBeVisible()
  await page.setViewportSize({width:390,height:844})
  await page.getByText('展开这次决定的依据',{exact:true}).click()
  await page.screenshot({path:'/tmp/coaching-mobile.png',fullPage:true,animations:'disabled'})
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
})
