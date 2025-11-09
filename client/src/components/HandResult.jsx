import React from 'react';
import Card from './Card';
import { useSocket } from '../contexts/SocketContext';
import './HandResult.css';

// 花色映射
const suitMap = {
    'Hearts': '♥',
    'Diamonds': '♦', 
    'Clubs': '♣',
    'Spades': '♠',
    'H': '♥',
    'D': '♦',
    'C': '♣',
    'S': '♠',
    'h': '♥',
    'd': '♦',
    'c': '♣',
    's': '♠'
};

// 转换牌面显示
const formatCard = (card) => {
    if (typeof card === 'string') {
        // 处理 "Ah", "Kd" 格式
        if (card.length >= 2) {
            const rank = card.slice(0, -1);
            const suit = card.slice(-1);
            return rank + (suitMap[suit] || suit);
        }
        return card;
    }
    // 处理对象格式
    if (card && card.rank && card.suit) {
        return card.rank + (suitMap[card.suit] || card.suit);
    }
    return card;
};

const HandResult = ({ result, socket, roomId, onClose, gameState, onEndGame }) => {
    const { isRoomCreator } = useSocket();
    
    if (!result) return null;

    const { winners, communityCards, playersHands, handComparison, showAllHands } = result;
    
    // Check how many players have chips remaining
    const playersWithChips = gameState?.players?.filter(p => p.chips > 0).length || 0;
    const onlyOnePlayerLeft = playersWithChips <= 1;
      // 处理不同格式的卡牌数据的辅助函数
    const parseCardData = (card) => {
        if (typeof card === 'string') {
            // 如果是字符串格式，如 "Ah", "Kd"
            if (card.length >= 2) {
                const cardRank = card.slice(0, -1);
                const suitChar = card.slice(-1);
                
                // 映射花色字符到完整名称
                const suitMapping = {
                    'h': 'Hearts', 'H': 'Hearts',
                    'd': 'Diamonds', 'D': 'Diamonds', 
                    'c': 'Clubs', 'C': 'Clubs',
                    's': 'Spades', 'S': 'Spades'
                };
                
                return {
                    rank: cardRank,
                    suit: suitMapping[suitChar] || 'Spades'
                };
            }
        }
        
        // 如果已经是对象格式
        if (card && typeof card === 'object' && card.rank && card.suit) {
            return {
                rank: card.rank,
                suit: card.suit
            };
        }
          // 默认返回
        return { rank: 'A', suit: 'Spades' };
    };
    
    // 添加调试信息和安全检查
    console.log('HandResult received data:', {
        winners,
        playersHands,
        handComparison,
        hasHandComparison: !!handComparison,
        rankedPlayersCount: handComparison?.rankedPlayers?.length || 0,
        communityCards
    });

    // 安全检查数组数据
    const safeCommunityCards = Array.isArray(communityCards) ? communityCards : [];
    const safePlayersHands = Array.isArray(playersHands) ? playersHands : [];
    const safeWinners = Array.isArray(winners) ? winners : [];    const handleContinueGame = () => {
        // 发送准备下一手的事件
        console.log('Attempting to continue game with roomId:', roomId);
        if (socket && roomId) {
            socket.emit('prepareNextHand', { roomId });
            console.log('prepareNextHand event sent');
        } else {
            console.error('Cannot continue game - missing socket or roomId:', { socket: !!socket, roomId });
        }
        // 关闭结算界面
        onClose();
    };

    return (
        <div className="hand-result-overlay">
            <div className="hand-result-modal compact">
                <h2>手牌结果</h2>
                
                {/* 上半部分：公共牌和获胜者横向布局 */}
                <div className="result-top-section">                    <div className="community-cards">
                        <h3>公共牌</h3>                        <div className="cards-display">
                            {safeCommunityCards.map((card, index) => {
                                const { suit, rank } = parseCardData(card);
                                
                                return (
                                    <Card
                                        key={index}
                                        suit={suit}
                                        rank={rank}
                                        isCommunityCard={true}
                                    />
                                );
                            })}
                        </div>
                    </div>

                    <div className="winners">
                        <h3>获胜者</h3>
                        {safeWinners.map((winner, index) => (
                            <div key={index} className="winner compact">
                                🏆 {winner.nickname || `玩家 ${winner.playerId}`} 
                                {winner.amount && <span className="amount">(+{winner.amount})</span>}
                                {winner.handDescription && (
                                    <div className="winner-hand-desc">{winner.handDescription}</div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>

                {/* 中间部分：牌型对比和玩家手牌横向布局 */}
                <div className="result-middle-section">                    {/* 牌型对比 */}
                    {showAllHands && handComparison && handComparison.rankedPlayers && handComparison.rankedPlayers.length > 0 && (
                        <div className="hand-comparison">
                            <h3>牌型排名</h3>
                            <div className="ranked-players-grid">
                                {handComparison.rankedPlayers.map((player, index) => (
                                    <div 
                                        key={player.playerId} 
                                        className={`ranked-player-compact ${index === 0 ? 'winner-rank' : ''}`}
                                    >
                                        <span className="rank-badge-small">#{player.rank}</span>
                                        <div className="player-info-compact">
                                            <div className="player-name-compact">
                                                {player.nickname || `玩家 ${player.playerId}`}
                                                {index === 0 && ' 👑'}
                                            </div>
                                            <div className="hand-type-compact">{player.handDescription}</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}                    {/* 玩家手牌详情 */}
                    {safePlayersHands.length > 0 && (
                        <div className="players-hands">
                            <h3>手牌详情</h3>
                            <div className="players-grid">
                                {safePlayersHands.map((playerHand, index) => (
                                    <div 
                                        key={index} 
                                        className={`player-hand-compact ${playerHand.isWinner ? 'winner-hand' : ''}`}
                                    >
                                        <div className="player-header">
                                            <span className="player-name">
                                                {playerHand.nickname || `玩家 ${playerHand.playerId}`}
                                                {playerHand.isWinner && ' 🎉'}
                                            </span>
                                            {playerHand.rank && <span className="rank-badge-tiny">#{playerHand.rank}</span>}
                                        </div>
                                        
                                        {playerHand.handDescription && (
                                            <div className="hand-description-compact">
                                                {playerHand.handDescription}
                                            </div>
                                        )}

                                        <div className="cards-row">
                                            <div className="hole-cards-inline">
                                                <span className="cards-label-tiny">底牌:</span>                                                <div className="inline-cards">
                                                    {playerHand.hand && Array.isArray(playerHand.hand) && playerHand.hand.map((card, cardIndex) => {
                                                        const processedCard = parseCardData(card);
                                                        
                                                        return (
                                                            <Card
                                                                key={cardIndex}
                                                                suit={processedCard.suit}
                                                                rank={processedCard.rank}
                                                                isPlayerCard={true}
                                                            />
                                                        );
                                                    })}
                                                </div>
                                            </div>

                                            {playerHand.bestCards && Array.isArray(playerHand.bestCards) && playerHand.bestCards.length > 0 && (
                                                <div className="best-cards-inline">
                                                    <span className="cards-label-tiny">最佳组合:</span>                                                    <div className="inline-cards">
                                                        {playerHand.bestCards.slice(0, 5).map((card, cardIndex) => {
                                                            const processedCard = parseCardData(card);
                                                            
                                                            return (
                                                                <Card
                                                                    key={cardIndex}
                                                                    suit={processedCard.suit}
                                                                    rank={processedCard.rank}
                                                                    isPlayerCard={true}
                                                                />
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}</div>                {/* 当手牌被隐藏时的提示 */}
                {!showAllHands && (
                    <div style={{
                        padding: '15px',
                        backgroundColor: '#f8f9fa',
                        borderRadius: '8px',
                        border: '1px solid #dee2e6',
                        textAlign: 'center',
                        margin: '20px 0',
                        color: '#6c757d',
                        fontSize: '14px'
                    }}>
                        🔒 房主设置为仅显示获胜者手牌，其他玩家手牌已隐藏
                    </div>
                )}

                {/* 如果没有牌型对比数据，显示调试信息 */}
                {showAllHands && (!handComparison || !handComparison.rankedPlayers || handComparison.rankedPlayers.length === 0) && (
                    <div className="debug-info" style={{color: 'yellow', padding: '5px', fontSize: '10px'}}>
                        调试信息: handComparison = {JSON.stringify(handComparison)}
                    </div>
                )}<div className="action-buttons">
                    {isRoomCreator ? (
                        <>
                            {/* If only one player left, show only End Game and View Only */}
                            {onlyOnePlayerLeft ? (
                                <>
                                    <button 
                                        className="close-result-btn danger"
                                        onClick={() => {
                                            onClose();
                                            if (onEndGame) onEndGame();
                                        }}
                                    >
                                        结束游戏
                                    </button>
                                    <button 
                                        className="close-result-btn secondary"
                                        onClick={() => {
                                            console.log('Closing hand result without continuing game');
                                            onClose();
                                        }}
                                    >
                                        仅查看
                                    </button>
                                </>
                            ) : (
                                <>
                                    {/* Normal case: show Continue, End Game, and View Only */}
                                    <button 
                                        className="close-result-btn primary"
                                        onClick={handleContinueGame}
                                    >
                                        继续游戏
                                    </button>
                                    <button 
                                        className="close-result-btn danger"
                                        onClick={() => {
                                            onClose();
                                            if (onEndGame) onEndGame();
                                        }}
                                    >
                                        结束游戏
                                    </button>
                                    <button 
                                        className="close-result-btn secondary"
                                        onClick={() => {
                                            console.log('Closing hand result without continuing game');
                                            onClose();
                                        }}
                                    >
                                        仅查看
                                    </button>
                                </>
                            )}
                        </>
                    ) : (
                        <>
                            <div style={{ 
                                textAlign: 'center', 
                                color: '#6c757d', 
                                fontSize: '14px',
                                marginBottom: '10px' 
                            }}>
                                等待房主开始下一局...
                            </div>
                            <button 
                                className="close-result-btn secondary"
                                onClick={() => {
                                    console.log('Closing hand result without continuing game');
                                    onClose();
                                }}
                            >
                                仅查看
                            </button>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default HandResult;
