import React, { createContext, useContext, useEffect, useState } from 'react';
import { io } from 'socket.io-client';

const SocketContext = createContext();

export const useSocket = () => {
    return useContext(SocketContext);
};

// 使用环境变量来决定API URL
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';
console.log('Connecting to:', API_URL); // 调试信息
const socket = io(API_URL);

export const SocketProvider = ({ children }) => {
    const [isConnected, setIsConnected] = useState(socket.connected);
    const [gameState, setGameState] = useState(null);
    const [privateCards, setPrivateCards] = useState([]);
    const [room, setRoom] = useState(null);
    const [error, setError] = useState(null);
    const [handResult, setHandResult] = useState(null);
    const [isRoomCreator, setIsRoomCreator] = useState(false);  // 新增：追踪是否为房间创建者
    const [isSpectator, setIsSpectator] = useState(false);  // 新增：追踪是否为旁观者
    const [roomSettings, setRoomSettings] = useState({ showAllHands: true });  // 新增：房间设置状态
    const [connectionStatus, setConnectionStatus] = useState('connected'); // 新增：连接状态
    const [isReconnecting, setIsReconnecting] = useState(false); // 新增：重连状态
    const [hasLeftRoom, setHasLeftRoom] = useState(false); // 新增：标记是否主动退出房间

    // 新增：尝试重连的函数
    const attemptReconnect = () => {
        // 如果用户主动退出房间，不尝试重连
        if (hasLeftRoom) {
            console.log('User has left room intentionally, skipping reconnect');
            return;
        }
        
        const savedRoom = localStorage.getItem('texasholdem_room');
        const savedNickname = localStorage.getItem('texasholdem_nickname');
        
        if (savedRoom && savedNickname) {
            console.log(`Attempting to reconnect to room ${savedRoom} as ${savedNickname}`);
            setIsReconnecting(true);
            socket.emit('attemptReconnect', { 
                roomId: savedRoom, 
                nickname: savedNickname 
            });
        }
    };

    useEffect(() => {
        socket.on('connect', () => {
            console.log('Connected to server');
            setIsConnected(true);
            setConnectionStatus('connected');
            
            // 尝试重连到之前的房间
            attemptReconnect();
        });

        socket.on('disconnect', () => {
            console.log('Disconnected from server');
            setIsConnected(false);
            setConnectionStatus('disconnected');
        });

        // 新增：重连成功处理
        socket.on('reconnectSuccess', ({ roomId, isCreator, message }) => {
            console.log('Reconnect successful:', { roomId, isCreator, message });
            setRoom({ id: roomId });
            setIsRoomCreator(isCreator);
            setIsReconnecting(false);
            setConnectionStatus('connected');
            setError(null);
            setHasLeftRoom(false); // 重置退出标记
            
            // 显示重连成功消息
            alert(message || '重新连接成功！');
        });

        // 新增：重连失败处理
        socket.on('reconnectFailed', ({ message }) => {
            console.log('Reconnect failed:', message);
            setIsReconnecting(false);
            
            // 清理本地存储
            localStorage.removeItem('texasholdem_room');
            localStorage.removeItem('texasholdem_nickname');
            
            // 重置状态
            setRoom(null);
            setGameState(null);
            setPrivateCards([]);
            setIsRoomCreator(false);
            setHandResult(null);
        });

        // 新增：处理玩家临时离线
        socket.on('playerDisconnected', ({ playerId, nickname, temporary }) => {
            console.log(`Player ${nickname} temporarily disconnected`);
            setError(`玩家 ${nickname} 暂时离线，等待重连中...`);
            
            // 3秒后清除错误消息
            setTimeout(() => {
                setError(null);
            }, 3000);
        });

        // 新增：成功退出房间
        socket.on('leftRoom', ({ roomId, message }) => {
            console.log('Left room successfully:', { roomId, message });
            
            // 标记用户主动退出房间
            setHasLeftRoom(true);
            
            // 清理本地存储
            localStorage.removeItem('texasholdem_room');
            localStorage.removeItem('texasholdem_nickname');
            
            // 重置所有状态
            setRoom(null);
            setGameState(null);
            setPrivateCards([]);
            setIsRoomCreator(false);
            setHandResult(null);
            setConnectionStatus('connected');
            setIsReconnecting(false);
            setError(null);
            
            // 显示成功消息
            alert(message || '已成功退出房间');
        });        socket.on('roomCreated', ({ roomId, isCreator }) => {
            console.log('Room created:', roomId, 'isCreator:', isCreator);
            setRoom({ id: roomId });
            setIsRoomCreator(isCreator || false);
            setHasLeftRoom(false); // 重置退出标记
            
            // 保存房间信息到本地存储
            localStorage.setItem('texasholdem_room', roomId);
        });

        socket.on('roomJoined', ({ roomId, isCreator, isSpectator: spectator }) => {
            console.log('Room joined:', roomId, 'isCreator:', isCreator, 'isSpectator:', spectator);
            setRoom({ id: roomId });
            setIsRoomCreator(isCreator || false);
            setIsSpectator(spectator || false);
            setHasLeftRoom(false); // 重置退出标记
            
            // 保存房间信息到本地存储
            localStorage.setItem('texasholdem_room', roomId);
        });        socket.on('roomSettingsUpdate', ({ settings }) => {
            setRoomSettings(settings);
        });        socket.on('gameStateUpdate', (newGameState) => {
            setGameState(newGameState);
            
            // 更新房间设置（从游戏状态中）
            if (newGameState.settings) {
                setRoomSettings(newGameState.settings);
            }
            
            // 如果游戏状态变为WAITING，可能是新的一局开始，清除上局结果和底牌
            if (newGameState.gameState === 'WAITING') {
                setHandResult(null);
                setPrivateCards([]); // 清除旧底牌
            }
            
            // 如果游戏状态变为PREFLOP，也清除旧的手牌结果
            if (newGameState.gameState === 'PREFLOP') {
                setHandResult(null);
            }
            
            if (newGameState.roomId) {
                setRoom({ id: newGameState.roomId });
                // 更新创建者状态
                if (newGameState.creator) {
                    setIsRoomCreator(newGameState.creator === socket.id);
                }
            }
        });

        socket.on('dealPrivateCards', ({ hand }) => {
            console.log('Received private cards', hand);
            setPrivateCards(hand);
        });        socket.on('handResult', (result) => {
            console.log('Hand result received:', {
                winners: result.winners,
                playersHandsCount: result.playersHands?.length || 0,
                communityCardsCount: result.communityCards?.length || 0,
                playersHands: result.playersHands            });
            setHandResult(result);
            // 注释掉自动清除结果的机制，改为手动关闭
            // setTimeout(() => {
            //     setHandResult(null);
            // }, 10000); // 10秒后清除结果
        });        socket.on('becameCreator', ({ roomId }) => {
            console.log('Became room creator for room:', roomId);
            setIsRoomCreator(true);
        });

        socket.on('gameOver', (data) => {
            console.log('Game over:', data);
            // The leaderboard data will come through gameStateUpdate
            // Just clear hand result and private cards
            setHandResult(null);
            setPrivateCards([]);
        });

        socket.on('roomClosed', (data) => {
            console.log('Room closed:', data);
            alert(data.message || '房间已关闭');
            
            // Clear all state and return to login
            setHasLeftRoom(true);
            localStorage.removeItem('texasholdem_room');
            localStorage.removeItem('texasholdem_nickname');
            setRoom(null);
            setGameState(null);
            setPrivateCards([]);
            setIsRoomCreator(false);
            setHandResult(null);
        });

        socket.on('gameReset', (data) => {
            console.log('Game reset:', data);
            // 清除手牌结果和私人手牌
            setHandResult(null);
            setPrivateCards([]);
            // 可选：显示提示消息
            if (data.message) {
                alert(data.message);
            }
        });

        socket.on('gameResetDueToInsufficientPlayers', (data) => {
            console.log('Game reset due to insufficient players:', data);
            // 清除手牌结果和私人手牌
            setHandResult(null);
            setPrivateCards([]);
            // 显示提示消息给房主
            if (data.message) {
                alert(data.message);
            }
        });

        socket.on('error', (error) => {
            console.error('Server error:', error);
            const errorMessage = error?.message || error || 'Unknown server error';
            setError(errorMessage);
        });// Clean up on unmount
        return () => {
            socket.off('connect');
            socket.off('disconnect');
            socket.off('reconnectSuccess');
            socket.off('reconnectFailed');
            socket.off('playerDisconnected');
            socket.off('leftRoom');
            socket.off('roomCreated');
            socket.off('roomJoined');
            socket.off('roomSettingsUpdate');
            socket.off('gameStateUpdate');
            socket.off('dealPrivateCards');
            socket.off('handResult');
            socket.off('becameCreator');
            socket.off('gameOver');
            socket.off('roomClosed');
            socket.off('gameReset');
            socket.off('gameResetDueToInsufficientPlayers');
            socket.off('error');
        };
    }, []);    const clearHandResult = () => {
        setHandResult(null);
    };    // 新增：退出房间的函数
    const leaveRoom = () => {
        if (room && room.id) {
            console.log(`Leaving room: ${room.id}`);
            setHasLeftRoom(true); // 标记用户主动退出
            socket.emit('leaveRoom', { roomId: room.id });
        }
    };

    const value = {
        socket,
        isConnected,
        gameState,
        privateCards,
        room,
        error,
        handResult,
        clearHandResult,
        isRoomCreator,  // 导出创建者状态
        isSpectator,    // 导出旁观者状态
        roomSettings,   // 导出房间设置状态
        connectionStatus, // 导出连接状态
        isReconnecting,   // 导出重连状态
        attemptReconnect, // 导出重连函数
        leaveRoom       // 导出退出房间函数
    };

    return (
        <SocketContext.Provider value={value}>
            {children}
        </SocketContext.Provider>
    );
};
