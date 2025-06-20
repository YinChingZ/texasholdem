import { useEffect, useRef } from 'react';
import { soundManager } from '../utils/soundManager';

// 游戏音效控制Hook
export const useGameSounds = (gameState, previousGameState) => {    const prevMainPot = useRef(0);
    const prevCurrentBet = useRef(0);
    const prevPlayers = useRef([]);
    const prevGameState = useRef('WAITING');

    useEffect(() => {
        if (!gameState) return;

        // 检测游戏阶段变化（翻牌音效）
        if (gameState.gameState !== prevGameState.current) {
            const newPhase = gameState.gameState?.toUpperCase();
            const prevPhase = prevGameState.current?.toUpperCase();
            
            console.log('Game phase changed:', { prevPhase, newPhase });
            
            // 当从一个阶段进入有新牌翻开的阶段时播放翻牌音效
            if ((newPhase === 'FLOP' && prevPhase === 'PREFLOP') ||
                (newPhase === 'TURN' && prevPhase === 'FLOP') ||
                (newPhase === 'RIVER' && prevPhase === 'TURN')) {
                console.log('Playing card flip sound for phase:', newPhase);
                soundManager.playCardFlip();
            }
        }
        prevGameState.current = gameState.gameState;

        // 检测奖池变化（只在实际增加时播放）
        if (gameState.mainPot > prevMainPot.current && prevMainPot.current > 0) {
            soundManager.playPotIncrease();
        }
        prevMainPot.current = gameState.mainPot;        // 检测当前最高下注变化（有人加注时）
        if (gameState.currentBet > prevCurrentBet.current && prevCurrentBet.current > 0) {
            const betAmount = gameState.currentBet - prevCurrentBet.current;
            console.log('Playing bet sound for amount:', betAmount);
            soundManager.playBet(betAmount);
        }
        prevCurrentBet.current = gameState.currentBet;

        // 检测玩家状态和筹码变化
        if (gameState.players && prevPlayers.current.length > 0) {
            gameState.players.forEach((player, index) => {
                const prevPlayer = prevPlayers.current[index];
                if (prevPlayer) {
                    // 检测全押状态
                    if (player.status === 'all-in' && prevPlayer.status !== 'all-in') {
                        soundManager.playAllIn();
                    }
                    
                    // 检测筹码变化（赢钱或输钱）
                    if (player.chips !== prevPlayer.chips) {
                        const change = player.chips - prevPlayer.chips;
                        if (change > 0) {
                            soundManager.playChipGain();
                        } else if (change < 0) {
                            soundManager.playChipLoss();
                        }
                    }
                }
            });
        }
        prevPlayers.current = gameState.players ? [...gameState.players] : [];

    }, [gameState, previousGameState]);
};

export default useGameSounds;
