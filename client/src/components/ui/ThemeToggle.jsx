import { Moon, Sun } from 'lucide-react'
import { useTheme } from '../../contexts/theme-context'
import styles from './ThemeToggle.module.css'

export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme()
  const isLight = theme === 'light'
  const label = isLight ? '切换到夜间模式' : '切换到白天模式'

  return (
    <button className={styles.toggle} type="button" onClick={toggleTheme} aria-label={label} title={label}>
      {isLight ? <Moon aria-hidden="true" size={17} /> : <Sun aria-hidden="true" size={17} />}
      <span>{isLight ? '夜间' : '白天'}</span>
    </button>
  )
}
