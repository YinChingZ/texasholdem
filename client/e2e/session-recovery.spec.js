import { expect, test } from '@playwright/test'

async function create(page, name='房主') {
  await page.goto('/')
  await page.getByLabel('昵称').fill(name)
  await page.getByRole('button',{name:/创建新房间/}).click()
  return (await page.getByTestId('room-code').textContent()).trim()
}
async function join(page,room,name='牌友') {
  await page.goto('/');await page.getByLabel('昵称').fill(name);await page.getByLabel('房间号').fill(room)
  await page.getByRole('button',{name:/加入房间/}).click()
}
async function actor(pages) {
  let found
  await expect.poll(async()=> {
    for(const p of pages) if(await p.getByText('轮到你行动',{exact:true}).isVisible()) {found=p;return true}
    return false
  }).toBe(true)
  return found
}

test('刷新大厅恢复同一身份，仍能开始；断线恢复手牌与行动期限',async({browser})=>{
  test.setTimeout(60000)
  const a=await browser.newContext(),b=await browser.newContext(),pa=await a.newPage(),pb=await b.newPage()
  try {
    const room=await create(pa);await join(pb,room)
    await expect(pb.getByTestId('room-code')).toHaveText(room)
    const credential=await pa.evaluate(()=>localStorage.getItem('texasholdem_sessions_v2'))
    await pa.reload();await expect(pa.getByTestId('room-code')).toHaveText(room,{timeout:15000})
    expect(await pa.evaluate(()=>localStorage.getItem('texasholdem_sessions_v2'))).toBe(credential)
    await expect(pa.getByRole('button',{name:'开始游戏',exact:true})).toBeEnabled()
    await pa.getByRole('button',{name:'开始游戏',exact:true}).click()
    await expect(pa.getByTestId('table-stage')).toBeVisible()
    await expect(pa.getByText('连接异常', { exact: true })).not.toBeVisible()
    await pb.reload();await expect(pb.getByTestId('table-stage')).toBeVisible({timeout:15000})
    await expect(pb.getByText('连接异常', { exact: true })).not.toBeVisible()
    await expect(pb.getByRole('button',{name:'回到牌桌',exact:true})).toBeVisible()
    const acting=await actor([pa,pb]);await acting.getByRole('button',{name:'弃牌',exact:true}).click()
    await expect(pa.getByRole('heading',{name:'本手结算'})).toBeVisible({timeout:10000})
    await pa.reload();await expect(pa.getByRole('heading',{name:'本手结算'})).toBeVisible({timeout:15000})
  } finally {await a.close();await b.close()}
})

test('同浏览器第二个页面必须确认接管；旧页面不争抢且退出不删共享凭证',async({browser})=>{
  const context=await browser.newContext(),first=await context.newPage()
  try {
    const room=await create(first)
    const second=await context.newPage();await second.goto('/')
    await expect(second.getByRole('heading',{name:'此身份正在其他页面使用'})).toBeVisible({timeout:15000})
    await expect(first.getByTestId('room-code')).toHaveText(room)
    await second.getByRole('button',{name:'接管此身份'}).click()
    await expect(second.getByTestId('room-code')).toHaveText(room)
    await expect(first.getByRole('heading',{name:'已在其他页面接管'})).toBeVisible()
    await first.getByRole('button',{name:'返回首页'}).click()
    await expect(first.getByRole('button',{name:/创建新房间/})).toBeVisible()
    expect(await second.evaluate(()=>localStorage.getItem('texasholdem_sessions_v2'))).toContain('token')
    await expect(second.getByTestId('room-code')).toHaveText(room)
  } finally {await context.close()}
})

test('关闭结算弹窗后自动续局，常驻入口可查看上一手',async({browser})=>{
  test.setTimeout(45000)
  const a=await browser.newContext({reducedMotion:'reduce'}),b=await browser.newContext({reducedMotion:'reduce'}),pa=await a.newPage(),pb=await b.newPage()
  try {
    const room=await create(pa);await join(pb,room);await expect(pb.getByTestId('room-code')).toHaveText(room)
    await pa.getByRole('button',{name:'开始游戏',exact:true}).click()
    const acting=await actor([pa,pb]);await acting.getByRole('button',{name:'弃牌',exact:true}).click()
    await expect(pa.getByRole('heading',{name:'本手结算'})).toBeVisible()
    await pa.getByRole('button',{name:'返回牌桌',exact:true}).click()
    await expect(pa.getByText(/下一手将在/)).toBeVisible()
    await expect(pa.getByRole('button',{name:'查看上一手'})).toBeVisible()
    await expect(pa.getByText(/下一手将在/)).not.toBeVisible({timeout:12000})
    await expect.poll(async()=> await pa.getByText('轮到你行动',{exact:true}).isVisible() || await pb.getByText('轮到你行动',{exact:true}).isVisible()).toBe(true)
  } finally {await a.close();await b.close()}
})

test('首次服务不可达时仍显示首页，持续失败才显示内联重试提示',async({page})=>{
  await page.route('**/socket.io/**',route=>route.abort())
  await page.goto('/')
  await expect(page.getByRole('heading',{name:'德州扑克',exact:true})).toBeVisible()
  await page.getByLabel('昵称').fill('离线玩家')
  await expect(page.getByRole('button',{name:/创建新房间/})).toBeDisabled()
  await expect(page.getByRole('button',{name:'重新连接',exact:true})).toBeVisible({timeout:10000})
  await expect(page.getByText('暂时无法连接服务，正在自动重试。')).toBeVisible()
  await expect(page.getByRole('heading',{name:'牌桌暂时离线'})).not.toBeVisible()
  await page.unroute('**/socket.io/**')
  await page.getByRole('button',{name:'重新连接',exact:true}).click()
  await expect(page.getByRole('button',{name:/创建新房间/})).toBeEnabled()
  await expect(page.getByLabel('昵称')).toHaveValue('离线玩家')
})

test('首次握手短暂失败再成功，全程保留首页与输入且不闪失败页',async({page})=>{
  let attempts=0, firstAttemptAt
  await page.addInitScript(()=>{
    window.entryHeadings=[]
    new MutationObserver(()=>{for(const h of document.querySelectorAll('h1')) if(!window.entryHeadings.includes(h.textContent)) window.entryHeadings.push(h.textContent)}).observe(document,{childList:true,subtree:true})
  })
  await page.route('**/socket.io/**',async route=>{
    attempts++
    firstAttemptAt ??= Date.now()
    if(Date.now()-firstAttemptAt<500) await route.abort()
    else await route.continue()
  })
  await page.goto('/')
  await expect(page.getByRole('heading',{name:'德州扑克',exact:true})).toBeVisible()
  await page.getByLabel('昵称').fill('新玩家')
  await expect(page.getByRole('button',{name:/创建新房间/})).toBeEnabled({timeout:15000})
  expect(attempts).toBeGreaterThan(1)
  expect(await page.evaluate(()=>window.entryHeadings)).toEqual(['德州扑克'])
  await expect(page.getByLabel('昵称')).toHaveValue('新玩家')
})

test('邀请链接可在大厅和牌桌复制，朋友打开后预填房间号并加入', async ({ browser }) => {
  const host = await browser.newContext({ permissions: ['clipboard-read', 'clipboard-write'] })
  const guest = await browser.newContext()
  try {
    const a = await host.newPage(), b = await guest.newPage()
    const room = await create(a)
    await a.getByRole('button', { name: '复制邀请链接', exact: true }).click()
    const link = await a.evaluate(() => navigator.clipboard.readText())
    expect(new URL(link).searchParams.get('room')).toBe(room)
    await b.goto(link)
    await expect(b.getByLabel('房间号')).toHaveValue(room)
    await b.getByLabel('昵称').fill('受邀朋友')
    await b.getByRole('button', { name: '加入房间', exact: true }).click()
    await expect(b.getByTestId('room-code')).toHaveText(room)
    await a.getByRole('button', { name: '开始游戏', exact: true }).click()
    await expect(a.getByTestId('table-stage')).toBeVisible()
    await expect(a.getByRole('button', { name: '复制邀请链接', exact: true })).toBeVisible()
    await a.getByRole('button', { name: '复制邀请链接', exact: true }).click()
    expect(await a.evaluate(() => navigator.clipboard.readText())).toBe(link)
  } finally { await host.close(); await guest.close() }
})
