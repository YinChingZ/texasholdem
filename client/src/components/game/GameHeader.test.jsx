import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import GameHeader from './GameHeader'

describe('GameHeader connection indicator', () => {
  it.each(['connected', 'synced'])('does not warn for a healthy %s session', connectionStatus => {
    render(<GameHeader roomId="ROOM" gameState={{}} connectionStatus={connectionStatus} />)
    expect(screen.queryByText('连接异常')).not.toBeInTheDocument()
  })
  it.each(['disconnected', 'reconnecting', 'expired'])('warns for %s', connectionStatus => {
    render(<GameHeader roomId="ROOM" gameState={{}} connectionStatus={connectionStatus} />)
    expect(screen.getByRole('status')).toHaveTextContent('连接异常')
  })
})
