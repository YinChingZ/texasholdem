import React, { useState, useEffect } from 'react';
import AnimatedCard from './AnimatedCard';
import AnimatedNumber from './AnimatedNumber';
import ChipChangeIndicator from './ChipChangeIndicator';
import PlayerRole from './PlayerRole';
import './Player.css';

const Player = ({ player, isCurrentTurn = false, gameState = null, playerIndex = -1 }) => {
    const [previousChips, setPreviousChips] = useState(player.chips);
    const [showChipChange, setShowChipChange] = useState(false);
    const [chipChange, setChipChange] = useState(0);

    // 检测筹码变化
    useEffect(() => {
        if (previousChips !== player.chips) {
            const change = player.chips - previousChips;
            setChipChange(change);
            setShowChipChange(true);
            setPreviousChips(player.chips);
        }
    }, [player.chips, previousChips]);
    // 根据玩家状态获取状态颜色和图标
    const getStatusDisplay = (status) => {
        switch (status) {
            case 'folded':
                return { icon: '❌', color: '#dc3545', text: '已弃牌' };
            case 'all-in':
                return { icon: '🚀', color: '#6f42c1', text: '全押' };
            case 'active':
                return { icon: '✅', color: '#28a745', text: '活跃' };
            case 'waiting':
                return { icon: '⏳', color: '#ffc107', text: '等待' };
            default:
                return { icon: '🎯', color: '#007bff', text: status };
        }
    };

    const statusDisplay = getStatusDisplay(player.status);
      // 判断玩家角色
    const getPlayerRole = () => {
        if (!gameState || !player) return null;
        
        // 在游戏进行中，服务器发送的位置信息是基于activePlayers的索引
        // 我们需要根据玩家ID来判断角色，而不是依赖playerIndex
        const dealerPlayer = gameState.players[gameState.dealerPosition];
        const smallBlindPlayer = gameState.players[gameState.smallBlindPosition];
        const bigBlindPlayer = gameState.players[gameState.bigBlindPosition];
        
        if (dealerPlayer && player.id === dealerPlayer.id) {
            return 'dealer';
        } else if (smallBlindPlayer && player.id === smallBlindPlayer.id) {
            return 'smallBlind';
        } else if (bigBlindPlayer && player.id === bigBlindPlayer.id) {
            return 'bigBlind';
        }
        return null;
    };

    const playerRole = getPlayerRole();
    
    // 确定容器的CSS类
    const getContainerClass = () => {
        if (isCurrentTurn) return 'current-turn';
        if (player.status === 'folded') return 'folded';
        return 'normal';
    };    return (
        <div className={`player-container ${getContainerClass()}`}>
            {/* 当前回合指示器 */}
            {isCurrentTurn && (
                <div className="turn-indicator">
                    你的回合
                </div>
            )}
              <h5 className={`player-name ${isCurrentTurn ? 'current-turn' : 'normal'}`}>
                {player.nickname}
            </h5>            <p className="player-info">
                筹码: <AnimatedNumber 
                    value={player.chips} 
                    className="chips-gain"                    enablePulse={true}
                    pulseColor="#28a745"
                />
            </p>
            <p className={`player-status ${isCurrentTurn ? 'current-turn' : 'normal'}`}>
                <span style={{ color: statusDisplay.color }}>
                    {statusDisplay.icon} {statusDisplay.text}
                </span>
            </p>            <p className="player-info">
                下注: <AnimatedNumber 
                    value={player.currentBet} 
                    className="pot-increase"
                    enablePulse={true}
                    pulseColor="#ffc107"
                />
            </p>
            <div className="player-hand">
                {player.hand && player.hand.map((card, index) => (
                    <AnimatedCard 
                        key={index} 
                        suit={card.suit} 
                        rank={card.rank} 
                        isRevealed={true} // 玩家手牌始终显示
                        delay={index * 100}
                        isCommunityCard={false}
                    />                ))}
            </div>
            
            {/* 玩家角色指示器 - 移到底部 */}
            {playerRole && (
                <div className="player-role-container">
                    <PlayerRole 
                        role={playerRole} 
                        isActive={gameState?.gameState !== 'WAITING'} 
                    />
                </div>
            )}
            
            {/* 筹码变动指示器 */}
            <ChipChangeIndicator
                value={chipChange}
                show={showChipChange}
                onComplete={() => setShowChipChange(false)}
                position="center"
            />
        </div>
    );
};

export default Player;
