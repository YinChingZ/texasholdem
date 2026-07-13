import { useEffect, useRef } from 'react'
import { X } from 'lucide-react'
import styles from './MobileSheet.module.css'

const focusableSelector = 'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [href], [tabindex]:not([tabindex="-1"])'

export default function MobileSheet({ open, title, onClose, children }) {
  const panelRef = useRef(null)
  const closeRef = useRef(null)

  useEffect(() => {
    if (!open) return undefined
    const returnTarget = document.activeElement
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    closeRef.current?.focus()

    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
        return
      }
      if (event.key !== 'Tab') return
      const focusable = [...panelRef.current.querySelectorAll(focusableSelector)]
      if (!focusable.length) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = previousOverflow
      if (returnTarget instanceof HTMLElement) returnTarget.focus()
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div className={styles.layer}>
      <button className={styles.backdrop} type="button" aria-label={`关闭${title}`} onClick={onClose} />
      <section ref={panelRef} className={styles.sheet} role="dialog" aria-modal="true" aria-labelledby="mobile-sheet-title">
        <header>
          <span className={styles.handle} aria-hidden="true" />
          <h2 id="mobile-sheet-title">{title}</h2>
          <button ref={closeRef} className={styles.close} type="button" aria-label={`关闭${title}`} onClick={onClose}><X size={20} /></button>
        </header>
        <div className={styles.content}>{children}</div>
      </section>
    </div>
  )
}
