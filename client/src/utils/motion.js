// 动画节奏常量（毫秒）。与 styles/tokens.css 的 timing token 保持同一数量级。
export const DWELL = {
  handStarted: 300,
  fold: 400,
  check: 400,
  call: 600,
  bet: 600,
  raise: 600,
  allin: 800,
  perStreetCard: 260,
  streetSettle: 240,
  showdownReveal: 700,
  potAwarded: 900,
}

// 行动气泡在座位上的停留时间
export const BADGE_LIFETIME = 1400
// 筹码飞行动画时长（与 ChipFlight.module.css 的 transition 对应）
export const FLIGHT_LIFETIME = 900
// 队列积压超过该值时快进（防展示态与权威态背离）
export const MAX_QUEUE_DELAY = 2500

export function prefersReducedMotion() {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}
