const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const cors = require('cors'); // 引入 cors
const { Game, Player } = require('./game.js');

const app = express();
const server = http.createServer(app);

// --- 這是你需要修改或確認的地方 ---

// 1. 定义所有允许的前端 URL
const allowedOrigins = [
  "https://texasholdem-beige.vercel.app",
  "https://texasholdem.top",
  "https://www.texasholdem.top",
  "http://localhost:5173" // 本地开发
];

// 2. 設定 Express 的 CORS
//    讓普通的 HTTP 請求 (非 WebSocket) 能通過
app.use(cors({
  origin: allowedOrigins,
  credentials: true // 如果需要支持cookies的话
}));

// 3. 設定 Socket.IO 的 CORS
//    這是讓 WebSocket 連線能通過的關鍵
const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST"],
    credentials: true
  }
});

const rooms = new Map();

const generateRoomId = () => {
    return Math.random().toString(36).substr(2, 6);
}

// 确保房间设置的辅助函数
const ensureRoomSettings = (room) => {
    if (!room.settings) {
        room.settings = { showAllHands: true };
        console.log('房间设置被重新初始化为默认值');
    }
    return room;
};

const broadcastGameState = (roomId) => {
    const room = rooms.get(roomId);
    
    if (!room || !room.game) return;

    // 确保房间有设置
    if (!room.settings) {
        room.settings = { showAllHands: true };
    }

    const { game } = room;
    const gameStateData = game._getGameState();

    const publicGameState = {
        roomId: roomId,
        mainPot: gameStateData.mainPot,
        sidePots: gameStateData.sidePots,
        communityCards: gameStateData.communityCards,
        gameState: gameStateData.gameState,
        currentBet: gameStateData.currentBet,
        smallBlind: gameStateData.smallBlind,
        bigBlind: gameStateData.bigBlind,
        currentPlayerTurn: gameStateData.currentPlayerTurn,
        dealerPosition: gameStateData.dealerPosition,
        smallBlindPosition: gameStateData.smallBlindPosition,
        bigBlindPosition: gameStateData.bigBlindPosition,
        players: gameStateData.players,
        creator: room.creator,
        settings: room.settings
    };

    io.to(roomId).emit('gameStateUpdate', publicGameState);
};

io.on('connection', (socket) => {
  socket.on('createRoom', ({ nickname }) => {
    if (!nickname || nickname.trim() === '') {
        return socket.emit('error', { message: '昵称不能为空' });
    }
    
    const roomId = generateRoomId();
    const player = new Player(socket.id, nickname.trim());
    const game = new Game([player]);    rooms.set(roomId, {
        roomId,
        players: { [socket.id]: player },
        game,
        maxPlayers: 8,
        creator: socket.id,
        settings: {
            showAllHands: true
        }
    });
    
    const savedRoom = rooms.get(roomId);
    socket.join(roomId);

    socket.emit('roomCreated', { roomId, isCreator: true });
    
    // 立即广播游戏状态
    broadcastGameState(roomId);
    
    // 发送设置确认事件给创建者
    socket.emit('roomSettingsUpdate', { settings: savedRoom.settings });
  });

  socket.on('joinRoom', ({ roomId, nickname }) => {
    if (!nickname || nickname.trim() === '') {
        return socket.emit('error', { message: '昵称不能为空' });
    }
    
    const room = rooms.get(roomId);
    if (!room) {
        return socket.emit('error', { message: 'Room not found' });
    }
    if (room.players[socket.id]) {
        return socket.emit('error', { message: '您已在此房间中' });
    }
    if (Object.keys(room.players).length >= room.maxPlayers) {
        return socket.emit('error', { message: 'Room is full' });
    }
    if (room.game.gameState !== 'WAITING') {
        return socket.emit('error', { message: '游戏已开始，无法加入' });
    }

    const player = new Player(socket.id, nickname.trim());
    room.players[socket.id] = player;
    room.game.addPlayer(player);    socket.join(roomId);
    // 通知是否为房间创建者
    socket.emit('roomJoined', { roomId, isCreator: room.creator === socket.id });
    io.to(roomId).emit('playerJoined', { roomId, players: room.game.players.map(p => p.id) });

    broadcastGameState(roomId);
  });

  socket.on('startGame', ({ roomId }) => {
    const room = rooms.get(roomId);
    if (!room || !room.game) {
        return socket.emit('error', { message: '房间不存在' });
    }
    
    // 检查是否为房间创建者
    if (room.creator !== socket.id) {
        return socket.emit('error', { message: '只有房间创建者才能开始游戏' });
    }
    
    // 允许从等待状态或显示结果后开始游戏
    if (room.game.gameState !== 'WAITING' && room.game.gameState !== 'SHOWDOWN_COMPLETE') {
        return socket.emit('error', { message: '游戏已经开始' });
    }
    
    if (room.game.players.length < 2) {
        return socket.emit('error', { message: '至少需要2个玩家才能开始游戏' });
    }      try {
        // 如果是结算状态，先准备下一手
        if (room.game.gameState === 'SHOWDOWN_COMPLETE') {
            const canProceed = room.game.prepareNextHand();
            if (!canProceed) {
                return socket.emit('error', { message: '游戏结束 - 没有足够的玩家继续游戏' });
            }
            // prepareNextHand已经处理了发牌和状态更新，直接发送底牌
            room.game.activePlayers.forEach(player => {
                io.to(player.id).emit('dealPrivateCards', { hand: player.hand });
            });
        } else {
            // 从WAITING状态开始新游戏
            room.game.startGame();
            // Send private cards to each player
            room.game.players.forEach(player => {
                io.to(player.id).emit('dealPrivateCards', { hand: player.hand });
            });
        }
          broadcastGameState(roomId);
    } catch (error) {
        console.error('Error starting game:', error);
        socket.emit('error', { message: error.message });
    }
  });

  socket.on('playerAction', ({ roomId, action, betAmount }) => {
    const room = rooms.get(roomId);
    if (!room || !room.game) {
        return socket.emit('error', { message: '房间不存在' });
    }
    if (!room.players[socket.id]) {
        return socket.emit('error', { message: '您不在此房间中' });
    }
    if (room.game.gameState === 'WAITING' || room.game.gameState === 'SHOWDOWN_COMPLETE') {
        return socket.emit('error', { message: '游戏尚未开始或已结束' });
    }
      try {
        const result = room.game.playerAction(socket.id, action, betAmount);
        
        // 检查是否有手牌结果
        if (result && result.handResult) {
            // 确保房间有设置
            if (!room.settings) {
                room.settings = { showAllHands: true };
            }
            
            const shouldShowAllHands = room.settings.showAllHands !== false;
            
            // 构建获胜者手牌（始终显示）
            const winnerPlayerIds = new Set(result.winners.map(w => w.playerId));
            
            // 分离获胜者和其他玩家的手牌
            const winnersHands = [];
            const otherPlayersHands = [];
            
            if (result.playersHands && Array.isArray(result.playersHands)) {
                result.playersHands.forEach(ph => {
                    const playerHand = {
                        ...ph,
                        nickname: ph.nickname || room.players[ph.playerId]?.nickname || `Player ${ph.playerId}`
                    };
                    
                    if (winnerPlayerIds.has(ph.playerId)) {
                        winnersHands.push(playerHand);
                    } else {
                        otherPlayersHands.push(playerHand);
                    }
                });
            }
            
            // 构建最终的手牌列表：获胜者手牌 + (根据设置显示的其他玩家手牌)
            const finalPlayersHands = [
                ...winnersHands,  // 获胜者手牌始终显示
                ...(shouldShowAllHands ? otherPlayersHands : [])  // 其他玩家手牌根据设置显示
            ];
            
            io.to(roomId).emit('handResult', { 
                winners: result.winners.map(winner => ({
                    playerId: winner.playerId,
                    nickname: winner.nickname || room.players[winner.playerId]?.nickname || `Player ${winner.playerId}`,
                    amount: winner.amount,
                    handDescription: winner.handDescription,
                    handRank: winner.handRank,
                    handValue: winner.handValue
                })),
                communityCards: result.communityCards || (room.game.communityCards && Array.isArray(room.game.communityCards) ? room.game.communityCards.map(c => c.toString()) : []),
                playersHands: finalPlayersHands,
                handComparison: shouldShowAllHands ? result.handComparison : null,
                showAllHands: shouldShowAllHands
            });
              
            // 注释掉自动准备下一手的机制，改为手动触发
            // setTimeout(() => {
            //     if (room && room.game && room.game.gameState === 'SHOWDOWN_COMPLETE') {
            //         const canProceed = room.game.prepareNextHand();
            //         if (canProceed) {
            //             broadcastGameState(roomId);
            //             console.log(`Auto-prepared next hand for room: ${roomId}`);
            //         } else {
            //             console.log(`Cannot prepare next hand for room: ${roomId} - not enough players`);
            //             // 可选：通知所有玩家游戏结束
            //             io.to(roomId).emit('gameOver', { 
            //                 message: '游戏结束 - 没有足够的玩家继续游戏' 
            //             });
            //         }
            //     }
            // }, 5000);
        }
        
        broadcastGameState(roomId);

    } catch (error) {
        socket.emit('error', { message: error.message });
    }
  });  // 新增：手动准备下一手的事件
  socket.on('prepareNextHand', ({ roomId }) => {
    try {
        const room = rooms.get(roomId);
        if (!room || !room.game) {
            socket.emit('error', { message: '房间不存在或游戏未初始化' });
            return;
        }

        // 检查是否为房间创建者
        if (room.creator !== socket.id) {
            socket.emit('error', { message: '只有房间创建者才能开始下一局游戏' });
            return;
        }if (room.game.gameState === 'SHOWDOWN_COMPLETE') {
            const canProceed = room.game.prepareNextHand();
            if (canProceed) {
                // 发送新的底牌给每个活跃玩家
                room.game.activePlayers.forEach(player => {
                    io.to(player.id).emit('dealPrivateCards', { hand: player.hand });
                });
                broadcastGameState(roomId);
            } else {
                console.log(`Cannot prepare next hand for room: ${roomId} - not enough players`);
                io.to(roomId).emit('gameOver', { 
                    message: '游戏结束 - 没有足够的玩家继续游戏' 
                });
            }
        } else {
            socket.emit('error', { message: '游戏状态不正确，无法准备下一手' });
        }
    } catch (error) {
        socket.emit('error', { message: error.message });
    }
  });

  socket.on('sendMessage', ({ roomId, message }) => {
      // Basic chat functionality
      const room = rooms.get(roomId);
      if (room) {
          const player = room.players[socket.id];
          io.to(roomId).emit('newMessage', { 
              sender: player ? player.nickname : 'Spectator', 
              message 
            });
      }
  });
  socket.on('disconnect', () => {
    console.log(`user disconnected: ${socket.id}`);
    for (const [roomId, room] of rooms.entries()) {
        if (room.players[socket.id]) {
            // 检查是否为房间创建者
            const wasCreator = room.creator === socket.id;
            
            // 使用Game类的removePlayer方法
            room.game.removePlayer(socket.id);
            delete room.players[socket.id];

            if (Object.keys(room.players).length === 0) {
                rooms.delete(roomId);
                console.log(`Room ${roomId} is empty and has been deleted.`);
            } else if (wasCreator) {
                // 如果创建者离开，将房主权限转给第一个剩余玩家
                const remainingPlayerIds = Object.keys(room.players);
                if (remainingPlayerIds.length > 0) {
                    room.creator = remainingPlayerIds[0];
                    console.log(`Room ${roomId} creator left, new creator: ${room.creator}`);
                    // 通知新房主
                    io.to(room.creator).emit('becameCreator', { roomId });
                    // 广播更新的游戏状态（包含新的creator信息）
                    broadcastGameState(roomId);
                }
            } else {
                io.to(roomId).emit('playerLeft', { roomId, playerId: socket.id });
                broadcastGameState(roomId);
                console.log(`${socket.id} left room: ${roomId}`);
            }
            break;
        }    }
  });
    // 更新房间设置的事件
  socket.on('updateRoomSettings', ({ roomId, settings }) => {
    try {
        const room = rooms.get(roomId);
        if (!room) {
            socket.emit('error', { message: '房间不存在' });
            return;
        }

        // 检查是否为房间创建者
        if (room.creator !== socket.id) {
            socket.emit('error', { message: '只有房间创建者才能修改设置' });
            return;
        }

        // 确保房间有设置对象
        if (!room.settings) {
            room.settings = { showAllHands: true };
        }
        
        // 更新设置
        if (settings.hasOwnProperty('showAllHands')) {
            room.settings.showAllHands = settings.showAllHands;
        }
        
        // 立即向所有人广播设置更新
        io.to(roomId).emit('roomSettingsUpdate', { settings: room.settings });
        
        // 再次广播游戏状态以确保同步
        broadcastGameState(roomId);
    } catch (error) {
        console.error('Error in updateRoomSettings:', error);
        socket.emit('error', { message: error.message });
    }
  });
});

server.listen(process.env.PORT || 3000, () => {
  console.log(`Server is running on port ${process.env.PORT || 3000}`);
});
