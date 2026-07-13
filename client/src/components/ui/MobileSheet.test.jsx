import { fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { describe, expect, it } from 'vitest'
import MobileSheet from './MobileSheet'

function SheetHarness() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>打开面板</button>
      <MobileSheet open={open} title="测试面板" onClose={() => setOpen(false)}>
        <button type="button">面板操作</button>
      </MobileSheet>
    </>
  )
}

describe('MobileSheet', () => {
  it('closes with Escape and restores focus to its trigger', () => {
    render(<SheetHarness />)
    const trigger = screen.getByRole('button', { name: '打开面板' })
    trigger.focus()
    fireEvent.click(trigger)
    expect(screen.getByRole('dialog', { name: '测试面板' })).toBeVisible()
    const closeButton = screen.getAllByRole('button', { name: '关闭测试面板' }).at(-1)
    expect(closeButton).toHaveFocus()
    fireEvent.keyDown(window, { key: 'Tab', shiftKey: true })
    expect(screen.getByRole('button', { name: '面板操作' })).toHaveFocus()
    fireEvent.keyDown(window, { key: 'Tab' })
    expect(closeButton).toHaveFocus()
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.queryByRole('dialog', { name: '测试面板' })).not.toBeInTheDocument()
    expect(trigger).toHaveFocus()
  })

  it('closes through the backdrop button', () => {
    render(<SheetHarness />)
    fireEvent.click(screen.getByRole('button', { name: '打开面板' }))
    const closeButtons = screen.getAllByRole('button', { name: '关闭测试面板' })
    fireEvent.click(closeButtons[0])
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
