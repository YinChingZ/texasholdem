import { useEffect, useState } from 'react'
import { useSocket } from '../contexts/socket-context'

export function useChat(roomId, isVisible) {
  const { socket } = useSocket()
  const [messages, setMessages] = useState([])
  const [draft, setDraft] = useState('')
  const [unreadCount, setUnreadCount] = useState(0)

  useEffect(() => {
    if (!socket) return undefined

    const onMessage = (message) => {
      setMessages((current) => [...current, message])
      if (!isVisible) setUnreadCount((count) => count + 1)
    }

    socket.on('newMessage', onMessage)
    return () => socket.off('newMessage', onMessage)
  }, [socket, isVisible])

  useEffect(() => {
    if (isVisible) setUnreadCount(0)
  }, [isVisible])

  const sendMessage = () => {
    const message = draft.trim()
    if (!message || !socket || !roomId) return
    socket.emit('sendMessage', { roomId, message })
    setDraft('')
  }

  return { messages, draft, setDraft, sendMessage, unreadCount }
}
