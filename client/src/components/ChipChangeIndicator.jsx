import React, { useState, useEffect } from 'react';
import './ChipChangeIndicator.css';

const ChipChangeIndicator = ({ value, show, onComplete, position = 'center' }) => {
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        if (show && value !== 0) {
            setVisible(true);
            const timer = setTimeout(() => {
                setVisible(false);
                if (onComplete) {
                    setTimeout(onComplete, 300); // 等待动画结束
                }
            }, 2000); // 显示2秒

            return () => clearTimeout(timer);
        }
    }, [show, value, onComplete]);

    if (!visible || value === 0) return null;

    const isGain = value > 0;
    const displayValue = Math.abs(value);

    return (
        <div 
            className={`chip-change-indicator ${isGain ? 'gain' : 'loss'} position-${position}`}
        >
            <div className="chip-change-content">
                <span className="chip-change-icon">
                    {isGain ? '💰' : '💸'}
                </span>
                <span className="chip-change-text">
                    {isGain ? '+' : '-'}{displayValue.toLocaleString()}
                </span>
            </div>
        </div>
    );
};

export default ChipChangeIndicator;
