import { beforeEach, describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ThemeProvider } from '../../contexts/ThemeProvider'
import ThemeToggle from './ThemeToggle'

describe('ThemeToggle', () => {
  beforeEach(() => {
    window.localStorage.removeItem('texasholdem_theme')
    delete document.documentElement.dataset.theme
  })

  it('starts in daylight mode and persists a night-mode choice', async () => {
    const user = userEvent.setup()
    render(<ThemeProvider><ThemeToggle /></ThemeProvider>)

    expect(screen.getByRole('button', { name: '切换到夜间模式' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '切换到夜间模式' }))

    expect(document.documentElement).toHaveAttribute('data-theme', 'dark')
    expect(window.localStorage.getItem('texasholdem_theme')).toBe('dark')
    expect(screen.getByRole('button', { name: '切换到白天模式' })).toBeInTheDocument()
  })
})
