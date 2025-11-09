import React from 'react';
import './Leaderboard.css';

const Leaderboard = ({ players, isRoomCreator, onNewGame, onLeaveRoom, onCloseRoom, onClose }) => {
    // Sort players by chips (descending)
    const sortedPlayers = [...players].sort((a, b) => b.chips - a.chips);
    
    return (
        <div className="leaderboard-overlay">
            <div className="leaderboard-modal">
                <button className="leaderboard-close-icon" onClick={onClose} title="关闭">
                    ✖️
                </button>
                <h2>🏆 游戏结束 - 排行榜</h2>
                
                <div className="leaderboard-content">
                    <table className="leaderboard-table">
                        <thead>
                            <tr>
                                <th>排名</th>
                                <th>玩家</th>
                                <th>剩余筹码</th>
                            </tr>
                        </thead>
                        <tbody>
                            {sortedPlayers.map((player, index) => (
                                <tr key={player.id} className={index === 0 ? 'winner-row' : ''}>
                                    <td className="rank-cell">
                                        {index === 0 && <span className="crown">👑</span>}
                                        #{index + 1}
                                    </td>
                                    <td className="player-cell">
                                        {player.nickname}
                                        {index === 0 && <span className="winner-badge">冠军</span>}
                                    </td>
                                    <td className="chips-cell">
                                        {player.chips} 筹码
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                
                <div className="leaderboard-actions">
                    {isRoomCreator ? (
                        <>
                            <button 
                                className="leaderboard-btn new-game-btn"
                                onClick={onNewGame}
                            >
                                🔄 新游戏
                            </button>
                            <button 
                                className="leaderboard-btn close-room-btn"
                                onClick={onCloseRoom}
                            >
                                🔒 关闭房间
                            </button>
                            <button 
                                className="leaderboard-btn leave-btn"
                                onClick={onLeaveRoom}
                            >
                                🚪 离开房间
                            </button>
                        </>
                    ) : (
                        <>
                            <button 
                                className="leaderboard-btn leave-btn"
                                onClick={onLeaveRoom}
                            >
                                🚪 离开房间
                            </button>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Leaderboard;
