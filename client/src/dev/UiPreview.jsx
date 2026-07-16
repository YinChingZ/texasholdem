import { useEffect, useState } from 'react'
import GameTable from '../components/GameTable'
import GlobalMessage from '../components/GlobalMessage'
import { SocketContext } from '../contexts/socket-context'
import { createPreviewValue, demoScript, previewStateNames } from './previewFixtures'
import styles from './UiPreview.module.css'

// 脚本化演示：按帧步进 gameState，完整播放一手牌的动画与音效节奏
function DemoPreview() {
  const [step, setStep] = useState(0)
  const frame = demoScript[Math.min(step, demoScript.length - 1)]

  useEffect(() => {
    if (step >= demoScript.length - 1) return undefined
    const timer = window.setTimeout(() => setStep((current) => current + 1), frame.holdMs ?? 1800)
    return () => window.clearTimeout(timer)
  }, [step, frame.holdMs])

  const value = {
    ...createPreviewValue('game-turn'),
    gameState: frame.gameState,
    handResult: frame.handResult ?? null,
  }
  return (
    <SocketContext.Provider value={value}>
      <GameTable />
    </SocketContext.Provider>
  )
}

export default function UiPreview({ state }) {
  const baseValue = createPreviewValue(state)
  const [handResult, setHandResult] = useState(baseValue.handResult)

  if (!previewStateNames.includes(state)) {
    return (
      <main className={styles.index}>
        <p>未知预览状态：<code>{state}</code></p>
        <h1>UI Preview</h1>
        <nav>
          {previewStateNames.map((name) => (
            <a key={name} href={`?uiPreview=${name}`}>{name}</a>
          ))}
        </nav>
      </main>
    )
  }

  if (state === 'game-demo') {
    return <DemoPreview />
  }

  if (state === 'message-allin') {
    return (
      <SocketContext.Provider value={createPreviewValue('game-turn')}>
        <GameTable />
        <GlobalMessage type="allin" message="北岸宣布全押" show duration={60000} />
      </SocketContext.Provider>
    )
  }

  return (
    <SocketContext.Provider key={state} value={{ ...baseValue, handResult, clearHandResult: () => setHandResult(null) }}>
      <GameTable />
    </SocketContext.Provider>
  )
}
