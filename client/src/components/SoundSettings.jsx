import React, { useState, useEffect } from 'react';
import { soundManager } from '../utils/soundManager';
import './SoundSettings.css';

const SoundSettings = ({ isOpen, onClose }) => {
    const [soundEnabled, setSoundEnabled] = useState(true);
    const [volume, setVolume] = useState(0.3);

    useEffect(() => {
        // 从localStorage恢复设置
        const savedSoundEnabled = localStorage.getItem('soundEnabled');
        const savedVolume = localStorage.getItem('soundVolume');
        
        if (savedSoundEnabled !== null) {
            const enabled = savedSoundEnabled === 'true';
            setSoundEnabled(enabled);
            soundManager.setEnabled(enabled);
        }
        
        if (savedVolume !== null) {
            const vol = parseFloat(savedVolume);
            setVolume(vol);
            soundManager.setVolume(vol);
        }
    }, []);

    const handleSoundToggle = (enabled) => {
        setSoundEnabled(enabled);
        soundManager.setEnabled(enabled);
        localStorage.setItem('soundEnabled', enabled.toString());
    };

    const handleVolumeChange = (newVolume) => {
        setVolume(newVolume);
        soundManager.setVolume(newVolume);
        localStorage.setItem('soundVolume', newVolume.toString());
    };

    const testSound = () => {
        soundManager.playChipGain();
    };

    if (!isOpen) return null;

    return (
        <div className="sound-settings-overlay" onClick={onClose}>
            <div className="sound-settings-modal" onClick={e => e.stopPropagation()}>
                <div className="sound-settings-header">
                    <h3>🔊 音效设置</h3>
                    <button className="close-btn" onClick={onClose}>×</button>
                </div>
                
                <div className="sound-settings-content">
                    <div className="setting-group">
                        <label className="setting-label">启用音效</label>
                        <div className="toggle-buttons">
                            <button 
                                className={`toggle-btn ${soundEnabled ? 'active' : ''}`}
                                onClick={() => handleSoundToggle(true)}
                            >
                                开启
                            </button>
                            <button 
                                className={`toggle-btn ${!soundEnabled ? 'active' : ''}`}
                                onClick={() => handleSoundToggle(false)}
                            >
                                关闭
                            </button>
                        </div>
                    </div>                    {soundEnabled && (
                        <>
                            <div className="setting-group">
                                <label className="setting-label">音量 ({Math.round(volume * 100)}%)</label>
                                <input
                                    type="range"
                                    min="0"
                                    max="1"
                                    step="0.1"
                                    value={volume}
                                    onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                                    className="volume-slider"
                                />
                            </div>

                            <div className="setting-group">
                                <label className="setting-label">音效测试</label>
                                <div className="test-buttons">
                                    <button 
                                        className="test-sound-btn"
                                        onClick={() => soundManager.playChipGain()}
                                        disabled={!soundEnabled}
                                    >
                                        💰 筹码增加
                                    </button>
                                    <button 
                                        className="test-sound-btn"
                                        onClick={() => soundManager.playChipLoss()}
                                        disabled={!soundEnabled}
                                    >
                                        💸 筹码减少
                                    </button>
                                    <button 
                                        className="test-sound-btn"
                                        onClick={() => soundManager.playBet(100)}
                                        disabled={!soundEnabled}
                                    >
                                        🎯 下注
                                    </button>
                                    <button 
                                        className="test-sound-btn"
                                        onClick={() => soundManager.playCardFlip()}
                                        disabled={!soundEnabled}
                                    >
                                        🃏 翻牌
                                    </button>
                                    <button 
                                        className="test-sound-btn"
                                        onClick={() => soundManager.playAllIn()}
                                        disabled={!soundEnabled}
                                    >
                                        🚀 全押
                                    </button>
                                    <button 
                                        className="test-sound-btn"
                                        onClick={() => soundManager.playPotIncrease()}
                                        disabled={!soundEnabled}
                                    >
                                        � 奖池
                                    </button>
                                </div>
                            </div>
                        </>
                    )}
                </div>

                <div className="sound-settings-footer">
                    <p className="setting-tip">
                        💡 音效可以让游戏体验更加生动，包括筹码变动、下注等音效提示
                    </p>
                </div>
            </div>
        </div>
    );
};

export default SoundSettings;
