import { fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { describe, expect, it } from 'vitest'
import ModalDialog from './ModalDialog'

function DialogHarness() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>打开结算</button>
      <ModalDialog open={open} title="测试结算" closeLabel="关闭测试结算" onClose={() => setOpen(false)} footer={<button type="button">确认操作</button>}>
        <button type="button">内容操作</button>
      </ModalDialog>
    </>
  )
}

describe('ModalDialog', () => {
  it('traps focus, closes with Escape and restores the trigger', () => {
    render(<DialogHarness />)
    const trigger = screen.getByRole('button', { name: '打开结算' })
    trigger.focus()
    fireEvent.click(trigger)
    expect(screen.getByRole('dialog', { name: '测试结算' })).toBeVisible()
    const closeButtons = screen.getAllByRole('button', { name: '关闭测试结算' })
    expect(closeButtons.at(-1)).toHaveFocus()
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(trigger).toHaveFocus()
  })

  it('closes when its backdrop is activated', () => {
    render(<DialogHarness />)
    fireEvent.click(screen.getByRole('button', { name: '打开结算' }))
    fireEvent.click(screen.getAllByRole('button', { name: '关闭测试结算' })[0])
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
