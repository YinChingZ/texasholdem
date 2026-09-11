import { useEffect, useState, useSyncExternalStore } from 'react'
import { io } from 'socket.io-client'
import { SocketContext } from './socket-context'
import { SessionClient } from '../services/sessionClient'

export const SocketProvider = ({ children }) => {
  const [client] = useState(() => new SessionClient(io(import.meta.env.VITE_API_URL || 'http://localhost:3000', { autoConnect: false })))
  const state = useSyncExternalStore(client.subscribe, client.getSnapshot)
  useEffect(() => { client.start(); return () => client.stop() }, [client])
  const value = { ...state, socket: client.socket, clearError: client.clearError, clearHandResult: client.clearHandResult,
    showLastResult: client.showLastResult, attemptReconnect: client.attemptReconnect, takeover: client.takeover,
    returnHome: client.home, leaveRoom: client.leaveRoom, dismissNotice: client.dismissNotice }
  return <SocketContext.Provider value={value}>{children}</SocketContext.Provider>
}
