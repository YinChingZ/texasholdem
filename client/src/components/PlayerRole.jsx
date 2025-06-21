import React from 'react';
import './PlayerRole.css';

const PlayerRole = ({ role, isActive = true }) => {
    const getRoleDisplay = (role) => {
        switch (role) {
            case 'dealer':
                return { icon: '🎯', text: '庄家', color: '#28a745', name: '庄家' };
            case 'smallBlind':
                return { icon: '💰', text: '小盲', color: '#ffc107', name: '小盲' };
            case 'bigBlind':
                return { icon: '💸', text: '大盲', color: '#dc3545', name: '大盲' };
            default:
                return null;
        }
    };

    const roleDisplay = getRoleDisplay(role);
    if (!roleDisplay) return null;

    return (
        <div 
            className={`player-role ${role} ${isActive ? 'active' : 'inactive'}`}
            title={roleDisplay.name}
        >
            <span className="role-icon">{roleDisplay.icon}</span>
            <span className="role-text">{roleDisplay.text}</span>
        </div>
    );
};

export default PlayerRole;
