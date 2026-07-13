import { useMemo } from 'react'

export function deriveScreen({ room, gameState, connectionStatus, isReconnecting }) {
  if (isReconnecting) return 'reconnecting'
  if (connectionStatus === 'disconnected') return 'disconnected'
  if (!room) return 'welcome'
  if (!gameState) return 'connecting'
  if (gameState.gameState === 'WAITING') return 'lobby'
  return 'game'
}

export function useGameViewModel({
  room,
  gameState,
  connectionStatus,
  isReconnecting,
  socketId,
  isRoomCreator,
  isSpectator,
}) {
  return useMemo(() => {
    const players = gameState?.players ?? []
    return {
      screen: deriveScreen({ room, gameState, connectionStatus, isReconnecting }),
      room,
      gameState,
      players,
      me: players.find((player) => player.id === socketId) ?? null,
      permissions: {
        isRoomCreator,
        isSpectator,
      },
    }
  }, [room, gameState, connectionStatus, isReconnecting, socketId, isRoomCreator, isSpectator])
}
