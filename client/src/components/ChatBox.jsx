import React, { useState, useEffect } from 'react';
import { useSocket } from '../contexts/SocketContext';

const ChatBox = ({ roomId }) => {
    const { socket } = useSocket();
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');

    useEffect(() => {
        if (!socket) return;

        const messageListener = (message) => {
            setMessages((prevMessages) => [...prevMessages, message]);
        };

        socket.on('newMessage', messageListener);

        return () => {
            socket.off('newMessage', messageListener);
        };
    }, [socket]);

    const handleSendMessage = (e) => {
        e.preventDefault();
        if (newMessage.trim()) {
            socket.emit('sendMessage', { roomId, message: newMessage });
            setNewMessage('');
        }
    };    return (
        <div style={{ 
            width: '100%', 
            border: '2px solid #007bff', 
            padding: '15px', 
            margin: '0', // 移除外边距，避免超出容器
            background: 'linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%)',
            borderRadius: '15px',
            height: 'fit-content',
            maxHeight: '500px',
            boxShadow: '0 8px 24px rgba(0, 123, 255, 0.15)',            position: 'relative',
            overflow: 'hidden',
            boxSizing: 'border-box'
        }}>
            {/* 装饰性边框 */}
            <div style={{
                position: 'absolute',
                top: '-2px',
                left: '-2px',
                right: '-2px',
                bottom: '-2px',
                background: 'linear-gradient(45deg, #007bff, #0056b3, #007bff)',
                zIndex: -1,
                borderRadius: '15px',
                animation: 'borderGlow 3s ease-in-out infinite'
            }}></div>
            
            <h5 style={{ 
                margin: '0 0 20px 0', 
                fontSize: '18px', 
                color: '#495057',
                textAlign: 'center',
                paddingBottom: '12px',
                borderBottom: '2px solid #007bff',
                fontWeight: '600',
                textTransform: 'uppercase',
                letterSpacing: '1px'
            }}>💬 聊天室</h5>
            <div style={{ 
                height: '200px', 
                overflowY: 'scroll', 
                marginBottom: '20px',
                fontSize: '13px',
                padding: '10px',
                backgroundColor: '#f8f9fa',
                borderRadius: '8px',
                border: '1px solid #e9ecef'
            }}>
                {messages.map((msg, index) => (
                    <div key={index} style={{ marginBottom: '4px', wordWrap: 'break-word' }}>
                        <strong style={{ color: '#007bff' }}>{msg.sender}:</strong> 
                        <span style={{ marginLeft: '4px' }}>{msg.message}</span>
                    </div>
                ))}
            </div>            <form onSubmit={handleSendMessage} style={{ 
                display: 'flex', 
                gap: '12px',
                alignItems: 'center',
                width: '100%',
                boxSizing: 'border-box'
            }}>
                <input 
                    type="text" 
                    value={newMessage} 
                    onChange={(e) => setNewMessage(e.target.value)} 
                    placeholder="输入消息..."                    style={{ 
                        flex: '1',
                        fontSize: '14px',
                        padding: '12px 16px',
                        border: '2px solid #e9ecef',
                        borderRadius: '10px',
                        outline: 'none',
                        transition: 'all 0.3s ease',
                        backgroundColor: 'white',
                        minWidth: '0', // 防止flex项目缩小时出现问题
                        boxSizing: 'border-box'
                    }}
                    onFocus={(e) => {
                        e.target.style.borderColor = '#007bff';
                        e.target.style.boxShadow = '0 0 0 3px rgba(0, 123, 255, 0.1)';
                    }}
                    onBlur={(e) => {
                        e.target.style.borderColor = '#e9ecef';
                        e.target.style.boxShadow = 'none';
                    }}
                />
                <button 
                    type="submit"                    style={{
                        padding: '12px 16px',
                        fontSize: '14px',
                        fontWeight: '600',
                        border: 'none',
                        background: 'linear-gradient(135deg, #007bff 0%, #0056b3 100%)',
                        color: 'white',
                        borderRadius: '10px',
                        cursor: 'pointer',
                        whiteSpace: 'nowrap',
                        transition: 'all 0.3s ease',
                        boxShadow: '0 4px 8px rgba(0, 123, 255, 0.3)',
                        flexShrink: 0, // 防止按钮被压缩
                        minWidth: 'fit-content'
                    }}
                    onMouseEnter={(e) => {
                        e.target.style.transform = 'translateY(-2px)';
                        e.target.style.boxShadow = '0 6px 12px rgba(0, 123, 255, 0.4)';
                    }}
                    onMouseLeave={(e) => {
                        e.target.style.transform = 'translateY(0)';
                        e.target.style.boxShadow = '0 4px 8px rgba(0, 123, 255, 0.3)';
                    }}
                >
                    📤 发送
                </button>
            </form>
            
            {/* 添加CSS动画 */}
            <style>{`
                @keyframes borderGlow {
                    0%, 100% { opacity: 0.5; }
                    50% { opacity: 0.8; }
                }
            `}</style>
        </div>
    );
};

export default ChatBox;
