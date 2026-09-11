import { createElement } from 'react'
import styles from './Primitives.module.css'
import ModalDialog from './ModalDialog'

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
  return <ModalDialog open={open} role="alertdialog" title={title} description={description} onClose={onClose} closeLabel="取消操作" footer={<><Button variant="ghost" onClick={onClose}>{cancelLabel}</Button><Button variant={tone} onClick={onConfirm}>{confirmLabel}</Button></>} />
}
