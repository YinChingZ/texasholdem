const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const { Game, Player } = require('./game.js');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "http://localhost:5173",
    methods: ["GET", "POST"]
  }
});

const rooms = new Map();

const generateRoomId = () => {
    return Math.random().toString(36).substr(2, 6);
}

const broadcastGameState = (roomId) => {
    const room = rooms.get(roomId);
    if (!room || !room.game) return;

    const { game } = room;
    const gameStateData = game._getGameState();
      console.log(`Broadcasting game state for room ${roomId}:`, {
        gameState: gameStateData.gameState,
        playersCount: gameStateData.players.length,
        roomPlayersCount: Object.keys(room.players).length,
        players: gameStateData.players.map(p => ({ id: p.id, nickname: p.nickname, chips: p.chips })),
        roomPlayers: Object.keys(room.players)
    });
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
        creator: room.creator  // 添加房间创建者信息
    };

    io.to(roomId).emit('gameStateUpdate', publicGameState);
};

io.on('connection', (socket) => {
  console.log(`a user connected: ${socket.id}`);  socket.on('createRoom', ({ nickname }) => {
    if (!nickname || nickname.trim() === '') {
        return socket.emit('error', { message: '昵称不能为空' });
    }
    
    const roomId = generateRoomId();
    const player = new Player(socket.id, nickname.trim());
    const game = new Game([player]);

    rooms.set(roomId, {
        roomId,
        players: { [socket.id]: player },
        game,
        maxPlayers: 8,
        creator: socket.id  // 追踪房间创建者
    });
    socket.join(roomId);
    socket.emit('roomCreated', { roomId, isCreator: true });
    console.log(`Room created: ${roomId} by ${socket.id} (creator)`);
    broadcastGameState(roomId);
  });  socket.on('joinRoom', ({ roomId, nickname }) => {
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
    room.game.addPlayer(player);

    socket.join(roomId);
    // 通知是否为房间创建者
    socket.emit('roomJoined', { roomId, isCreator: room.creator === socket.id });
    io.to(roomId).emit('playerJoined', { roomId, players: room.game.players.map(p => p.id) });
    console.log(`${socket.id} joined room: ${roomId}`);
    broadcastGameState(roomId);
  });  socket.on('startGame', ({ roomId }) => {
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
        console.log(`Game started in room: ${roomId}`);
    } catch (error) {
        console.error('Error starting game:', error);
        socket.emit('error', { message: error.message });
    }
  });  socket.on('playerAction', ({ roomId, action, betAmount }) => {
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
    
    console.log(`Player action received:`, {
        playerId: socket.id,
        action,
        betAmount,
        gameState: room.game.gameState,
        currentBet: room.game.currentBet,
        mainPot: room.game.mainPot
    });
    
    try {
        const result = room.game.playerAction(socket.id, action, betAmount);
        
        console.log(`Action processed:`, {
            result: result ? 'Hand ended' : 'Continue',
            newGameState: room.game.gameState,
            newMainPot: room.game.mainPot,
            newCurrentBet: room.game.currentBet
        });          // 检查是否有手牌结果
        if (result && result.handResult) {
            console.log('Hand result received from game:', {
                winners: result.winners,
                playerHandsCount: result.playerHands?.length || 0,
                communityCardsCount: result.communityCards?.length || 0,
                handComparison: result.handComparison
            });            
            // 发送完整的手牌结果 - 直接使用game.js返回的完整数据
            io.to(roomId).emit('handResult', { 
                winners: result.winners.map(winner => ({
                    playerId: winner.playerId,
                    nickname: winner.nickname || room.players[winner.playerId]?.nickname || `Player ${winner.playerId}`,
                    amount: winner.amount,
                    handDescription: winner.handDescription,
                    handRank: winner.handRank,
                    handValue: winner.handValue
                })),                communityCards: result.communityCards || (room.game.communityCards && Array.isArray(room.game.communityCards) ? room.game.communityCards.map(c => c.toString()) : []),
                playersHands: (result.playersHands && Array.isArray(result.playersHands)) ? result.playersHands.map(ph => ({
                    ...ph,
                    nickname: ph.nickname || room.players[ph.playerId]?.nickname || `Player ${ph.playerId}`
                })) : [],                handComparison: result.handComparison
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
        console.log(`Received prepareNextHand request for room: ${roomId}`);
        console.log(`Available rooms:`, Array.from(rooms.keys()));
        
        const room = rooms.get(roomId);
        if (!room || !room.game) {
            console.error(`Room not found or no game: roomId=${roomId}, room=${!!room}, game=${!!room?.game}`);
            socket.emit('error', { message: '房间不存在或游戏未初始化' });
            return;
        }

        // 检查是否为房间创建者
        if (room.creator !== socket.id) {
            socket.emit('error', { message: '只有房间创建者才能开始下一局游戏' });
            return;
        }

        console.log(`Room found, current game state: ${room.game.gameState}`);
          if (room.game.gameState === 'SHOWDOWN_COMPLETE') {
            const canProceed = room.game.prepareNextHand();
            if (canProceed) {
                // 发送新的底牌给每个活跃玩家
                room.game.activePlayers.forEach(player => {
                    io.to(player.id).emit('dealPrivateCards', { hand: player.hand });
                    console.log(`Dealt new private cards to player ${player.id}:`, player.hand);
                });
                broadcastGameState(roomId);
                console.log(`Manually prepared next hand for room: ${roomId}`);
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
        }
    }
  });
});

server.listen(3000, () => {
  console.log('listening on *:3000');
});
