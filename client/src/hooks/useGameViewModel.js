import { useMemo } from 'react'

export function deriveScreen({ room, gameState, connectionStatus, isReconnecting, hasSessionTarget = false }) {
  if (['in-use', 'replaced', 'expired', 'protocol-error'].includes(connectionStatus)) return connectionStatus
  if (!room && !hasSessionTarget && !isReconnecting) return 'welcome'
  if (isReconnecting) return 'reconnecting'
  if (connectionStatus === 'disconnected') return 'disconnected'
  if (connectionStatus === 'connecting') return 'connecting'
  if (!room) return 'welcome'
  if (!gameState) return 'connecting'
  if (gameState.phase === 'LOBBY' || (!gameState.phase && gameState.gameState === 'WAITING')) return 'lobby'
  return 'game'
}

export function useGameViewModel({
  room,
  gameState,
  connectionStatus,
  isReconnecting,
  hasSessionTarget,
  socketId,
  isRoomCreator,
  isSpectator,
}) {
  return useMemo(() => {
    const players = gameState?.players ?? []
    return {
      screen: deriveScreen({ room, gameState, connectionStatus, isReconnecting, hasSessionTarget }),
      room,
      gameState,
      players,
      me: players.find((player) => player.id === socketId) ?? null,
      permissions: {
        isRoomCreator,
        isSpectator,
      },
    }
  }, [room, gameState, connectionStatus, isReconnecting, hasSessionTarget, socketId, isRoomCreator, isSpectator])
}
