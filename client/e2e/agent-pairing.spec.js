import { test, expect } from '@playwright/test'

for (const width of [1440,390]) test(`远程配对与三客户端配置 ${width}`, async ({ page, request, baseURL }) => {
  await page.setViewportSize({width,height:900})
  await page.emulateMedia({colorScheme:'light'})
  await page.goto('/')
  await page.getByLabel('昵称').fill('配对测试')
  await page.getByRole('button',{name:/创建新房间/}).click()
  await page.getByRole('button',{name:'Agent 托管',exact:true}).click()
  const panel=page.getByRole('dialog',{name:'Agent 托管'})
  await page.getByText('① 首次连接：添加牌桌工具').click()
  for(const client of ['claude','deepseek','codex']) {
    await page.getByLabel('使用的客户端').selectOption(client)
    await expect(panel.locator('pre').first()).toContainText('/mcp')
  }
  await page.getByRole('button',{name:'生成配对码',exact:true}).click()
  const code=await page.getByLabel('一次性配对码').inputValue()
  expect(code).toMatch(/^[A-F0-9]{4}(-[A-F0-9]{4}){3}$/)
  expect(await page.evaluate(()=>JSON.stringify({...localStorage,...sessionStorage}))).not.toContain(code)
  // Capture the public setup only, before any generated code is shown in an artifact.
  await page.getByText('① 首次连接：添加牌桌工具').click()
  let seq=0
  const tool=async(name,args)=>{
    const res=await request.post(`${baseURL}/mcp`,{headers:{Accept:'application/json, text/event-stream'},data:{jsonrpc:'2.0',id:++seq,method:'tools/call',params:{name,arguments:args}}})
    expect(res.ok()).toBe(true)
    return JSON.parse((await res.json()).result.content[0].text)
  }
  const paired=await tool('connect_seat',{pairingCode:code})
  expect(paired.ok).toBe(true)
  await expect(page.getByText('Agent 托管 · 在线',{exact:true})).toBeVisible()
  await expect(page.getByLabel('一次性配对码')).toHaveCount(0)
  expect(await panel.evaluate(el=>[el,...el.querySelectorAll('div,pre,input')].every(e=>e.scrollWidth<=e.clientWidth+1))).toBe(true)
  await page.screenshot({path:`/tmp/holdem-pairing-${width}.png`})
  await page.getByRole('button',{name:'停止托管并接回操作',exact:true}).click()
  expect((await tool('get_observation',{seatKey:paired.seatKey})).code).toBe('INVALID_GRANT')
  expect((await tool('connect_seat',{pairingCode:code})).code).toBe('PAIRING_INVALID')
})
