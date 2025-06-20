import React, { useState, useEffect } from 'react';
import Card from './Card';
import './AnimatedCard.css';

const AnimatedCard = ({ 
    suit, 
    rank, 
    isRevealed = false, 
    delay = 0, 
    isCommunityCard = true,
    onFlipComplete = null 
}) => {    const [showFront, setShowFront] = useState(false);
    const [isFlipping, setIsFlipping] = useState(false);    useEffect(() => {
        console.log(`AnimatedCard: isRevealed=${isRevealed}, showFront=${showFront}, suit=${suit}, rank=${rank}`);
        
        // 重置状态以确保正确的翻牌行为
        if (isRevealed && !showFront) {
            // 需要翻牌显示正面
            console.log(`Starting flip animation for ${suit} ${rank} with delay ${delay}ms`);
            const timer = setTimeout(() => {
                setIsFlipping(true);
                // 翻牌动画中间点切换正反面
                setTimeout(() => {
                    setShowFront(true);
                    setTimeout(() => {
                        setIsFlipping(false);
                        if (onFlipComplete) {
                            onFlipComplete();
                        }
                    }, 300); // 翻牌动画的后半段
                }, 300); // 翻牌动画的前半段
            }, delay);

            return () => clearTimeout(timer);
        } else if (!isRevealed && showFront) {
            // 需要翻回背面（新游戏开始）
            console.log(`Resetting card to back face: ${suit} ${rank}`);
            setShowFront(false);
            setIsFlipping(false);
        }
    }, [isRevealed, delay, onFlipComplete, suit, rank]);

    const getCardSize = () => {
        if (isCommunityCard) {
            return { width: '70px', height: '100px', fontSize: '24px', margin: '8px' };
        } else {
            return { width: '50px', height: '70px', fontSize: '18px', margin: '5px' };
        }
    };

    const size = getCardSize();    // 卡牌背面样式
    const cardBackStyle = {
        border: '2px solid #2c3e50',
        borderRadius: '8px',
        width: size.width,
        height: size.height,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        margin: size.margin,
        background: 'linear-gradient(45deg, #1a1a2e 0%, #16213e 30%, #0f3460 70%, #1a1a2e 100%)',
        color: '#ecf0f1',
        fontSize: size.fontSize,
        fontWeight: 'bold',
        position: 'relative',
        cursor: 'default',
        boxShadow: '0 4px 8px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.1)',
        overflow: 'hidden'
    };

    return (
        <div 
            className={`animated-card-container ${isFlipping ? 'flipping' : ''}`}
            style={{ 
                perspective: '1000px',
                display: 'inline-block',
                margin: size.margin
            }}
        >
            <div className="card-inner">                {/* 卡牌背面 */}
                <div 
                    className={`card-back ${showFront ? 'hidden' : ''}`}
                    style={cardBackStyle}
                >
                    <div style={{ 
                        textAlign: 'center',
                        position: 'relative',
                        zIndex: 1
                    }}>
                        <div style={{ 
                            fontSize: isCommunityCard ? '20px' : '14px', 
                            marginBottom: '3px',
                            textShadow: '0 1px 2px rgba(0,0,0,0.5)'
                        }}>♠♥♣♦</div>
                        <div style={{ 
                            fontSize: isCommunityCard ? '10px' : '8px', 
                            opacity: 0.8,
                            letterSpacing: '1px',
                            fontWeight: '600'
                        }}>TEXAS</div>
                        <div style={{ 
                            fontSize: isCommunityCard ? '8px' : '6px', 
                            opacity: 0.6,
                            letterSpacing: '0.5px'
                        }}>HOLD'EM</div>
                    </div>
                    {/* 装饰性边框 */}
                    <div style={{
                        position: 'absolute',
                        top: '4px',
                        left: '4px',
                        right: '4px',
                        bottom: '4px',
                        border: '1px solid rgba(236, 240, 241, 0.2)',
                        borderRadius: '6px',
                        pointerEvents: 'none'
                    }}></div>
                </div>                  {/* 卡牌正面 */}
                <div className={`card-front ${showFront ? 'show' : ''}`}>
                    <div style={{ margin: 0, width: '100%', height: '100%' }}>
                        <Card 
                            suit={suit} 
                            rank={rank} 
                            isCommunityCard={isCommunityCard}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AnimatedCard;
