import { useCallback, useEffect, useRef, useState } from 'react'

export function useGlobalMessages(gameState) {
  const [messages, setMessages] = useState([])
  const previousPlayers = useRef([])
  const messageId = useRef(0)
  const removalTimers = useRef(new Map())

  const removeMessage = useCallback((id) => {
    const timer = removalTimers.current.get(id)
    if (timer) window.clearTimeout(timer)
    removalTimers.current.delete(id)
    setMessages((current) => current.filter((message) => message.id !== id))
  }, [])

  const addMessage = useCallback(({ type, message, duration = 3000 }) => {
    const id = messageId.current++
    setMessages((current) => [...current, { id, type, message, duration, show: true }])
    const timer = window.setTimeout(() => removeMessage(id), duration + 250)
    removalTimers.current.set(id, timer)
  }, [removeMessage])

  useEffect(() => {
    const players = Array.isArray(gameState?.players) ? gameState.players : []
    if (!players.length) return

    if (previousPlayers.current.length > 0) {
      players.forEach((player) => {
        const previousPlayer = previousPlayers.current.find((candidate) => candidate.id === player.id)
        if (!previousPlayer) return
        if (player.status === 'all-in' && previousPlayer.status !== 'all-in') {
          addMessage({ type: 'allin', message: `${player.nickname} 宣布全押`, duration: 2500 })
        } else if (player.status === 'folded' && previousPlayer.status !== 'folded') {
          addMessage({ type: 'fold', message: `${player.nickname} 已弃牌`, duration: 2000 })
        }
      })
    }

    previousPlayers.current = players.map((player) => ({ ...player }))
  }, [gameState, addMessage])

  useEffect(() => () => {
    removalTimers.current.forEach((timer) => window.clearTimeout(timer))
    removalTimers.current.clear()
  }, [])

  return { messages, addMessage, removeMessage }
}
