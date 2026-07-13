import { createElement, useEffect } from 'react'
import styles from './Primitives.module.css'

export function Button({ variant = 'primary', className = '', children, ...props }) {
  return (
    <button className={`${styles.button} ${styles[variant]} ${className}`} {...props}>
      {children}
    </button>
  )
}

export function Input({ label, hint, id, className = '', ...props }) {
  return (
    <label className={styles.field} htmlFor={id}>
      {label && <span className={styles.label}>{label}</span>}
      <input id={id} className={`${styles.input} ${className}`} {...props} />
      {hint && <span className={styles.hint}>{hint}</span>}
    </label>
  )
}

export function Badge({ tone = 'neutral', children }) {
  return <span className={`${styles.badge} ${styles[tone]}`}>{children}</span>
}

export function Panel({ as: Component = 'section', className = '', children, ...props }) {
  return createElement(Component, { className: `${styles.panel} ${className}`, ...props }, children)
}

export function Toast({ message, tone = 'success' }) {
  if (!message) return null
  return <div className={`${styles.toast} ${styles[tone]}`} role="status">{message}</div>
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = '确认',
  cancelLabel = '取消',
  tone = 'danger',
  onConfirm,
  onClose,
}) {
  useEffect(() => {
    if (!open) return undefined
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className={styles.backdrop} role="presentation" onMouseDown={onClose}>
      <section
        className={styles.dialog}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-description"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <h2 id="confirm-dialog-title">{title}</h2>
        <p id="confirm-dialog-description">{description}</p>
        <div className={styles.dialogActions}>
          <Button variant="ghost" onClick={onClose} autoFocus>{cancelLabel}</Button>
          <Button variant={tone} onClick={onConfirm}>{confirmLabel}</Button>
        </div>
      </section>
    </div>
  )
}
