import React, { useState, useEffect } from 'react';
import { useSocket } from '../contexts/SocketContext';
import AnimatedNumber from './AnimatedNumber';
import { soundManager } from '../utils/soundManager';
import './ActionBar.css';

const ActionBar = ({ roomId, player, gameState }) => {
    const { socket } = useSocket();
    const [betAmount, setBetAmount] = useState(0);
    const [sliderValue, setSliderValue] = useState(0);
    const [error, setError] = useState(null);    // 提供安全的默认值
    const currentBet = gameState?.currentBet ?? 0;
    const bigBlind = gameState?.bigBlind ?? 10;
    const playerChips = player?.chips ?? 0;
    const playerCurrentBet = player?.currentBet ?? 0;
    const isPlayerTurn = gameState?.currentPlayerTurn === player?.id;

    // 添加调试信息
    console.log('ActionBar gameState:', {
        currentBet,
        bigBlind,
        mainPot: gameState?.mainPot,
        currentPlayerTurn: gameState?.currentPlayerTurn,
        playerId: player?.id,
        isPlayerTurn    });

    // 计算需要跟注的金额
    const callAmount = Math.max(0, currentBet - playerCurrentBet);
    
    // 计算最小和最大加注金额
    const minRaiseTotal = Math.max(currentBet * 2, currentBet + bigBlind);
    const minRaiseAmount = Math.max(0, minRaiseTotal - currentBet); // 纯加注的最小金额
    const maxRaiseAmount = Math.max(0, playerChips - callAmount); // 可用于加注的最大金额

    useEffect(() => {
        if (isPlayerTurn && maxRaiseAmount > 0) {
            // 设置初始加注金额为最小加注
            const initialBet = Math.max(0, Math.min(minRaiseAmount, maxRaiseAmount));
            setBetAmount(initialBet);
            setSliderValue(initialBet);
            setError(null);
        }
    }, [isPlayerTurn, minRaiseAmount, maxRaiseAmount]);    // 判断玩家可执行的操作
    const canCheck = currentBet <= playerCurrentBet;
    const canCall = !canCheck && callAmount <= playerChips;
    const canRaise = playerChips > callAmount && maxRaiseAmount >= minRaiseAmount;

    // 添加详细的调试信息
    console.log('ActionBar states:', {
        currentBet,
        playerCurrentBet,
        callAmount,
        canCheck,
        canCall,
        canRaise,
        gameState: gameState?.gameState,
        playerChips,
        maxRaiseAmount,
        minRaiseAmount
    });    const handleAction = (action, amount = 0) => {
        try {
            // 播放相应的音效
            switch (action) {
                case 'call':
                    if (callAmount === playerChips) {
                        // 全押
                        soundManager.playAllIn();
                    } else {
                        // 普通跟注
                        soundManager.playBet(callAmount);
                    }
                    break;
                case 'raise':
                    if (amount >= maxRaiseAmount) {
                        // 全押加注
                        soundManager.playAllIn();
                    } else {
                        // 普通加注
                        soundManager.playBet(amount);
                    }
                    break;
                case 'fold':
                    // 弃牌音效（可以使用筹码减少音效）
                    soundManager.playChipLoss();
                    break;
                case 'check':
                    // 过牌音效（轻微的提示音）
                    soundManager.playBet(0);
                    break;
            }
            
            socket.emit('playerAction', { 
                roomId, 
                action, 
                betAmount: amount 
            });
        } catch (err) {
            setError(err.message);
        }
    };

    const handleSliderChange = (e) => {
        const value = Number(e.target.value);
        setSliderValue(value);        setBetAmount(value);
    };    // 计算加注显示文本
    const getRaiseButtonText = () => {
        if (betAmount >= maxRaiseAmount) {
            return '全押';
        }
        if (currentBet === 0) {
            return `下注 ${betAmount}`;
        }
        return `加注 ${betAmount} (总计 ${playerCurrentBet + callAmount + betAmount})`;
    };

    // 生成智能的快速加注选项
    const getQuickBetOptions = () => {
        const options = [];
        const pot = gameState?.mainPot || 0;
        
        // 基础固定金额
        const fixedAmounts = [50, 100, 200, 500, 1000];
        fixedAmounts.forEach(amount => {
            if (amount >= minRaiseAmount && amount <= maxRaiseAmount) {
                options.push({ amount, label: `+${amount}`, type: 'fixed' });
            }
        });
        
        // 相对于池的加注
        if (pot > 0) {
            const halfPot = Math.floor(pot / 2);
            const fullPot = pot;
            const doublePot = pot * 2;
            
            if (halfPot >= minRaiseAmount && halfPot <= maxRaiseAmount) {
                options.push({ amount: halfPot, label: '1/2池', type: 'pot' });
            }
            if (fullPot >= minRaiseAmount && fullPot <= maxRaiseAmount && fullPot !== halfPot) {
                options.push({ amount: fullPot, label: '满池', type: 'pot' });
            }
            if (doublePot >= minRaiseAmount && doublePot <= maxRaiseAmount && doublePot !== fullPot) {
                options.push({ amount: doublePot, label: '2倍池', type: 'pot' });
            }
        }
        
        // 全押选项
        if (maxRaiseAmount > minRaiseAmount) {
            options.push({ amount: maxRaiseAmount, label: '全押', type: 'allin' });
        }
        
        // 按金额排序并去重
        const uniqueOptions = options.filter((option, index, arr) => 
            arr.findIndex(o => o.amount === option.amount) === index
        ).sort((a, b) => a.amount - b.amount);
        
        return uniqueOptions.slice(0, 6); // 最多显示6个选项
    };    // 当不是玩家回合时显示等待信息
    if (!isPlayerTurn) {
        const currentPlayer = gameState.players?.find(p => p.id === gameState.currentPlayerTurn);
        const currentPlayerName = currentPlayer?.nickname || '其他玩家';
        
        return (
            <div className="action-bar waiting">
                <div style={{ textAlign: 'center' }}>
                    <div style={{ 
                        fontSize: '16px', 
                        marginBottom: '10px',
                        color: '#6c757d'
                    }}>
                        ⏳ 等待中...
                    </div>                    <div style={{ 
                        fontSize: '14px',
                        color: '#495057',
                        fontWeight: '600'
                    }}>
                        轮到 <span style={{ color: '#dc3545', fontWeight: '700' }}>{currentPlayerName}</span> 行动
                    </div>
                </div>
            </div>
        );
    }    return (
        <div className="action-bar">
            {/* 当前回合提示 */}            <div style={{
                textAlign: 'center',
                marginBottom: '15px',
                padding: '12px',
                background: 'linear-gradient(135deg, #28a745 0%, #20c997 100%)',
                borderRadius: '12px',
                border: 'none',
                boxShadow: '0 4px 12px rgba(40, 167, 69, 0.3)'
            }}>
                <div style={{
                    fontSize: '16px',
                    fontWeight: '700',
                    color: 'white',
                    textShadow: '0 1px 2px rgba(0, 0, 0, 0.3)'
                }}>
                    🎯 轮到您操作
                </div>
            </div>
            
            {error && <div className="error-message">{error}</div>}
            
            <div className="action-buttons">
                <button 
                    className="fold-button" 
                    onClick={() => handleAction('fold')}
                >
                    弃牌
                </button>

                {canCheck ? (
                    <button 
                        className="check-button" 
                        onClick={() => handleAction('check')}
                    >
                        过牌
                    </button>
                ) : canCall ? (
                    <button 
                        className="call-button" 
                        onClick={() => handleAction('call')}
                    >                        {callAmount === playerChips ? 
                            <>全押 (<AnimatedNumber value={playerChips} className="chips-loss" enablePulse={true} pulseColor="#dc3545" />)</>: 
                            <>跟注 <AnimatedNumber value={callAmount} className="pot-increase" enablePulse={true} pulseColor="#ffc107" /></>}
                    </button>
                ) : (
                    <button 
                        className="all-in-button" 
                        onClick={() => handleAction('call')}
                    >
                        全押 <AnimatedNumber value={playerChips} className="chips-loss" enablePulse={true} pulseColor="#dc3545" />
                    </button>
                )}                {canRaise && maxRaiseAmount >= minRaiseAmount && (
                    <div className="raise-controls">
                        {/* 快速加注按钮 */}                        <div className="quick-bet-buttons">
                            {getQuickBetOptions().map(option => (
                                <button 
                                    key={`${option.type}-${option.amount}`}
                                    className={`quick-bet-button ${
                                        option.type === 'allin' ? 'all-in-quick' : 
                                        option.type === 'pot' ? 'pot-button' : ''
                                    }`}                                    onClick={() => {
                                        setBetAmount(option.amount);
                                        setSliderValue(option.amount);
                                        // 为快速加注按钮播放音效预览
                                        if (option.type === 'allin') {
                                            soundManager.playAllIn();
                                        } else {
                                            soundManager.playBet(option.amount);
                                        }
                                    }}
                                    title={`加注 ${option.amount} 筹码`}
                                >
                                    {option.label}
                                </button>
                            ))}
                        </div>
                        
                        <div className="slider-container">
                            <label style={{ fontSize: '12px', color: '#6c757d', marginBottom: '5px', display: 'block' }}>
                                自定义加注金额
                            </label>
                            <input 
                                type="range" 
                                min={minRaiseAmount}
                                max={Math.max(minRaiseAmount, maxRaiseAmount)}
                                value={Math.min(sliderValue, maxRaiseAmount)}
                                onChange={handleSliderChange}
                                className="bet-slider"
                            />
                            <div className="slider-labels">
                                <span>{minRaiseAmount}</span>
                                <span>{maxRaiseAmount}</span>
                            </div>
                        </div>
                        
                        <div className="bet-amount-display">
                            <span>当前选择: {betAmount} 筹码</span>
                        </div>
                        
                        <button 
                            className="raise-button"
                            onClick={() => handleAction('raise', betAmount)}
                            disabled={betAmount < minRaiseAmount || betAmount > maxRaiseAmount}
                        >
                            {getRaiseButtonText()}
                        </button>
                    </div>
                )}
            </div>
              <div className="player-info">
                <p>当前最高下注: 
                    <AnimatedNumber 
                        value={currentBet} 
                        className="pot-increase"
                        enablePulse={true}
                        pulseColor="#ffc107"
                    />
                </p>                <p>您的下注: 
                    <AnimatedNumber 
                        value={playerCurrentBet} 
                        className="pot-increase"
                        enablePulse={true}
                        pulseColor="#007bff"
                    />
                </p><p>剩余筹码: 
                    <AnimatedNumber 
                        value={playerChips} 
                        className="chips-gain"
                        enablePulse={true}
                        pulseColor="#28a745"
                    />
                </p>
            </div>
        </div>
    );
};

export default ActionBar;
