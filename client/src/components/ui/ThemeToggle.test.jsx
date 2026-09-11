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

  it('starts in night mode and persists a daylight choice', async () => {
    const user = userEvent.setup()
    render(<ThemeProvider><ThemeToggle /></ThemeProvider>)

    expect(screen.getByRole('button', { name: '切换到白天模式' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '切换到白天模式' }))

    expect(document.documentElement).toHaveAttribute('data-theme', 'light')
    expect(window.localStorage.getItem('texasholdem_theme')).toBe('light')
    expect(screen.getByRole('button', { name: '切换到夜间模式' })).toBeInTheDocument()
  })
  it('preserves an existing daylight choice', () => {
    window.localStorage.setItem('texasholdem_theme', 'light')
    render(<ThemeProvider><ThemeToggle /></ThemeProvider>)
    expect(document.documentElement).toHaveAttribute('data-theme', 'light')
  })

})
