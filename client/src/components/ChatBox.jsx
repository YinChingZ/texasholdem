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
        <div className="chat-box" style={{ 
            width: '100%', 
            height: '100%', // 使用父容器的全部高度
            border: '2px solid #007bff', 
            padding: '15px', 
            margin: '0',
            background: 'linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%)',
            borderRadius: '15px',
            boxShadow: '0 8px 24px rgba(0, 123, 255, 0.15)',            
            position: 'relative',
            overflow: 'hidden',
            boxSizing: 'border-box',
            display: 'flex',
            flexDirection: 'column'
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
                margin: '0 0 15px 0', 
                fontSize: '18px', 
                color: '#495057',
                textAlign: 'center',
                paddingBottom: '12px',
                borderBottom: '2px solid #007bff',
                fontWeight: '600',
                textTransform: 'uppercase',
                letterSpacing: '1px',
                flexShrink: 0
            }}>💬 聊天室</h5>            <div style={{ 
                flex: '1', // 使用剩余空间
                overflowY: 'scroll', 
                marginBottom: '15px',
                fontSize: '13px',
                padding: '10px',
                backgroundColor: '#f8f9fa',
                borderRadius: '8px',
                border: '1px solid #e9ecef',
                minHeight: '0' // 允许缩小
            }}>
                {messages.map((msg, index) => (
                    <div key={index} style={{ marginBottom: '4px', wordWrap: 'break-word' }}>
                        <strong style={{ color: '#007bff' }}>{msg.sender}</strong>
                        {msg.isSpectator && (
                            <span style={{ 
                                marginLeft: '4px',
                                padding: '2px 6px',
                                backgroundColor: '#6c757d',
                                color: 'white',
                                borderRadius: '4px',
                                fontSize: '10px',
                                fontWeight: '600'
                            }}>旁观者</span>
                        )}
                        <strong>:</strong> 
                        <span style={{ marginLeft: '4px' }}>{msg.message}</span>
                    </div>
                ))}
            </div>            <form onSubmit={handleSendMessage} className="chat-input-container" style={{ 
                display: 'flex', 
                gap: '12px',
                alignItems: 'center',
                width: '100%',
                boxSizing: 'border-box',
                flexShrink: 0 // 确保输入区域不被压缩
            }}><input 
                    type="text" 
                    value={newMessage} 
                    onChange={(e) => setNewMessage(e.target.value)} 
                    placeholder="输入消息..."
                    autoComplete="off"
                    style={{ 
                        flex: '1',
                        fontSize: '14px',
                        padding: '12px 16px',
                        border: '2px solid #e9ecef',
                        borderRadius: '10px',
                        outline: 'none',
                        transition: 'all 0.3s ease',
                        backgroundColor: 'white',
                        minWidth: '0', // 防止flex项目缩小时出现问题
                        boxSizing: 'border-box',
                        WebkitAppearance: 'none', // 移除iOS默认样式
                        WebkitBorderRadius: '10px', // iOS圆角支持
                        touchAction: 'manipulation', // 优化触摸响应
                        userSelect: 'text', // 确保文本可选择
                        WebkitUserSelect: 'text' // iOS文本选择支持
                    }}
                    onFocus={(e) => {
                        e.target.style.borderColor = '#007bff';
                        e.target.style.boxShadow = '0 0 0 3px rgba(0, 123, 255, 0.1)';
                        // 移动端防止页面缩放
                        if (window.navigator.userAgent.match(/iPhone|iPad|Android/i)) {
                            e.target.style.fontSize = '16px'; // 防止iOS自动缩放
                        }
                    }}
                    onBlur={(e) => {
                        e.target.style.borderColor = '#e9ecef';
                        e.target.style.boxShadow = 'none';
                        // 恢复字体大小
                        e.target.style.fontSize = '14px';
                    }}
                    // 移动端优化
                    onTouchStart={(e) => {
                        // 确保输入框在移动端可以正常获取焦点
                        e.currentTarget.focus();
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
            </form>              {/* 添加CSS动画和移动端优化 */}
            <style>{`
                @keyframes borderGlow {
                    0%, 100% { opacity: 0.5; }
                    50% { opacity: 0.8; }
                }
                
                /* 桌面端聊天框基本样式 */
                .chat-box {
                    min-height: 350px !important;
                }
                
                /* 移动端聊天框优化 */
                @media (max-width: 768px) {
                    .chat-box {
                        border-radius: 12px !important;
                        padding: 12px !important;
                        min-height: 250px !important; /* 平板端最小高度 */
                        height: auto !important; /* 覆盖内联样式 */
                    }
                    
                    .chat-input-container input {
                        font-size: 16px !important; /* 防止iOS缩放 */
                        padding: 12px 14px !important;
                    }
                    
                    .chat-input-container button {
                        padding: 12px 10px !important;
                        font-size: 13px !important;
                        min-width: 60px !important;
                    }
                }
                
                /* 手机端特殊优化 */
                @media (max-width: 480px) {
                    .chat-box {
                        min-height: 200px !important; /* 手机端最小高度 */
                        padding: 10px !important;
                        height: auto !important; /* 覆盖内联样式 */
                    }
                    
                    .chat-input-container {
                        gap: 8px !important;
                        flex-direction: row !important; /* 保持水平布局但调整间距 */
                    }
                    
                    .chat-input-container input {
                        flex: 1 !important;
                        font-size: 16px !important;
                        padding: 10px 12px !important;
                        min-width: 0 !important;
                    }
                    
                    .chat-input-container button {
                        padding: 10px 8px !important;
                        font-size: 12px !important;
                        min-width: 50px !important;
                        flex-shrink: 0 !important;
                    }
                    
                    /* 标题在手机端的优化 */
                    .chat-box > h5 {
                        font-size: 16px !important;
                        margin-bottom: 10px !important;
                        padding-bottom: 8px !important;
                    }
                }
                
                /* 超小屏幕优化 */
                @media (max-width: 320px) {
                    .chat-box {
                        min-height: 160px !important;
                        padding: 8px !important;
                    }
                    
                    .chat-input-container input {
                        padding: 8px 10px !important;
                    }
                    
                    .chat-input-container button {
                        padding: 8px 6px !important;
                        font-size: 11px !important;
                    }
                }
            `}</style>
        </div>
    );
};

export default ChatBox;
