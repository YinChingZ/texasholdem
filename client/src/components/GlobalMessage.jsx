import React, { useState, useEffect } from 'react';
import './GlobalMessage.css';

const GlobalMessage = ({ message, type, show, onComplete, duration = 3000 }) => {
    const [visible, setVisible] = useState(false);
    const [animationClass, setAnimationClass] = useState('');

    useEffect(() => {
        if (show && message) {
            setVisible(true);
            setAnimationClass('slide-in');
            
            // 在动画完成后开始淡出
            const hideTimer = setTimeout(() => {
                setAnimationClass('slide-out');
                
                // 等待淡出动画完成后隐藏
                setTimeout(() => {
                    setVisible(false);
                    if (onComplete) onComplete();
                }, 500);
            }, duration - 500);

            return () => clearTimeout(hideTimer);
        } else {
            setVisible(false);
            setAnimationClass('');
        }
    }, [show, message, duration, onComplete]);

    if (!visible) return null;

    const getMessageConfig = (type) => {
        switch (type) {
            case 'allin':
                return {
                    icon: '🚀',
                    text: 'ALL IN!',
                    className: 'allin',
                    color: '#dc3545'
                };
            case 'fold':
                return {
                    icon: '🚫',
                    text: '弃牌',
                    className: 'fold',
                    color: '#6c757d'
                };
            case 'win':
                return {
                    icon: '🎉',
                    text: '获胜!',
                    className: 'win',
                    color: '#28a745'
                };
            case 'bet':
                return {
                    icon: '💰',
                    text: '下注',
                    className: 'bet',
                    color: '#ffc107'
                };
            default:
                return {
                    icon: '💬',
                    text: message,
                    className: 'default',
                    color: '#007bff'
                };
        }
    };

    const config = getMessageConfig(type);

    return (
        <div className={`global-message ${config.className} ${animationClass}`}>
            <div className="message-content">
                <span className="message-icon">{config.icon}</span>
                <span className="message-text">{config.text}</span>
                {message && message !== config.text && (
                    <span className="message-detail">{message}</span>
                )}
            </div>
            <div className="message-effects">
                <div className="sparkle sparkle-1">✨</div>
                <div className="sparkle sparkle-2">⭐</div>
                <div className="sparkle sparkle-3">💫</div>
            </div>
        </div>
    );
};

export default GlobalMessage;
