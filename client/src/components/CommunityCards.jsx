import React, { useState, useEffect } from 'react';
import AnimatedCard from './AnimatedCard';
import './CommunityCards.css';

const CommunityCards = ({ cards, gamePhase = 'waiting' }) => {
    const [revealedCards, setRevealedCards] = useState([false, false, false, false, false]);
    const [previousPhase, setPreviousPhase] = useState('waiting');
      // 根据游戏阶段确定应该翻开的牌数
    const getRevealedCardCount = (phase) => {
        const normalizedPhase = phase.toLowerCase();
        switch (normalizedPhase) {
            case 'waiting':
            case 'preflop': 
                return 0;
            case 'flop': 
                return 3;
            case 'turn': 
                return 4;
            case 'river': 
                return 5;
            case 'showdown':
            case 'showdown_complete':
                return 5;
            default: 
                return 0;
        }
    };    useEffect(() => {
        const shouldReveal = getRevealedCardCount(gamePhase);
        const previousReveal = getRevealedCardCount(previousPhase);
        
        // 只有当阶段真正改变且需要翻开更多牌时才触发动画
        if (gamePhase !== previousPhase && shouldReveal > previousReveal) {
            console.log(`Phase changed from ${previousPhase} to ${gamePhase}, revealing ${shouldReveal} cards`);
            
            const newRevealed = Array(5).fill(false);
            for (let i = 0; i < shouldReveal; i++) {
                newRevealed[i] = true;
            }
            setRevealedCards(newRevealed);
        } else if (gamePhase !== previousPhase && shouldReveal < previousReveal) {
            // 新游戏开始，重置所有牌
            console.log(`New game starting, resetting cards`);
            setRevealedCards([false, false, false, false, false]);
        }
        
        setPreviousPhase(gamePhase);
    }, [gamePhase, previousPhase]);

    // 渲染5张牌位置（始终显示5张，背面或正面）
    const renderCards = () => {
        const cardSlots = [];
        for (let i = 0; i < 5; i++) {
            const card = cards && cards[i] ? cards[i] : { suit: 'spades', rank: 'A' }; // 默认牌面用于背面显示
            const isRevealed = revealedCards[i] && cards && cards[i]; // 只有当有实际牌数据时才翻开
            
            cardSlots.push(
                <AnimatedCard
                    key={`card-${i}`}
                    suit={card.suit}
                    rank={card.rank}
                    isRevealed={isRevealed}
                    delay={i * 200} // 错开翻牌时间
                    isCommunityCard={true}
                />
            );
        }
        return cardSlots;
    };

    return (
        <div className="community-cards-container">
            <div className="community-cards-title">
                公共牌
            </div>
            <div className="community-cards-area">
                {renderCards()}
            </div>            <div className="game-phase-indicator">
                {gamePhase.toLowerCase() === 'waiting' && '等待玩家'}
                {gamePhase.toLowerCase() === 'preflop' && '翻牌前'}
                {gamePhase.toLowerCase() === 'flop' && '翻牌 (Flop)'}
                {gamePhase.toLowerCase() === 'turn' && '转牌 (Turn)'}
                {gamePhase.toLowerCase() === 'river' && '河牌 (River)'}
                {gamePhase.toLowerCase() === 'showdown' && '摊牌'}
                {gamePhase.toLowerCase() === 'showdown_complete' && '结算完成'}
            </div></div>
    );
};

export default CommunityCards;
