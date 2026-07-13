import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import ConnectionScreen from './ConnectionScreen'

describe('ConnectionScreen', () => {
  it('shows the room while connecting', () => {
    render(<ConnectionScreen kind="connecting" roomId="CLUB24" />)
    expect(screen.getByRole('heading', { name: '连接房间中' })).toBeInTheDocument()
    expect(screen.getByText('CLUB24')).toBeInTheDocument()
  })

  it('offers an explicit retry while disconnected', async () => {
    const user = userEvent.setup()
    const onRetry = vi.fn()
    render(<ConnectionScreen kind="disconnected" onRetry={onRetry} />)
    await user.click(screen.getByRole('button', { name: '重新连接' }))
    expect(onRetry).toHaveBeenCalledOnce()
  })
})
