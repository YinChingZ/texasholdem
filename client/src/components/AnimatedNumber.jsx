import React, { useState, useEffect } from 'react';
import './AnimatedNumber.css';

const AnimatedNumber = ({ 
    value, 
    duration = 800, 
    prefix = '', 
    suffix = '',
    className = '',
    enablePulse = false,
    pulseColor = '#28a745'
}) => {
    const [displayValue, setDisplayValue] = useState(value);
    const [isAnimating, setIsAnimating] = useState(false);
    const [showPulse, setShowPulse] = useState(false);    useEffect(() => {
        if (displayValue !== value) {
            setIsAnimating(true);
            
            // 如果值增加，显示脉冲效果
            if (enablePulse && value > displayValue) {
                setShowPulse(true);
                setTimeout(() => setShowPulse(false), 600);
            }

            const startValue = displayValue;
            const endValue = value;
            const startTime = Date.now();

            const animate = () => {
                const elapsed = Date.now() - startTime;
                const progress = Math.min(elapsed / duration, 1);
                
                // 使用缓动函数使动画更自然
                const easeProgress = 1 - Math.pow(1 - progress, 3);
                
                const currentValue = Math.round(
                    startValue + (endValue - startValue) * easeProgress
                );
                
                setDisplayValue(currentValue);

                if (progress < 1) {
                    requestAnimationFrame(animate);
                } else {
                    setIsAnimating(false);
                }
            };            requestAnimationFrame(animate);
        }
    }, [value, displayValue, duration, enablePulse]);

    // 格式化数字显示（添加千位分隔符）
    const formatNumber = (num) => {
        return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    };

    return (
        <span 
            className={`animated-number ${className} ${isAnimating ? 'animating' : ''} ${showPulse ? 'pulse' : ''}`}
            style={{
                '--pulse-color': pulseColor
            }}
        >
            {prefix}{formatNumber(displayValue)}{suffix}
        </span>
    );
};

export default AnimatedNumber;
