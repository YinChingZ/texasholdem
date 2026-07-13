import { createElement, useEffect, useState } from 'react'
import { CircleDollarSign, Coins, Layers3, TrendingDown, Volume2, VolumeX, Zap } from 'lucide-react'
import { soundManager } from '../utils/soundManager'
import ModalDialog from './ui/ModalDialog'
import { Button } from './ui/Primitives'
import styles from './SoundSettings.module.css'

const soundSamples = [
  { label: '筹码增加', Icon: Coins, play: () => soundManager.playChipGain() },
  { label: '筹码减少', Icon: TrendingDown, play: () => soundManager.playChipLoss() },
  { label: '下注', Icon: CircleDollarSign, play: () => soundManager.playBet(100) },
  { label: '翻牌', Icon: Layers3, play: () => soundManager.playCardFlip() },
  { label: '全押', Icon: Zap, play: () => soundManager.playAllIn() },
  { label: '奖池变化', Icon: Coins, play: () => soundManager.playPotIncrease() },
]

export default function SoundSettings({ isOpen, onClose }) {
  const [soundEnabled, setSoundEnabled] = useState(true)
  const [volume, setVolume] = useState(0.3)

  useEffect(() => {
    const savedSoundEnabled = localStorage.getItem('soundEnabled')
    const savedVolume = Number.parseFloat(localStorage.getItem('soundVolume'))
    if (savedSoundEnabled !== null) {
      const enabled = savedSoundEnabled === 'true'
      setSoundEnabled(enabled)
      soundManager.setEnabled(enabled)
    }
    if (Number.isFinite(savedVolume)) {
      const nextVolume = Math.min(1, Math.max(0, savedVolume))
      setVolume(nextVolume)
      soundManager.setVolume(nextVolume)
    }
  }, [])

  const toggleSound = (enabled) => {
    setSoundEnabled(enabled)
    soundManager.setEnabled(enabled)
    localStorage.setItem('soundEnabled', String(enabled))
  }

  const changeVolume = (nextVolume) => {
    setVolume(nextVolume)
    soundManager.setVolume(nextVolume)
    localStorage.setItem('soundVolume', String(nextVolume))
  }

  return (
    <ModalDialog
      open={isOpen}
      title="音效设置"
      eyebrow="Table audio"
      description="音效只保存在当前浏览器中，不会影响其他玩家。"
      size="small"
      closeLabel="关闭音效设置"
      onClose={onClose}
      footer={<Button onClick={onClose}>完成</Button>}
    >
      <div className={styles.content}>
        <section className={styles.settingRow} aria-labelledby="sound-toggle-label">
          <div className={styles.label}>
            {soundEnabled ? <Volume2 size={19} /> : <VolumeX size={19} />}
            <span><strong id="sound-toggle-label">牌桌音效</strong><small>{soundEnabled ? '行动、筹码与发牌音效已开启' : '当前保持静音'}</small></span>
          </div>
          <div className={styles.segmented} role="group" aria-label="牌桌音效">
            <button type="button" aria-pressed={soundEnabled} className={soundEnabled ? styles.active : ''} onClick={() => toggleSound(true)}>开启</button>
            <button type="button" aria-pressed={!soundEnabled} className={!soundEnabled ? styles.active : ''} onClick={() => toggleSound(false)}>关闭</button>
          </div>
        </section>

        <section className={`${styles.volume} ${!soundEnabled ? styles.disabled : ''}`}>
          <div className={styles.volumeHeading}>
            <label htmlFor="sound-volume">音量</label>
            <output htmlFor="sound-volume">{Math.round(volume * 100)}%</output>
          </div>
          <input
            id="sound-volume"
            type="range"
            min="0"
            max="1"
            step="0.1"
            value={volume}
            disabled={!soundEnabled}
            onChange={(event) => changeVolume(Number.parseFloat(event.target.value))}
          />
        </section>

        <section className={`${styles.samples} ${!soundEnabled ? styles.disabled : ''}`} aria-labelledby="sound-samples-title">
          <div className={styles.sampleHeading}>
            <h3 id="sound-samples-title">试听提示音</h3>
            <span>仅在本机播放</span>
          </div>
          <div className={styles.sampleGrid}>
            {soundSamples.map(({ label, Icon, play }) => (
              <button type="button" key={label} disabled={!soundEnabled} onClick={play}>
                {createElement(Icon, { size: 17 })}<span>{label}</span>
              </button>
            ))}
          </div>
        </section>
      </div>
    </ModalDialog>
  )
}
