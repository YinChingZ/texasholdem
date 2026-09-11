import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import ActionDock from './ActionDock'
const player = { id: 'hero', chips: 200, currentBet: 20 }
const gameState = { players: [player], gameState: 'FLOP', currentPlayerTurn: 'hero', currentBet: 40, minRaise: 20, bigBlind: 20 }

describe('ActionDock', () => {
  it('sends the additional raise amount unchanged', async () => {
    const onAction = vi.fn()
    render(<ActionDock player={player} gameState={gameState} onAction={onAction} />)
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /^加注/ }))
    const amount = screen.getByRole('spinbutton', { name: '额外加注金额' })
    await user.clear(amount)
    await user.type(amount, '40')
    await user.click(screen.getByRole('button', { name: '确认加注 40' }))
    expect(onAction).toHaveBeenCalledWith('raise', 40)
  })

  it('closes a pending raise immediately when the live turn changes', async () => {
    const props = { player, gameState, onAction: vi.fn() }
    const { rerender } = render(<ActionDock {...props} />)
    await userEvent.setup().click(screen.getByRole('button', { name: /^加注/ }))
    rerender(<ActionDock {...props} gameState={{ ...gameState, currentPlayerTurn: 'other' }} />)
    expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^确认加注/ })).not.toBeInTheDocument()
    expect(screen.getByTestId('waiting-action')).toBeVisible()
  })

  it('shows the available stack for an all-in call and disallows raising', () => {
    render(<ActionDock player={{ ...player, chips: 10 }} gameState={gameState} onAction={vi.fn()} />)
    expect(screen.getByRole('button', { name: '全押 10' })).toBeEnabled()
    expect(screen.getByRole('button', { name: /^加注/ })).toBeDisabled()
  })

  it('does not offer an action after showdown even if the last turn id remains', () => {
    render(<ActionDock player={player} gameState={{ ...gameState, gameState: 'SHOWDOWN_COMPLETE' }} onAction={vi.fn()} />)
    expect(screen.queryByRole('button', { name: '弃牌' })).not.toBeInTheDocument()
    expect(screen.getByText('本手结束')).toBeVisible()
  })
})
