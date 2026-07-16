// 音效管理器：基于真实采样（CC0，见 public/sounds/LICENSE.md）的 Web Audio 播放引擎。
// 首次用户手势时创建 AudioContext 并预载全部采样。

const SOUND_FILES = {
  dealCard: ['deal-1.m4a', 'deal-2.m4a'],
  flipCard: ['flip-1.m4a', 'flip-2.m4a'],
  fold: ['fold.m4a'],
  check: ['check.m4a'],
  betSmall: ['bet-small-1.m4a', 'bet-small-2.m4a'],
  betLarge: ['bet-large.m4a'],
  allIn: ['all-in-1.m4a'],
  allInLayer: ['all-in-2.m4a'],
  potCollect: ['pot-collect.m4a'],
  win: ['win.m4a'],
  yourTurn: ['your-turn.m4a'],
  click: ['click.m4a'],
}

const SOUND_BASE_PATH = '/sounds/'
const STORAGE_ENABLED = 'soundEnabled'
const STORAGE_VOLUME = 'soundVolume'

function readStoredSettings() {
  const settings = { enabled: true, volume: 0.5 }
  try {
    const storedEnabled = localStorage.getItem(STORAGE_ENABLED)
    if (storedEnabled !== null) settings.enabled = storedEnabled === 'true'
    const storedVolume = Number.parseFloat(localStorage.getItem(STORAGE_VOLUME))
    if (Number.isFinite(storedVolume)) settings.volume = Math.min(1, Math.max(0, storedVolume))
  } catch {
    // localStorage 不可用（隐私模式/测试环境）时使用默认值
  }
  return settings
}

export class SoundManager {
  constructor() {
    const { enabled, volume } = readStoredSettings()
    this.enabled = enabled
    this.volume = volume
    this.audioContext = null
    this.masterGain = null
    this.buffers = new Map()
    this.loadPromise = null
    this.lastPlayTime = {}
    this.attachGestureListeners()
  }

  attachGestureListeners() {
    if (typeof document === 'undefined') return
    const unlock = () => {
      document.removeEventListener('click', unlock)
      document.removeEventListener('keydown', unlock)
      document.removeEventListener('touchstart', unlock)
      this.ensureContext()
      this.loadAll()
    }
    document.addEventListener('click', unlock)
    document.addEventListener('keydown', unlock)
    document.addEventListener('touchstart', unlock)
  }

  ensureContext() {
    if (this.audioContext) {
      if (this.audioContext.state === 'suspended') this.audioContext.resume().catch(() => {})
      return this.audioContext
    }
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext
      this.audioContext = new Ctx()
      this.masterGain = this.audioContext.createGain()
      this.masterGain.gain.value = this.volume
      this.masterGain.connect(this.audioContext.destination)
    } catch {
      this.enabled = false
    }
    return this.audioContext
  }

  loadAll() {
    if (this.loadPromise || !this.audioContext) return this.loadPromise
    const entries = Object.entries(SOUND_FILES).flatMap(([name, files]) =>
      files.map((file, index) => ({ key: `${name}:${index}`, file })))
    this.loadPromise = Promise.all(entries.map(async ({ key, file }) => {
      try {
        const response = await fetch(`${SOUND_BASE_PATH}${file}`)
        if (!response.ok) return
        const arrayBuffer = await response.arrayBuffer()
        const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer)
        this.buffers.set(key, audioBuffer)
      } catch {
        // 单个采样加载失败时静默降级：对应音效不播放
      }
    }))
    return this.loadPromise
  }

  canPlaySound(name, throttleMs) {
    const now = Date.now()
    if (now - (this.lastPlayTime[name] || 0) < throttleMs) return false
    this.lastPlayTime[name] = now
    return true
  }

  pickBuffer(name) {
    const variants = SOUND_FILES[name]
    if (!variants) return null
    const index = variants.length > 1 ? Math.floor(Math.random() * variants.length) : 0
    return this.buffers.get(`${name}:${index}`) ?? this.buffers.get(`${name}:0`) ?? null
  }

  play(name, { volume = 1, rate = 1, delayMs = 0, throttleMs = 60 } = {}) {
    if (!this.enabled) return
    if (!this.canPlaySound(name, throttleMs)) return
    const context = this.ensureContext()
    if (!context) return
    this.loadAll()
    const buffer = this.pickBuffer(name)
    if (!buffer) return
    try {
      const source = context.createBufferSource()
      source.buffer = buffer
      source.playbackRate.value = rate
      const gain = context.createGain()
      gain.gain.value = volume
      source.connect(gain)
      gain.connect(this.masterGain)
      source.start(context.currentTime + delayMs / 1000)
    } catch {
      // 播放失败静默忽略
    }
  }

  // ——— 游戏事件语义封装 ———

  playDeal() {
    this.play('dealCard', { throttleMs: 90 })
  }

  playCardFlip() {
    this.play('flipCard', { throttleMs: 120 })
  }

  playFold() {
    this.play('fold')
  }

  playCheck() {
    // 低速率播放让纸牌落桌声更接近叩桌
    this.play('check', { rate: 0.82 })
  }

  playBet(amount = 0, potSize = 0) {
    const isLarge = potSize > 0 ? amount >= potSize * 0.6 : amount > 200
    this.play(isLarge ? 'betLarge' : 'betSmall')
  }

  playAllIn() {
    this.play('allIn', { volume: 0.9 })
    this.play('allInLayer', { delayMs: 90 })
  }

  playPotCollect() {
    this.play('potCollect')
  }

  playWin() {
    this.play('win', { volume: 0.8, throttleMs: 500 })
  }

  playYourTurn() {
    this.play('yourTurn', { volume: 0.7, throttleMs: 1000 })
  }

  playClick() {
    this.play('click', { volume: 0.6, throttleMs: 40 })
  }

  // ——— 设置 ———

  setVolume(volume) {
    this.volume = Math.max(0, Math.min(1, volume))
    if (this.masterGain) this.masterGain.gain.value = this.volume
    try {
      localStorage.setItem(STORAGE_VOLUME, String(this.volume))
    } catch { /* 忽略 */ }
  }

  setEnabled(enabled) {
    this.enabled = enabled
    try {
      localStorage.setItem(STORAGE_ENABLED, String(enabled))
    } catch { /* 忽略 */ }
  }

  getSettings() {
    return { enabled: this.enabled, volume: this.volume }
  }
}

export const soundManager = new SoundManager()
