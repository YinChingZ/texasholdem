import React from 'react';
import Player from './Player';
import CommunityCards from './CommunityCards';
import Pot from './Pot';
import ActionBar from './ActionBar';
import ChatBox from './ChatBox';
import Card from './Card';
import HandResult from './HandResult';
import AnimatedNumber from './AnimatedNumber';
import SoundSettings from './SoundSettings';
import GlobalMessage from './GlobalMessage';
import Leaderboard from './Leaderboard';
import { useSocket } from '../contexts/SocketContext';
import { useGameSounds } from '../hooks/useGameSounds';
import { useGlobalMessages } from '../hooks/useGlobalMessages';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import './Welcome.css';

const GameTable = () => {
    const { socket, gameState, privateCards, room, handResult, clearHandResult, isRoomCreator, isSpectator, roomSettings, connectionStatus, isReconnecting, leaveRoom } = useSocket();

    const [nickname, setNickname] = React.useState('');
    const [roomIdInput, setRoomIdInput] = React.useState('');
    const [showSoundSettings, setShowSoundSettings] = React.useState(false);
    const [previousGameState, setPreviousGameState] = React.useState(null);
    const [copySuccess, setCopySuccess] = React.useState(false);
    const [showLeaderboard, setShowLeaderboard] = React.useState(false);
    const [showAllHands, setShowAllHands] = React.useState(true); // 本地状态跟踪
    const [pendingJoinRoom, setPendingJoinRoom] = React.useState(null); // Store pending join info
    const [initialChips, setInitialChips] = React.useState(1000); // 初始筹码数量

    // 从本地存储加载昵称
    React.useEffect(() => {
        const savedNickname = localStorage.getItem('texasholdem_nickname');
        if (savedNickname) {
            setNickname(savedNickname);
        }
    }, []);

    // 使用游戏音效Hook
    useGameSounds(gameState, previousGameState);
    
    // 使用全局消息Hook
    const { messages } = useGlobalMessages(gameState, previousGameState);

    // 使用动态标题Hook
    useDocumentTitle(gameState, socket?.id);

    // 更新previousGameState
    React.useEffect(() => {
        if (gameState) {
            setPreviousGameState(gameState);
        }
    }, [gameState]);

    // 监听游戏结束，显示排行榜
    React.useEffect(() => {
        if (gameState && gameState.gameState === 'GAME_OVER' && gameState.leaderboard) {
            setShowLeaderboard(true);
        }
    }, [gameState]);

    // 监听设置变化，同步本地状态
    React.useEffect(() => {
        if (roomSettings && typeof roomSettings.showAllHands === 'boolean') {
            setShowAllHands(roomSettings.showAllHands);
        }
        if (roomSettings && typeof roomSettings.initialChips === 'number') {
            setInitialChips(roomSettings.initialChips);
        }
    }, [roomSettings]);

    // 备用：从游戏状态中获取设置（向后兼容）
    React.useEffect(() => {
        if (gameState?.settings && !roomSettings) {
            if (typeof gameState.settings.showAllHands === 'boolean') {
                setShowAllHands(gameState.settings.showAllHands);
            }
            if (typeof gameState.settings.initialChips === 'number') {
                setInitialChips(gameState.settings.initialChips);
            }
        }
    }, [gameState?.settings, roomSettings]);

    // 当进入房间时，初始化本地设置状态
    React.useEffect(() => {
        if (gameState && room && isRoomCreator) {
            // 如果设置还没有被初始化，使用默认值
            if (gameState.settings && typeof gameState.settings.showAllHands === 'boolean') {
                setShowAllHands(gameState.settings.showAllHands);
            } else {
                // 默认值为 true
                setShowAllHands(true);
            }
            if (gameState.settings && typeof gameState.settings.initialChips === 'number') {
                setInitialChips(gameState.settings.initialChips);
            } else {
                setInitialChips(1000);
            }
        }
    }, [room, gameState, isRoomCreator]);
    
    // Handle gameInProgress event - ask user if they want to spectate
    React.useEffect(() => {
        if (!socket) return;
        
        const handleGameInProgress = ({ roomId }) => {
            const shouldSpectate = window.confirm(
                '游戏正在进行中。是否以旁观者身份加入？\n\n旁观者无法参与游戏，但可以观看和聊天。'
            );
            
            if (shouldSpectate) {
                socket.emit('joinRoom', { roomId, nickname, asSpectator: true });
            }
        };
        
        socket.on('gameInProgress', handleGameInProgress);
        
        return () => {
            socket.off('gameInProgress', handleGameInProgress);
        };
    }, [socket, nickname]);

    const handleCreateRoom = () => {
        if (nickname) {
            // 保存昵称到本地存储
            localStorage.setItem('texasholdem_nickname', nickname);
            socket.emit('createRoom', { nickname });
        }
    };

    const handleJoinRoom = () => {
        if (nickname && roomIdInput) {
            // 保存昵称到本地存储
            localStorage.setItem('texasholdem_nickname', nickname);
            socket.emit('joinRoom', { roomId: roomIdInput, nickname });
        }
    };    const handleStartGame = () => {
        if (room) {
            socket.emit('startGame', { roomId: room.id });
        }
    };

    // 新增：处理退出房间
    const handleLeaveRoom = () => {
        const confirmLeave = window.confirm('确定要退出房间吗？');
        if (confirmLeave && room) {
            leaveRoom();
        }
    };

    // 新增：处理重置游戏
    const handleResetGame = () => {
        const confirmReset = window.confirm('确定要重置游戏吗？所有玩家将返回准备阶段。');
        if (confirmReset && room && socket) {
            socket.emit('resetGame', { roomId: room.id });
            setShowLeaderboard(false); // Close leaderboard after reset
        }
    };

    // 新增：处理结束游戏
    const handleEndGame = () => {
        const confirmEnd = window.confirm('确定要结束游戏吗？将显示当前排行榜。');
        if (confirmEnd && room && socket) {
            socket.emit('endGame', { roomId: room.id });
        }
    };

    // 新增：处理关闭房间
    const handleCloseRoom = () => {
        const confirmClose = window.confirm('确定要关闭房间吗？所有玩家将被踢出。');
        if (confirmClose && room && socket) {
            socket.emit('closeRoom', { roomId: room.id });
        }
    };
    
    // 新增：切换到玩家模式
    const handleSwitchToPlayer = () => {
        if (room && socket) {
            socket.emit('switchToPlayer', { roomId: room.id });
        }
    };
    
    // 新增：切换到旁观者模式
    const handleSwitchToSpectator = () => {
        const confirmSwitch = window.confirm('确定要切换到旁观者模式吗？');
        if (confirmSwitch && room && socket) {
            socket.emit('switchToSpectator', { roomId: room.id });
        }
    };
    
    // 新增：处理筹码数量更改
    const handleChipsChange = () => {
        const chips = parseInt(initialChips);
        if (isNaN(chips) || chips < 500 || chips > 50000) {
            alert('筹码数量必须在500到50000之间');
            return;
        }
        if (room && socket) {
            socket.emit('updateInitialChips', { roomId: room.id, initialChips: chips });
        }
    };
    
    const handleCopyRoomId = async () => {
        try {
            await navigator.clipboard.writeText(room.id);
            setCopySuccess(true);
            setTimeout(() => setCopySuccess(false), 2000); // 2秒后隐藏成功提示
        } catch (err) {
            console.error('复制失败:', err);
            // 降级处理：使用传统的选择和复制方法
            const textArea = document.createElement('textarea');
            textArea.value = room.id;
            textArea.style.position = 'fixed';
            textArea.style.left = '-999999px';
            textArea.style.top = '-999999px';
            document.body.appendChild(textArea);
            textArea.focus();
            textArea.select();
            try {
                document.execCommand('copy');
                setCopySuccess(true);
                setTimeout(() => setCopySuccess(false), 2000);
            } catch (fallbackErr) {
                console.error('降级复制也失败:', fallbackErr);
                // 最后的降级：显示房间号让用户手动复制
                alert(`请手动复制房间号: ${room.id}`);
            }
            document.body.removeChild(textArea);
        }
    };    const handleSettingsChange = (setting, value) => {
        if (room && socket) {
            socket.emit('updateRoomSettings', { 
                roomId: room.id, 
                settings: { [setting]: value } 
            });
        }
    };// 1. User has not joined or created a room yet
    if (!room) {
        return (
            <div className="welcome-container">
                <div className="welcome-card">
                    {/* 游戏标题 */}
                    <div style={{ marginBottom: '40px' }}>
                        <h1 className="welcome-title">🃏 德州扑克</h1>
                        <p className="welcome-subtitle">Texas Hold'em Poker</p>
                    </div>

                    {/* 昵称输入 */}
                    <div style={{ marginBottom: '30px' }}>
                        <label className="welcome-label">请输入您的昵称</label>
                        <input 
                            type="text" 
                            placeholder="例如：玩家123" 
                            value={nickname} 
                            onChange={(e) => setNickname(e.target.value)}
                            className="welcome-input"
                        />
                    </div>

                    {/* 创建房间按钮 */}
                    <div style={{ marginBottom: '30px' }}>
                        <button 
                            onClick={handleCreateRoom}
                            disabled={!nickname.trim()}
                            className="welcome-button primary"
                        >
                            🚀 创建新房间
                        </button>
                    </div>

                    {/* 分隔线 */}
                    <div className="welcome-divider">
                        <div className="welcome-divider-line"></div>
                        <span className="welcome-divider-text">或者</span>
                        <div className="welcome-divider-line"></div>
                    </div>

                    {/* 加入房间区域 */}
                    <div>
                        <label className="welcome-label">加入现有房间</label>
                        <div className="join-room-container">
                            <input 
                                type="text" 
                                placeholder="输入房间ID" 
                                value={roomIdInput} 
                                onChange={(e) => setRoomIdInput(e.target.value)}
                                className="join-room-input"
                            />
                            <button 
                                onClick={handleJoinRoom}
                                disabled={!nickname.trim() || !roomIdInput.trim()}
                                className="welcome-button secondary"
                            >
                                🎯 加入
                            </button>
                        </div>
                    </div>

                    {/* 底部提示 */}
                    <div className="welcome-tip">
                        💡 <strong>游戏说明：</strong>至少需要2名玩家才能开始游戏。创建房间后，分享房间ID给朋友一起游戏！
                    </div>
                </div>
            </div>
        );
    }    // 2. User is in a room but gameState is not yet loaded
    if (room && !gameState) {
        return (
            <div className="welcome-container">
                <div className="welcome-card" style={{ maxWidth: '400px' }}>
                    <div className="loading-spinner"></div>
                    <h2 style={{
                        color: '#2c3e50',
                        marginBottom: '10px',
                        fontSize: '24px'
                    }}>连接房间中...</h2>
                    <p style={{
                        color: '#7f8c8d',
                        fontSize: '16px',
                        margin: '0'
                    }}>房间: {room.id}</p>
                    <p style={{
                        color: '#95a5a6',
                        fontSize: '14px',
                        marginTop: '10px'
                    }}>正在加载游戏状态...</p>
                </div>
            </div>
        );
    }

    // 3. Display reconnection status
    if (isReconnecting) {
        return (
            <div className="welcome-container">
                <div className="welcome-card" style={{ maxWidth: '400px' }}>
                    <div className="loading-spinner"></div>
                    <h2 style={{
                        color: '#2c3e50',
                        marginBottom: '10px',
                        fontSize: '24px'
                    }}>正在重连...</h2>
                    <p style={{
                        color: '#7f8c8d',
                        fontSize: '16px',
                        margin: '0'
                    }}>尝试恢复您的游戏状态</p>
                    <p style={{
                        color: '#95a5a6',
                        fontSize: '14px',
                        marginTop: '10px'
                    }}>请稍候片刻...</p>
                </div>
            </div>
        );
    }

    // 4. Display connection status
    if (connectionStatus === 'disconnected') {
        return (
            <div className="welcome-container">
                <div className="welcome-card" style={{ maxWidth: '400px' }}>
                    <div style={{
                        color: '#e74c3c',
                        fontSize: '48px',
                        marginBottom: '20px'
                    }}>⚠️</div>
                    <h2 style={{
                        color: '#e74c3c',
                        marginBottom: '10px',
                        fontSize: '24px'
                    }}>连接断开</h2>
                    <p style={{
                        color: '#7f8c8d',
                        fontSize: '16px',
                        margin: '0'
                    }}>与服务器的连接已断开</p>
                    <p style={{
                        color: '#95a5a6',
                        fontSize: '14px',
                        marginTop: '10px'
                    }}>正在尝试重新连接...</p>
                </div>
            </div>
        );
    }

    // 3. User is in a room, and game is in WAITING state (Lobby)
    if (gameState && gameState.gameState === 'WAITING') {
        console.log('GameTable - WAITING state, players:', gameState.players);        return (            <div className="lobby-container" style={{ 
                display: 'flex', 
                height: 'calc(100vh - 2rem)', 
                padding: '0',
                boxSizing: 'border-box',
                gap: '20px'
            }}>
                <div className="lobby-main" style={{ 
                    flex: '1', 
                    minWidth: '800px',
                    overflowY: 'auto',
                    padding: '40px',
                    backgroundColor: '#f8f9fa',
                    borderRadius: '10px',
                    border: '1px solid #dee2e6',
                    textAlign: 'center'
                }}>                    {/* 房间标题和复制功能 */}
                    <div className="lobby-title-container" style={{ 
                        marginBottom: '30px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '15px',
                        flexWrap: 'wrap'
                    }}>
                        <h2 className="room-title" style={{ 
                            margin: '0', 
                            fontSize: 'clamp(20px, 5vw, 28px)',
                            color: '#495057',
                            textAlign: 'center'
                        }}>房间: {room.id}</h2>
                        
                        <div style={{ 
                            display: 'flex', 
                            gap: '10px', 
                            alignItems: 'center',
                            flexWrap: 'wrap',
                            justifyContent: 'center'
                        }}>
                            <button 
                                className="copy-room-button"
                                onClick={handleCopyRoomId}
                                style={{
                                    padding: '10px 20px',
                                    fontSize: '14px',
                                    backgroundColor: copySuccess ? '#28a745' : '#007bff',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '8px',
                                    cursor: 'pointer',
                                    transition: 'all 0.3s ease',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    fontWeight: '500',
                                    minWidth: '140px',
                                    justifyContent: 'center',
                                    boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                                }}
                                onMouseEnter={(e) => {
                                    if (!copySuccess) {
                                        e.target.style.backgroundColor = '#0056b3';
                                        e.target.style.transform = 'translateY(-1px)';
                                        e.target.style.boxShadow = '0 4px 8px rgba(0,0,0,0.2)';
                                    }
                                }}
                                onMouseLeave={(e) => {
                                    if (!copySuccess) {
                                        e.target.style.backgroundColor = '#007bff';
                                        e.target.style.transform = 'translateY(0)';
                                        e.target.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';
                                    }
                                }}
                                title="点击复制房间号"
                            >
                                {copySuccess ? (
                                    <>✓ 已复制</>
                                ) : (
                                    <>📋 复制房间号</>
                                )}
                            </button>

                            {/* 新增：退出房间按钮 */}
                            <button 
                                className="leave-room-button"
                                onClick={handleLeaveRoom}
                                style={{
                                    padding: '10px 20px',
                                    fontSize: '14px',
                                    backgroundColor: '#dc3545',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '8px',
                                    cursor: 'pointer',
                                    transition: 'all 0.3s ease',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    fontWeight: '500',
                                    minWidth: '120px',
                                    justifyContent: 'center',
                                    boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                                }}
                                onMouseEnter={(e) => {
                                    e.target.style.backgroundColor = '#c82333';
                                    e.target.style.transform = 'translateY(-1px)';
                                    e.target.style.boxShadow = '0 4px 8px rgba(0,0,0,0.2)';
                                }}
                                onMouseLeave={(e) => {
                                    e.target.style.backgroundColor = '#dc3545';
                                    e.target.style.transform = 'translateY(0)';
                                    e.target.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';
                                }}
                                title="退出房间"
                            >
                                🚪 退出房间
                            </button>

                            {/* 新增：关闭房间按钮 - 仅房主可见 */}
                            {isRoomCreator && (
                                <button 
                                    className="close-room-button"
                                    onClick={handleCloseRoom}
                                    style={{
                                        padding: '10px 20px',
                                        fontSize: '14px',
                                        backgroundColor: '#ff6b6b',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '8px',
                                        cursor: 'pointer',
                                        transition: 'all 0.3s ease',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '6px',
                                        fontWeight: '500',
                                        minWidth: '120px',
                                        justifyContent: 'center',
                                        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                                    }}
                                    onMouseEnter={(e) => {
                                        e.target.style.backgroundColor = '#ff5252';
                                        e.target.style.transform = 'translateY(-1px)';
                                        e.target.style.boxShadow = '0 4px 8px rgba(0,0,0,0.2)';
                                    }}
                                    onMouseLeave={(e) => {
                                        e.target.style.backgroundColor = '#ff6b6b';
                                        e.target.style.transform = 'translateY(0)';
                                        e.target.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';
                                    }}
                                    title="关闭房间（所有玩家将被踢出）"
                                >
                                    🔒 关闭房间
                                </button>
                            )}
                              {copySuccess && (
                                <span style={{
                                    fontSize: '13px',
                                    color: '#28a745',
                                    fontWeight: '600',
                                    background: '#d4edda',
                                    padding: '4px 8px',
                                    borderRadius: '4px',
                                    border: '1px solid #c3e6cb'
                                }}>
                                    🎉 分享给朋友吧！
                                </span>                            )}
                        </div>
                    </div>
                      {/* 显示房主信息 */}
                    {gameState && gameState.creator && (
                        <div style={{ 
                            marginBottom: '20px',
                            padding: '10px',
                            backgroundColor: isRoomCreator ? '#d4edda' : '#f8f9fa',
                            borderRadius: '8px',
                            border: `1px solid ${isRoomCreator ? '#c3e6cb' : '#dee2e6'}`,
                            fontSize: '14px',
                            color: isRoomCreator ? '#155724' : '#6c757d'
                        }}>
                            {isRoomCreator ? (
                                <span>👑 您是房主，可以控制游戏开始</span>
                            ) : (
                                <span>👑 房主: {gameState.players?.find(p => p.id === gameState.creator)?.nickname || '未知'}</span>
                            )}
                        </div>
                    )}

                    {/* 房主游戏设置 */}
                    {isRoomCreator && (
                        <div style={{ 
                            marginBottom: '20px',
                            padding: '15px',
                            backgroundColor: '#fff3cd',
                            borderRadius: '8px',
                            border: '1px solid #ffeaa7',
                            fontSize: '14px'
                        }}>
                            <h4 style={{ 
                                margin: '0 0 10px 0', 
                                fontSize: '16px', 
                                color: '#856404',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '5px'
                            }}>
                                ⚙️ 游戏设置
                            </h4>
                            
                            <div style={{ 
                                display: 'flex', 
                                alignItems: 'center', 
                                gap: '10px',
                                flexWrap: 'wrap' 
                            }}>
                                <label style={{ 
                                    display: 'flex', 
                                    alignItems: 'center', 
                                    gap: '8px',
                                    cursor: 'pointer',
                                    color: '#856404',
                                    fontWeight: '500'
                                }}>                                    <input
                                        type="checkbox"
                                        checked={showAllHands}                                        onChange={(e) => {
                                            console.log('Checkbox clicked, new value:', e.target.checked);
                                            setShowAllHands(e.target.checked); // 立即更新本地状态
                                            handleSettingsChange('showAllHands', e.target.checked);
                                        }}
                                        style={{
                                            transform: 'scale(1.2)',
                                            accentColor: '#ffc107'
                                        }}
                                    />
                                    🃏 一手结束后显示所有玩家手牌
                                </label>
                                  <span style={{ 
                                    fontSize: '12px', 
                                    color: '#6c757d',
                                    fontStyle: 'italic'                                }}>
                                    (关闭后仅显示获胜者手牌)
                                </span>
                            </div>
                            
                            {/* Initial chips setting */}
                            <div style={{ 
                                display: 'flex', 
                                alignItems: 'center', 
                                gap: '10px',
                                marginTop: '15px',
                                flexWrap: 'wrap' 
                            }}>
                                <label style={{ 
                                    display: 'flex', 
                                    alignItems: 'center', 
                                    gap: '8px',
                                    color: '#856404',
                                    fontWeight: '500'
                                }}>
                                    💰 初始筹码数量：
                                    <input
                                        type="number"
                                        value={initialChips}
                                        onChange={(e) => setInitialChips(e.target.value)}
                                        min={500}
                                        max={50000}
                                        step={100}
                                        style={{
                                            width: '100px',
                                            padding: '5px 8px',
                                            fontSize: '14px',
                                            border: '2px solid #ffc107',
                                            borderRadius: '6px',
                                            outline: 'none',
                                            backgroundColor: 'white'
                                        }}
                                    />
                                    <button
                                        onClick={handleChipsChange}
                                        style={{
                                            padding: '5px 15px',
                                            fontSize: '14px',
                                            backgroundColor: '#ffc107',
                                            color: 'white',
                                            border: 'none',
                                            borderRadius: '6px',
                                            cursor: 'pointer',
                                            fontWeight: 'bold',
                                            transition: 'background-color 0.2s'
                                        }}
                                        onMouseEnter={(e) => {
                                            e.target.style.backgroundColor = '#e0a800';
                                        }}
                                        onMouseLeave={(e) => {
                                            e.target.style.backgroundColor = '#ffc107';
                                        }}
                                    >
                                        确认
                                    </button>
                                </label>
                                <span style={{ 
                                    fontSize: '12px', 
                                    color: '#6c757d',
                                    fontStyle: 'italic'
                                }}>
                                    (范围: 500-50000)
                                </span>
                            </div>
                        </div>
                    )}
                    
                    <div style={{ 
                        backgroundColor: 'white',
                        padding: '30px',
                        borderRadius: '15px',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                        maxWidth: '600px',
                        margin: '0 auto'
                    }}>
                        <h3 style={{ 
                            margin: '0 0 20px 0',
                            fontSize: '20px',
                            color: '#6c757d'
                        }}>等待游戏开始...</h3>
                        
                        <h4 style={{ 
                            margin: '20px 0 15px 0',
                            fontSize: '18px',
                            color: '#495057'
                        }}>玩家列表</h4>
                        
                        <ul style={{ 
                            listStyle: 'none',
                            padding: 0,
                            margin: '0 0 30px 0'
                        }}>
                            {gameState.players && gameState.players.map(p => (
                                <li key={p.id} style={{ 
                                    padding: '10px',
                                    backgroundColor: '#f8f9fa',
                                    margin: '5px 0',
                                    borderRadius: '8px',
                                    fontSize: '16px'
                                }}>
                                    {p.nickname} (<AnimatedNumber value={p.chips} className="chips-gain" enablePulse={true} pulseColor="#28a745" /> 筹码)
                                </li>
                            ))}
                            {gameState.spectators && Object.values(gameState.spectators).map(s => (
                                <li key={s.id} style={{ 
                                    padding: '10px',
                                    backgroundColor: '#e9ecef',
                                    margin: '5px 0',
                                    borderRadius: '8px',
                                    fontSize: '16px',
                                    color: '#6c757d'
                                }}>
                                    {s.nickname} (旁观者)
                                </li>
                            ))}
                        </ul>
                        
                        <div style={{
                            display: 'flex',
                            gap: '10px',
                            flexWrap: 'wrap',
                            justifyContent: 'center',
                            marginBottom: '15px'
                        }}>
                            <button 
                                className="start-game-button"
                                onClick={handleStartGame} 
                                disabled={!gameState.players || gameState.players.length < 2 || !isRoomCreator}
                                style={{
                                    padding: '15px 30px',
                                    fontSize: '18px',
                                    backgroundColor: (gameState.players && gameState.players.length >= 2 && isRoomCreator) ? '#007bff' : '#6c757d',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '8px',
                                    cursor: (gameState.players && gameState.players.length >= 2 && isRoomCreator) ? 'pointer' : 'not-allowed',
                                    transition: 'background-color 0.3s'
                                }}
                            >
                                {isRoomCreator ? '开始游戏' : '等待房主开始'} ({gameState.players ? gameState.players.length : 0}/2 玩家)
                            </button>
                            
                            {/* Switch mode button */}
                            {isSpectator && !isRoomCreator ? (
                                <button 
                                    onClick={handleSwitchToPlayer}
                                    disabled={gameState.players && Object.keys(gameState.players).length >= 8}
                                    style={{
                                        padding: '15px 30px',
                                        fontSize: '18px',
                                        backgroundColor: '#28a745',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '8px',
                                        cursor: (gameState.players && Object.keys(gameState.players).length >= 8) ? 'not-allowed' : 'pointer',
                                        transition: 'background-color 0.3s',
                                        opacity: (gameState.players && Object.keys(gameState.players).length >= 8) ? 0.5 : 1
                                    }}
                                    onMouseEnter={(e) => {
                                        if (!(gameState.players && Object.keys(gameState.players).length >= 8)) {
                                            e.target.style.backgroundColor = '#218838';
                                        }
                                    }}
                                    onMouseLeave={(e) => {
                                        e.target.style.backgroundColor = '#28a745';
                                    }}
                                >
                                    🎮 加入对局
                                </button>
                            ) : !isRoomCreator && !isSpectator && (
                                <button 
                                    onClick={handleSwitchToSpectator}
                                    style={{
                                        padding: '15px 30px',
                                        fontSize: '18px',
                                        backgroundColor: '#6c757d',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '8px',
                                        cursor: 'pointer',
                                        transition: 'background-color 0.3s'
                                    }}
                                    onMouseEnter={(e) => {
                                        e.target.style.backgroundColor = '#5a6268';
                                    }}
                                    onMouseLeave={(e) => {
                                        e.target.style.backgroundColor = '#6c757d';
                                    }}
                                >
                                    👁️ 旁观游戏
                                </button>
                            )}
                        </div>
                        
                        {(!gameState.players || gameState.players.length < 2) && (
                            <p style={{ 
                                margin: '15px 0 0 0',
                                color: '#6c757d',
                                fontSize: '14px'
                            }}>
                                至少需要 2 名玩家才能开始游戏
                            </p>
                        )}
                        
                        {!isRoomCreator && gameState.players && gameState.players.length >= 2 && (
                            <p style={{ 
                                margin: '15px 0 0 0',
                                color: '#dc3545',
                                fontSize: '14px'
                            }}>
                                只有房间创建者才能开始游戏
                            </p>
                        )}
                    </div>
                </div>                
                <div className="chat-area" style={{ 
                    flexShrink: 0,
                    width: '280px',
                    display: 'flex',
                    flexDirection: 'column'
                }}>
                    <ChatBox roomId={room.id} />
                </div>
            </div>
        );
    }// 4. Game is in progress
    if (!gameState || !gameState.players) {
        return <div>Loading...</div>;
    }
    
    const me = gameState.players.find(p => p.id === socket.id);    return (
        <div className="game-main-container" style={{ 
            display: 'flex', 
            height: '100vh', 
            padding: '10px',
            boxSizing: 'border-box',
            gap: '15px',
            maxWidth: '100vw',
            overflow: 'hidden'
        }}>
            {/* 连接状态指示器 */}
            {connectionStatus !== 'connected' && (
                <div style={{
                    position: 'fixed',
                    top: '10px',
                    right: '10px',
                    zIndex: 1000,
                    backgroundColor: connectionStatus === 'disconnected' ? '#dc3545' : '#ffc107',
                    color: 'white',
                    padding: '8px 16px',
                    borderRadius: '20px',
                    fontSize: '14px',
                    fontWeight: 'bold',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                }}>
                    <div style={{
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        backgroundColor: 'white',
                        animation: 'pulse 2s infinite'
                    }}></div>
                    {connectionStatus === 'disconnected' ? '连接断开' : '连接中...'}
                </div>
            )}
            
            <div className="game-area" style={{ 
                flex: '1', 
                minWidth: '600px',
                maxWidth: 'calc(100vw - 320px)',
                overflowY: 'auto',
                padding: '15px',
                backgroundColor: '#f8f9fa',
                borderRadius: '10px',
                border: '1px solid #dee2e6'
            }}>                <div style={{
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    gap: '15px',
                    marginBottom: '20px',
                    flexWrap: 'wrap'
                }}>
                    <h2 className="room-title" style={{ 
                        margin: '0', 
                        fontSize: '24px', 
                        color: '#495057'
                    }}>房间: {room.id}</h2>
                    
                    {/* 游戏设置状态指示器 */}
                    <div style={{
                        padding: '4px 8px',
                        backgroundColor: gameState.settings?.showAllHands !== false ? '#d1ecf1' : '#f8d7da',
                        color: gameState.settings?.showAllHands !== false ? '#0c5460' : '#721c24',
                        borderRadius: '12px',
                        fontSize: '11px',
                        fontWeight: '500',
                        border: `1px solid ${gameState.settings?.showAllHands !== false ? '#bee5eb' : '#f5c6cb'}`,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '3px'
                    }}>
                        {gameState.settings?.showAllHands !== false ? '🃏 显示手牌' : '🔒 隐藏手牌'}
                    </div>
                </div>{/* 玩家信息区域 */}
                <div className="players-container" style={{ 
                    display: 'flex', 
                    justifyContent: 'space-around', 
                    flexWrap: 'wrap', 
                    marginBottom: '30px',
                    padding: '0 20px'
                }}>                    {gameState.players.map((player, index) => (
                        <Player 
                            key={player.id} 
                            player={player} 
                            isCurrentTurn={gameState.currentPlayerTurn === player.id}
                            gameState={gameState}
                            playerIndex={index}
                        />
                    ))}
                </div>
                  {/* 公共牌区域 - 更大更突出 */}
                <div style={{ 
                    backgroundColor: 'white', 
                    padding: '30px', 
                    marginBottom: '30px', 
                    borderRadius: '15px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                    border: '2px solid #e9ecef'
                }}>                    <CommunityCards 
                        cards={gameState.communityCards} 
                        gamePhase={(gameState.gameState || gameState.phase || 'WAITING').toLowerCase()}
                    />
                </div>
                  {/* 奖池和玩家手牌区域 - 同一水平线 */}
                <div className="center-area" style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center',
                    marginBottom: '30px',
                    padding: '20px 50px',
                    backgroundColor: 'white',
                    borderRadius: '10px',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
                    border: '1px solid #e9ecef'
                }}>
                    {/* 奖池区域 */}
                    <div style={{ flex: '0 0 auto' }}>
                        <Pot amount={gameState.mainPot || 0} sidePots={gameState.sidePots || []} />
                    </div>
                    
                    {/* 玩家手牌区域 - 旁观者不显示 */}
                    {!isSpectator && (
                        <div className="private-cards-area" style={{ 
                            flex: '1', 
                            textAlign: 'center',
                            marginLeft: '40px',
                            marginRight: '40px'
                        }}>                        <h4 className="private-cards-title" style={{ 
                                margin: '0 0 15px 0', 
                                fontSize: '18px',
                                color: '#495057'
                            }}>你的手牌</h4>
                            <div style={{ 
                                display: 'flex', 
                                justifyContent: 'center', 
                                gap: '5px'
                            }}>
                                {privateCards.map((card, index) => (
                                    <Card key={index} suit={card.suit} rank={card.rank} />
                                ))}
                            </div>
                        </div>
                    )}
                    
                    {/* 旁观者占位符 - 保持布局平衡 */}
                    {isSpectator && (
                        <div style={{ 
                            flex: '1', 
                            textAlign: 'center',
                            marginLeft: '40px',
                            marginRight: '40px'
                        }} />
                    )}                      {/* 右侧玩家状态信息 */}
                    <div className="player-status-info" style={{ flex: '0 0 auto', width: '120px' }}>
                        <div style={{ 
                            fontSize: '13px', 
                            color: '#495057',
                            textAlign: 'right',
                            padding: '10px',
                            backgroundColor: '#f8f9fa',
                            borderRadius: '8px',
                            border: '1px solid #dee2e6'
                        }}>
                            <div style={{ marginBottom: '5px', fontWeight: 'bold' }}>我的状态</div>
                            {!isSpectator ? (
                                <>
                                    <div style={{ marginBottom: '3px' }}>
                                        筹码: <AnimatedNumber value={me?.chips || 0} className="chips-gain" enablePulse={true} pulseColor="#28a745" />
                                    </div>
                                    <div>
                                        已下注: <AnimatedNumber value={me?.currentBet || 0} className="pot-increase" enablePulse={true} pulseColor="#ffc107" />
                                    </div>
                                </>
                            ) : (
                                <div style={{ 
                                    color: '#6c757d',
                                    fontStyle: 'italic',
                                    marginTop: '5px'
                                }}>
                                    旁观游戏中
                                </div>
                            )}
                        </div>
                    </div>
                </div>
                  {/* 操作区域 - 隐藏当游戏结束时 */}
                <div className="action-area" style={{ 
                    display: 'flex', 
                    justifyContent: 'center',
                    marginBottom: '20px'
                }}>
                    {me && gameState && gameState.gameState !== 'GAME_OVER' && (
                        <ActionBar roomId={room.id} player={me} gameState={gameState} />
                    )}
                </div>
            </div>            {/* 聊天区域 */}            
            <div className="chat-area" style={{ 
                flexShrink: 0,
                width: '280px',
                maxWidth: '280px',
                display: 'flex',
                flexDirection: 'column',
                height: '100%',
                overflow: 'hidden'
            }}>
                {/* 游戏控制面板 */}
                <div style={{
                    padding: '15px',
                    backgroundColor: '#f8f9fa',
                    borderRadius: '10px',
                    border: '1px solid #dee2e6',
                    marginBottom: '10px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px'
                }}>
                    <div style={{
                        fontSize: '14px',
                        fontWeight: 'bold',
                        color: '#495057',
                        textAlign: 'center'
                    }}>
                        游戏控制
                    </div>
                    
                    {/* 房间信息 */}
                    <div style={{
                        fontSize: '12px',
                        color: '#6c757d',
                        textAlign: 'center'
                    }}>
                        房间: {room.id}
                    </div>
                    
                    {/* 退出房间按钮 */}
                    <button 
                        onClick={handleLeaveRoom}
                        style={{
                            padding: '8px 16px',
                            fontSize: '12px',
                            backgroundColor: '#dc3545',
                            color: 'white',
                            border: 'none',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            transition: 'all 0.3s ease',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '4px',
                            fontWeight: '500',
                            boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                        }}
                        onMouseEnter={(e) => {
                            e.target.style.backgroundColor = '#c82333';
                            e.target.style.transform = 'translateY(-1px)';
                            e.target.style.boxShadow = '0 4px 8px rgba(0,0,0,0.2)';
                        }}
                        onMouseLeave={(e) => {
                            e.target.style.backgroundColor = '#dc3545';
                            e.target.style.transform = 'translateY(0)';
                            e.target.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';
                        }}
                        title="退出房间"
                    >
                        🚪 退出房间
                    </button>
                    
                    {/* 关闭房间按钮 - 仅房主可见 */}
                    {isRoomCreator && (
                        <button 
                            onClick={handleCloseRoom}
                            style={{
                                padding: '8px 16px',
                                fontSize: '12px',
                                backgroundColor: '#ff6b6b',
                                color: 'white',
                                border: 'none',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                transition: 'all 0.3s ease',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '4px',
                                fontWeight: '500',
                                boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                            }}
                            onMouseEnter={(e) => {
                                e.target.style.backgroundColor = '#ff5252';
                                e.target.style.transform = 'translateY(-1px)';
                                e.target.style.boxShadow = '0 4px 8px rgba(0,0,0,0.2)';
                            }}
                            onMouseLeave={(e) => {
                                e.target.style.backgroundColor = '#ff6b6b';
                                e.target.style.transform = 'translateY(0)';
                                e.target.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';
                            }}
                            title="关闭房间（所有玩家将被踢出）"
                        >
                            🔒 关闭房间
                        </button>
                    )}
                    
                    {/* 结束游戏按钮 - 仅房主可见，游戏进行中时 */}
                    {isRoomCreator && gameState && gameState.gameState !== 'WAITING' && gameState.gameState !== 'GAME_OVER' && (
                        <button 
                            onClick={handleEndGame}
                            style={{
                                padding: '8px 16px',
                                fontSize: '12px',
                                backgroundColor: '#ffc107',
                                color: 'white',
                                border: 'none',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                transition: 'all 0.3s ease',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '4px',
                                fontWeight: '500',
                                boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                            }}
                            onMouseEnter={(e) => {
                                e.target.style.backgroundColor = '#e0a800';
                                e.target.style.color = 'white';
                                e.target.style.transform = 'translateY(-1px)';
                                e.target.style.boxShadow = '0 4px 8px rgba(0,0,0,0.2)';
                            }}
                            onMouseLeave={(e) => {
                                e.target.style.backgroundColor = '#ffc107';
                                e.target.style.color = 'white';
                                e.target.style.transform = 'translateY(0)';
                                e.target.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';
                            }}
                            title="结束游戏并显示排行榜"
                        >
                            🏁 结束游戏
                        </button>
                    )}
                    
                    {/* 新游戏按钮 - 仅房主可见，游戏结束后 */}
                    {isRoomCreator && gameState && gameState.gameState === 'GAME_OVER' && (
                        <button 
                            onClick={handleResetGame}
                            style={{
                                padding: '8px 16px',
                                fontSize: '12px',
                                backgroundColor: '#28a745',
                                color: 'white',
                                border: 'none',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                transition: 'all 0.3s ease',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '4px',
                                fontWeight: '500',
                                boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                            }}
                            onMouseEnter={(e) => {
                                e.target.style.backgroundColor = '#218838';
                                e.target.style.color = 'white';
                                e.target.style.transform = 'translateY(-1px)';
                                e.target.style.boxShadow = '0 4px 8px rgba(0,0,0,0.2)';
                            }}
                            onMouseLeave={(e) => {
                                e.target.style.backgroundColor = '#28a745';
                                e.target.style.color = 'white';
                                e.target.style.transform = 'translateY(0)';
                                e.target.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';
                            }}
                            title="重置游戏到准备阶段"
                        >
                            🔄 新游戏
                        </button>
                    )}
                    
                    {/* 查看排行榜按钮 - 所有人可见，游戏结束后 */}
                    {gameState && gameState.gameState === 'GAME_OVER' && (
                        <button 
                            onClick={() => setShowLeaderboard(true)}
                            style={{
                                padding: '8px 16px',
                                fontSize: '12px',
                                backgroundColor: '#007bff',
                                color: 'white',
                                border: 'none',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                transition: 'all 0.3s ease',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '4px',
                                fontWeight: '500',
                                boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                            }}
                            onMouseEnter={(e) => {
                                e.target.style.backgroundColor = '#0056b3';
                                e.target.style.color = 'white';
                                e.target.style.transform = 'translateY(-1px)';
                                e.target.style.boxShadow = '0 4px 8px rgba(0,0,0,0.2)';
                            }}
                            onMouseLeave={(e) => {
                                e.target.style.backgroundColor = '#007bff';
                                e.target.style.color = 'white';
                                e.target.style.transform = 'translateY(0)';
                                e.target.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';
                            }}
                            title="查看游戏结束排行榜"
                        >
                            🏆 查看排行榜
                        </button>
                    )}
                </div>
                
                {/* ChatBox容器，限制其最大高度 */}
                <div style={{ 
                    flex: '1', 
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column',
                    minHeight: 0, // 重要：允许flex子元素缩小
                    maxHeight: 'calc(100% - 170px)' // 为游戏控制面板和音效按钮留出空间
                }}>
                    <ChatBox roomId={room.id} />
                </div>
                
                {/* 音效设置按钮放在聊天框下方 */}
                <button 
                    className="sound-settings-toggle"
                    onClick={() => setShowSoundSettings(true)}
                    style={{
                        marginTop: '10px',
                        background: 'linear-gradient(135deg, #667eea, #764ba2)',
                        color: 'white',
                        border: 'none',
                        borderRadius: '10px',
                        padding: '10px',
                        fontSize: '14px',
                        cursor: 'pointer',
                        boxShadow: '0 4px 8px rgba(0,0,0,0.2)',
                        transition: 'all 0.3s ease',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px',
                        flexShrink: 0,
                        height: '40px', // 固定按钮高度
                        alignSelf: 'stretch' // 拉伸以适应容器宽度
                    }}
                    onMouseEnter={(e) => {
                        e.target.style.transform = 'scale(1.05)';
                    }}
                    onMouseLeave={(e) => {
                        e.target.style.transform = 'scale(1)';
                    }}
                    title="音效设置"
                >
                    🔊 音效设置
                </button>
            </div>
            
            {/* 手牌结果遮罩层 */}
            {handResult && (<HandResult 
                    result={handResult} 
                    socket={socket}
                    roomId={room.id}
                    gameState={gameState}
                    onEndGame={handleEndGame}
                    onClose={() => {
                        console.log('Hand result closed by user');
                        clearHandResult();
                    }}
                />
            )}

            {/* 排行榜遮罩层 */}
            {showLeaderboard && gameState && gameState.leaderboard && (
                <Leaderboard 
                    players={gameState.leaderboard}
                    isRoomCreator={isRoomCreator}
                    onNewGame={handleResetGame}
                    onLeaveRoom={handleLeaveRoom}
                    onCloseRoom={handleCloseRoom}
                    onClose={() => setShowLeaderboard(false)}
                />
            )}

            {/* 音效设置弹窗 */}
            <SoundSettings 
                isOpen={showSoundSettings} 
                onClose={() => setShowSoundSettings(false)} 
            />
            
            {/* 全局消息特效 */}
            {messages.map(message => (
                <GlobalMessage
                    key={message.id}
                    type={message.type}
                    message={message.message}
                    show={message.show}
                    duration={message.duration}
                    onComplete={() => {
                        // 消息完成时的处理可以在这里添加
                    }}
                />
            ))}
        </div>
    );
};

export default GameTable;
