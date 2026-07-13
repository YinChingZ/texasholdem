import { useState } from 'react'
import GameTable from '../components/GameTable'
import GlobalMessage from '../components/GlobalMessage'
import { SocketContext } from '../contexts/socket-context'
import { createPreviewValue, previewStateNames } from './previewFixtures'
import styles from './UiPreview.module.css'

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
