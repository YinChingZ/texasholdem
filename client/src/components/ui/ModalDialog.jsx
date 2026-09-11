import { createPortal } from 'react-dom'
import { useEffect, useId, useRef } from 'react'
import { X } from 'lucide-react'
import styles from './ModalDialog.module.css'

const focusableSelector = 'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), summary, [href], [tabindex]:not([tabindex="-1"])'

export default function ModalDialog({
  open = true,
  role = 'dialog',
  title,
  eyebrow,
  description,
  size = 'medium',
  closeLabel = '关闭弹窗',
  onClose,
  children,
  footer,
}) {
  const titleId = useId()
  const descriptionId = useId()
  const panelRef = useRef(null)
  const closeRef = useRef(null)
  const onCloseRef = useRef(onClose)
  useEffect(() => { onCloseRef.current = onClose }, [onClose])

  useEffect(() => {
    if (!open) return undefined
    const returnTarget = document.activeElement
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    closeRef.current?.focus()

    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onCloseRef.current?.()
        return
      }
      if (event.key !== 'Tab' || !panelRef.current) return
      const focusable = [...panelRef.current.querySelectorAll(focusableSelector)].filter(element => !element.closest('details:not([open])') || element.tagName === 'SUMMARY')
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
  }, [open])

  if (!open) return null

  return createPortal(
    <div className={styles.layer}>
      <button className={styles.backdrop} type="button" aria-label={closeLabel} onClick={onClose} />
      <section
        ref={panelRef}
        className={`${styles.dialog} ${styles[size] ?? ''}`}
        role={role}
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
      >
        <header className={styles.header}>
          <div>
            {eyebrow && <p className={styles.eyebrow}>{eyebrow}</p>}
            <h2 id={titleId}>{title}</h2>
            {description && <p id={descriptionId} className={styles.description}>{description}</p>}
          </div>
          <button ref={closeRef} className={styles.close} type="button" aria-label={closeLabel} onClick={onClose}>
            <X size={20} />
          </button>
        </header>
        <div className={styles.body}>{children}</div>
        {footer && <footer className={styles.footer}>{footer}</footer>}
      </section>
    </div>, document.body
  )
}
