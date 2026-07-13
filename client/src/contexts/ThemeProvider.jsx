import { useEffect, useMemo, useState } from 'react'
import { ThemeContext } from './theme-context'

const STORAGE_KEY = 'texasholdem_theme'
const themes = new Set(['light', 'dark'])

function getInitialTheme() {
  const previewTheme = import.meta.env.DEV
    ? new URLSearchParams(window.location.search).get('theme')
    : null
  if (themes.has(previewTheme)) return previewTheme

  const savedTheme = window.localStorage.getItem(STORAGE_KEY)
  return themes.has(savedTheme) ? savedTheme : 'light'
}

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(getInitialTheme)

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    window.localStorage.setItem(STORAGE_KEY, theme)
  }, [theme])

  const value = useMemo(() => ({
    theme,
    setTheme,
    toggleTheme: () => setTheme((current) => current === 'light' ? 'dark' : 'light'),
  }), [theme])

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}
