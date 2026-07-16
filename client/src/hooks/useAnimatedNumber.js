import { useEffect, useRef, useState } from 'react'
import { prefersReducedMotion } from '../utils/motion'

// 数字滚动：value 变化时用 rAF 缓动到新值（reduced-motion 时瞬时）
export function useAnimatedNumber(value, duration = 400) {
  const [display, setDisplay] = useState(value)
  const fromRef = useRef(value)

  useEffect(() => {
    if (value === fromRef.current) return undefined
    if (prefersReducedMotion() || typeof requestAnimationFrame !== 'function') {
      fromRef.current = value
      setDisplay(value)
      return undefined
    }
    const from = fromRef.current
    const start = performance.now()
    let raf
    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration)
      const eased = 1 - (1 - t) ** 3
      setDisplay(Math.round(from + (value - from) * eased))
      if (t < 1) {
        raf = requestAnimationFrame(tick)
      } else {
        fromRef.current = value
      }
    }
    raf = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(raf)
      fromRef.current = value
      setDisplay(value)
    }
  }, [value, duration])

  return display
}
