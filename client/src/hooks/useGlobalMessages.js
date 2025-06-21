import { useState, useEffect, useRef } from 'react';

export const useGlobalMessages = (gameState, previousGameState) => {
    const [messages, setMessages] = useState([]);
    const prevPlayers = useRef([]);
    const messageId = useRef(0);

    useEffect(() => {
        if (!gameState || !gameState.players) return;

        // 检测玩家状态变化
        if (prevPlayers.current.length > 0) {
            gameState.players.forEach((player, index) => {
                const prevPlayer = prevPlayers.current.find(p => p.id === player.id);
                if (prevPlayer) {
                    // 检测全押
                    if (player.status === 'all-in' && prevPlayer.status !== 'all-in') {
                        addMessage({
                            type: 'allin',
                            message: `${player.nickname} 全押!`,
                            duration: 2500
                        });
                    }
                    
                    // 检测弃牌
                    if (player.status === 'folded' && prevPlayer.status !== 'folded') {
                        addMessage({
                            type: 'fold',
                            message: `${player.nickname} 弃牌`,
                            duration: 2000
                        });
                    }
                }
            });
        }

        // 更新上一次的玩家状态
        prevPlayers.current = gameState.players ? [...gameState.players] : [];

    }, [gameState]);

    const addMessage = ({ type, message, duration = 3000 }) => {
        const id = messageId.current++;
        const newMessage = {
            id,
            type,
            message,
            duration,
            show: true
        };

        setMessages(prev => [...prev, newMessage]);

        // 自动移除消息
        setTimeout(() => {
            setMessages(prev => prev.filter(m => m.id !== id));
        }, duration + 1000); // 给动画时间
    };

    const removeMessage = (id) => {
        setMessages(prev => prev.filter(m => m.id !== id));
    };

    return {
        messages,
        addMessage,
        removeMessage
    };
};
