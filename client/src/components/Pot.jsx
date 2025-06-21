import React, { useState, useEffect } from 'react';
import AnimatedNumber from './AnimatedNumber';
import ChipChangeIndicator from './ChipChangeIndicator';

const Pot = ({ amount, sidePots = [] }) => {
    const [previousAmount, setPreviousAmount] = useState(amount || 0);
    const [showPotChange, setShowPotChange] = useState(false);
    const [potChange, setPotChange] = useState(0);

    // 检测奖池变化
    useEffect(() => {
        const currentAmount = amount || 0;
        if (previousAmount !== currentAmount) {
            const change = currentAmount - previousAmount;
            if (change > 0) { // 只在奖池增加时显示
                setPotChange(change);
                setShowPotChange(true);
            }
            setPreviousAmount(currentAmount);
        }
    }, [amount, previousAmount]);    const style = {
        border: '3px solid #ffc107',
        borderRadius: '50%',
        width: '130px',
        height: '130px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        margin: '0 auto',
        background: 'linear-gradient(135deg, #fff8dc 0%, #ffeaa7 100%)',
        fontWeight: 'bold',
        fontSize: '14px',
        boxShadow: '0 8px 20px rgba(255, 193, 7, 0.4), inset 0 2px 4px rgba(255, 255, 255, 0.3)',
        color: '#856404',        position: 'relative',
        overflow: 'hidden'
    };

    const pulseStyle = {
        position: 'absolute',
        top: '-3px',
        left: '-3px',
        right: '-3px',
        bottom: '-3px',
        border: '2px solid #ffc107',
        borderRadius: '50%',
        animation: 'potPulse 2s ease-in-out infinite',
        opacity: 0.6
    };

    const totalPot = (amount || 0) + sidePots.reduce((sum, pot) => sum + pot.amount, 0);    return (
        <div className="pot-container" style={style}>            <div style={pulseStyle}></div>
            <div style={{ fontSize: '12px', marginBottom: '4px', opacity: 0.8 }}>总奖池</div>
            <div className="pot-amount" style={{ fontSize: '18px', fontWeight: 'bold', textShadow: '0 1px 2px rgba(0,0,0,0.1)' }}>                <AnimatedNumber 
                    value={amount || 0} 
                    prefix="$" 
                    className="pot-increase"
                    enablePulse={true}
                    pulseColor="#ffc107"
                />
            </div>
            {sidePots.length > 0 && (
                <div style={{ fontSize: '10px', marginTop: '4px', opacity: 0.9 }}>
                    +{sidePots.length}个边池
                </div>
            )}
            <style>{`
                @keyframes potPulse {
                    0%, 100% { 
                        transform: scale(1);
                        opacity: 0.6;
                    }
                    50% { 
                        transform: scale(1.05);
                        opacity: 0.3;                    }
                }
            `}</style>
            
            {/* 奖池变动指示器 */}
            <ChipChangeIndicator
                value={potChange}
                show={showPotChange}
                onComplete={() => setShowPotChange(false)}
                position="top"
            />
        </div>
    );
};

export default Pot;
