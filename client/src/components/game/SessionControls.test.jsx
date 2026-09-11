import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import SessionControls from './SessionControls'

afterEach(() => vi.useRealTimers())
describe('SessionControls', () => {
  it('counts down using server time and keeps previous-result access outside the modal', () => {
    vi.useFakeTimers();vi.setSystemTime(1000)
    const command=vi.fn(), show=vi.fn()
    render(<SessionControls gameState={{serverNow:11000,nextHandAt:19000,allowedActions:{pause:true},lastResult:{handId:'1'}}} onCommand={command} onShowLastResult={show} />)
    expect(screen.getByText('下一手将在 8 秒后开始')).toBeVisible()
    act(()=>vi.advanceTimersByTime(2000));expect(screen.getByText('下一手将在 6 秒后开始')).toBeVisible()
    fireEvent.click(screen.getByRole('button',{name:'查看上一手'}));expect(show).toHaveBeenCalledOnce()
    fireEvent.click(screen.getByRole('button',{name:'暂停续局'}));expect(command).toHaveBeenCalledWith('pauseGame')
  })
  it('shows the recoverable waiting reason and return-to-table action without host-only buttons', () => {
    const command=vi.fn()
    render(<SessionControls gameState={{serverNow:Date.now(),pauseReason:'等待玩家',self:{role:'player',sittingOut:true},allowedActions:{returnToTable:true}}} onCommand={command} />)
    expect(screen.getByText('等待玩家')).toBeVisible()
    fireEvent.click(screen.getByRole('button',{name:'回到牌桌'}));expect(command).toHaveBeenCalledWith('returnToTable')
    expect(screen.queryByRole('button',{name:'暂停续局'})).not.toBeInTheDocument()
  })
})
