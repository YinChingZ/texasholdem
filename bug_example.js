// 德州扑克游戏 - Bug重现代码示例

/**
 * 修复前的问题代码（会导致"轮到其他玩家行动"Bug）
 */

// 问题1：updatePlayerId方法的逻辑缺陷
class GameBuggy {
    updatePlayerId(oldPlayerId, newPlayerId) {
        // ❌ 问题：先更新ID，再检查当前玩家
        const player = this.players.find(p => p.id === oldPlayerId);
        if (player) {
            player.id = newPlayerId; // 旧ID已经被覆盖！
        }
        
        const activePlayer = this.activePlayers.find(p => p.id === oldPlayerId);
        if (activePlayer) {
            activePlayer.id = newPlayerId; // 旧ID已经被覆盖！
        }
        
        // ❌ 这个检查永远不会成功，因为旧ID已经不存在了
        if (this.currentPlayerTurn >= 0 && this.currentPlayerTurn < this.activePlayers.length) {
            const currentPlayer = this.activePlayers[this.currentPlayerTurn];
            if (currentPlayer && currentPlayer.id === newPlayerId) {
                // 这里永远不会执行到，因为上面用的是newPlayerId比较
                console.log('Updated current player'); // 不会执行
            }
        }
    }

    // 问题2：_getGameState缺乏边界检查
    _getGameState() {
        return {
            // ❌ 如果currentPlayerTurn越界，会返回undefined
            currentPlayerTurn: this.currentPlayerTurn >= 0 && this.activePlayers.length > 0 ? 
                this.activePlayers[this.currentPlayerTurn]?.id : null,
            // 其他属性...
        };
    }

    // 问题3：removePlayer不调整索引
    removePlayer(playerId) {
        // ❌ 只是简单删除，不调整currentPlayerTurn
        this.players = this.players.filter(p => p.id !== playerId);
        this.activePlayers = this.activePlayers.filter(p => p.id !== playerId);
        // currentPlayerTurn可能指向无效索引！
    }

    // 问题4：_advanceTurn缺乏保护
    _advanceTurn() {
        // ❌ 没有检查索引有效性
        let nextIndex = this.currentPlayerTurn;
        do {
            nextIndex = (nextIndex + 1) % this.activePlayers.length;
            // ❌ 如果activePlayers为空，会导致除零错误
        } while (this.activePlayers[nextIndex].status !== 'in-game');
        // ❌ 可能无限循环
        
        this.currentPlayerTurn = nextIndex;
    }
}

/**
 * 修复后的正确代码
 */
class GameFixed {
    updatePlayerId(oldPlayerId, newPlayerId) {
        console.log(`Updating player ID from ${oldPlayerId} to ${newPlayerId}`);
        
        // ✅ 先检查当前玩家状态
        let wasCurrentPlayer = false;
        if (this.currentPlayerTurn >= 0 && this.currentPlayerTurn < this.activePlayers.length) {
            const currentPlayer = this.activePlayers[this.currentPlayerTurn];
            if (currentPlayer && currentPlayer.id === oldPlayerId) {
                wasCurrentPlayer = true;
            }
        }
        
        // ✅ 再更新ID
        const player = this.players.find(p => p.id === oldPlayerId);
        if (player) {
            player.id = newPlayerId;
        }
        
        const activePlayer = this.activePlayers.find(p => p.id === oldPlayerId);
        if (activePlayer) {
            activePlayer.id = newPlayerId;
        }
        
        // ✅ 验证索引有效性
        if (this.currentPlayerTurn >= this.activePlayers.length) {
            this.currentPlayerTurn = 0;
        }
        
        if (wasCurrentPlayer) {
            console.log(`Successfully updated current player ID`);
        }
    }

    _getGameState() {
        // ✅ 增强的边界检查
        let currentPlayerTurnId = null;
        if (this.currentPlayerTurn >= 0 && this.currentPlayerTurn < this.activePlayers.length) {
            const currentPlayer = this.activePlayers[this.currentPlayerTurn];
            if (currentPlayer) {
                currentPlayerTurnId = currentPlayer.id;
            }
        }
        
        return {
            currentPlayerTurn: currentPlayerTurnId,
            // 其他属性...
        };
    }

    removePlayer(playerId) {
        console.log(`Removing player ${playerId}`);
        
        // ✅ 检查是否移除当前玩家
        let wasCurrentPlayer = false;
        if (this.currentPlayerTurn >= 0 && this.currentPlayerTurn < this.activePlayers.length) {
            const currentPlayer = this.activePlayers[this.currentPlayerTurn];
            if (currentPlayer && currentPlayer.id === playerId) {
                wasCurrentPlayer = true;
            }
        }
        
        // ✅ 移除玩家
        this.players = this.players.filter(p => p.id !== playerId);
        this.activePlayers = this.activePlayers.filter(p => p.id !== playerId);
        
        // ✅ 调整索引
        if (wasCurrentPlayer) {
            if (this.activePlayers.length === 0) {
                this.currentPlayerTurn = -1;
            } else {
                // 确保索引不越界
                if (this.currentPlayerTurn >= this.activePlayers.length) {
                    this.currentPlayerTurn = 0;
                }
            }
        }
    }

    _advanceTurn() {
        // ✅ 验证当前索引
        if (this.currentPlayerTurn < 0 || this.currentPlayerTurn >= this.activePlayers.length) {
            this.currentPlayerTurn = 0;
        }
        
        // ✅ 防止无限循环
        let nextIndex = this.currentPlayerTurn;
        let attempts = 0;
        const maxAttempts = this.activePlayers.length;
        
        do {
            nextIndex = (nextIndex + 1) % this.activePlayers.length;
            attempts++;
        } while (
            attempts < maxAttempts && 
            this.activePlayers[nextIndex]?.status !== 'in-game'
        );
        
        if (attempts >= maxAttempts) {
            console.error('No valid players found');
            return null;
        }
        
        this.currentPlayerTurn = nextIndex;
        return null;
    }
}

/**
 * Bug触发场景示例
 */

// 场景1：重连触发Bug
function triggerReconnectBug() {
    const game = new GameBuggy();
    game.activePlayers = [
        { id: 'socket1', nickname: 'Alice', status: 'in-game' },
        { id: 'socket2', nickname: 'Bob', status: 'in-game' }
    ];
    game.currentPlayerTurn = 0; // 指向Alice
    
    console.log('Before reconnect:', game.activePlayers[game.currentPlayerTurn].nickname); // Alice
    
    // Alice重连，socket ID变化
    game.updatePlayerId('socket1', 'socket1_new');
    
    // Bug：currentPlayerTurn仍然是0，但可能指向错误的玩家
    const currentPlayerAfter = game._getGameState().currentPlayerTurn;
    console.log('After reconnect bug:', currentPlayerAfter); // 可能是undefined或错误的ID
}

// 场景2：移除玩家触发Bug
function triggerRemovePlayerBug() {
    const game = new GameBuggy();
    game.activePlayers = [
        { id: 'socket1', nickname: 'Alice', status: 'in-game' },
        { id: 'socket2', nickname: 'Bob', status: 'in-game' },
        { id: 'socket3', nickname: 'Charlie', status: 'in-game' }
    ];
    game.currentPlayerTurn = 2; // 指向Charlie
    
    // Charlie离开
    game.removePlayer('socket3');
    
    // Bug：currentPlayerTurn仍然是2，但数组只有2个元素（索引0,1）
    const currentPlayerAfter = game._getGameState().currentPlayerTurn;
    console.log('After remove bug:', currentPlayerAfter); // undefined - 索引越界
}

// 运行Bug演示
console.log('=== Bug演示 ===');
triggerReconnectBug();
triggerRemovePlayerBug();
