import React from 'react';

const Card = ({ suit, rank, isCommunityCard = false, isPlayerCard = false }) => {
    const suitMap = { 'Hearts': '♥', 'Diamonds': '♦', 'Clubs': '♣', 'Spades': '♠' };
    const color = (suit === 'Hearts' || suit === 'Diamonds') ? 'red' : 'black';

    // 根据卡牌类型调整尺寸
    const getCardSize = () => {
        if (isCommunityCard) {
            return { width: '70px', height: '100px', fontSize: '24px', margin: '8px' };
        } else if (isPlayerCard) {
            return { width: '35px', height: '50px', fontSize: '12px', margin: '2px' };
        } else {
            return { width: '50px', height: '70px', fontSize: '18px', margin: '5px' };
        }
    };

    const size = getCardSize();

    const cardStyle = {
        border: '1px solid black',
        borderRadius: '5px',
        width: size.width,
        height: size.height,
        display: 'inline-flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '5px',
        margin: size.margin,
        backgroundColor: 'white',
        color: color,
        fontSize: size.fontSize,
        fontWeight: 'bold',
    };

    return (
        <div className="card" style={cardStyle}>
            <span className="card-rank">{rank}<span className="card-suit">{suitMap[suit]}</span></span>
            <span className="card-rank" style={{ alignSelf: 'flex-end', transform: 'rotate(180deg)' }}>{rank}<span className="card-suit">{suitMap[suit]}</span></span>
        </div>
    );
};

export default Card;
