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

    useEffect(() => {
        socket.on('connect', () => {
            console.log('Connected to server');
            setIsConnected(true);
        });

        socket.on('disconnect', () => {
            console.log('Disconnected from server');
            setIsConnected(false);
        });        socket.on('roomCreated', ({ roomId, isCreator }) => {
            console.log('Room created:', roomId, 'isCreator:', isCreator);
            setRoom({ id: roomId });
            setIsRoomCreator(isCreator || false);
        });

        socket.on('roomJoined', ({ roomId, isCreator }) => {
            console.log('Room joined:', roomId, 'isCreator:', isCreator);
            setRoom({ id: roomId });
            setIsRoomCreator(isCreator || false);
        });        socket.on('gameStateUpdate', (newGameState) => {
            console.log('Game state updated:', newGameState);
            setGameState(newGameState);
            
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
            alert(data.message || '游戏结束');
            // 可选：重置所有状态
            setHandResult(null);
            setPrivateCards([]);
        });socket.on('error', (error) => {
            console.error('Server error:', error);
            const errorMessage = error?.message || error || 'Unknown server error';
            setError(errorMessage);
        });// Clean up on unmount
        return () => {
            socket.off('connect');
            socket.off('disconnect');
            socket.off('roomCreated');
            socket.off('roomJoined');
            socket.off('gameStateUpdate');
            socket.off('dealPrivateCards');
            socket.off('handResult');
            socket.off('becameCreator');
            socket.off('gameOver');
            socket.off('error');
        };
    }, []);    const clearHandResult = () => {
        setHandResult(null);
    };    const value = {
        socket,
        isConnected,
        gameState,
        privateCards,
        room,
        error,
        handResult,
        clearHandResult,
        isRoomCreator  // 导出创建者状态
    };

    return (
        <SocketContext.Provider value={value}>
            {children}
        </SocketContext.Provider>
    );
};
