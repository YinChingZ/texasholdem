const poker = require('poker-evaluator');

class Card {
    constructor(suit, rank) {
        this.suit = suit;
        this.rank = rank;
    }

    toString() {
        const rankMap = { '10': 'T', 'J': 'J', 'Q': 'Q', 'K': 'K', 'A': 'A' };
        const suitMap = { 'Hearts': 'h', 'Diamonds': 'd', 'Clubs': 'c', 'Spades': 's' };
        return (rankMap[this.rank] || this.rank) + suitMap[this.suit];
    }
}

class Deck {
    constructor() {
        this.cards = [];
        const suits = ['Hearts', 'Diamonds', 'Clubs', 'Spades'];
        const ranks = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
        for (const suit of suits) {
            for (const rank of ranks) {
                this.cards.push(new Card(suit, rank));
            }
        }
        this.shuffle();
        console.log(`New deck created with ${this.cards.length} cards`);
    }

    shuffle() {
        for (let i = this.cards.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this.cards[i], this.cards[j]] = [this.cards[j], this.cards[i]];
        }
    }    deal() {
        const card = this.cards.pop();
        return card;
    }
}

class Player {
    constructor(id, nickname, chips = 1000) {
        this.id = id;
        this.nickname = nickname;
        this.chips = chips;
        this.hand = [];
        this.status = 'in-game'; // 'in-game', 'folded', 'all-in'
        this.currentBet = 0;
        this.totalBetThisHand = 0; // 记录整手牌的累计下注额
        this.hasActed = false; // 标记玩家是否在当前轮次已行动
        this.winnings = 0; // 本手赢得的筹码
        this.leftTable = false; // 标记玩家是否已在手牌进行中离桌（弃权）
    }
}

class Game {
    constructor(players, smallBlind = 5, bigBlind = 10) {
        this.players = players;
        this.smallBlind = smallBlind;
        this.bigBlind = bigBlind;
        this.deck = new Deck();
        this.mainPot = 0;
        this.sidePots = []; // 用于存储边池
        this.communityCards = [];
        this.gameState = 'WAITING'; // 'WAITING', 'PREFLOP', 'FLOP', 'TURN', 'RIVER', 'SHOWDOWN'
        this.dealerPosition = Math.floor(Math.random() * players.length);
        this.smallBlindPosition = -1;
        this.bigBlindPosition = -1;
        this.currentPlayerTurn = -1;
        this.currentBet = 0;
        this.lastRaiser = null;
        this.minRaise = bigBlind; // 当前允许的最小加注增量（上一次完整加注的大小）
        this.roundComplete = false; // 标记当前回合是否完成
        this.activePlayers = []; // 当前活跃玩家
        this.dealerPlayerId = null; // 以稳定的玩家身份记录庄家钮（跨手不受数组重建影响）
        this._lastButtonSeat = -1; // 庄家离桌时的回退定位
    }

    // 校验并规整来自客户端的下注金额，杜绝 NaN / 负数 / 非整数污染牌局状态
    static _sanitizeAmount(amount) {
        const n = Number(amount);
        if (!Number.isFinite(n) || n < 0) return 0;
        return Math.floor(n);
    }

    // 以稳定的座位顺序（this.players）轮转庄家钮，并映射为 activePlayers 下标，
    // 供客户端角色标识使用。修复“玩家破产/离桌后 dealerPosition 随数组重建而跳位”的问题。
    _rotateButton() {
        const seats = this.players;
        const n = seats.length;
        if (n === 0) { this.dealerPosition = -1; this.dealerPlayerId = null; return; }

        let startSeat;
        const prevSeat = this.dealerPlayerId != null
            ? seats.findIndex(p => p.id === this.dealerPlayerId)
            : -1;
        if (prevSeat >= 0) {
            startSeat = prevSeat;
        } else if (this._lastButtonSeat >= 0) {
            // 上一任庄家已离桌：从其最后所在座位附近继续（钳制到有效范围）
            startSeat = Math.min(this._lastButtonSeat, n - 1) - 1;
        } else {
            // 首手：随机起始座位（-1 使下方 +1 后落在随机座位）
            startSeat = Math.floor(Math.random() * n) - 1;
        }

        for (let step = 1; step <= n; step++) {
            const cand = seats[(((startSeat + step) % n) + n) % n];
            if (cand.chips > 0) {
                this.dealerPlayerId = cand.id;
                this._lastButtonSeat = seats.findIndex(p => p.id === cand.id);
                this.dealerPosition = this.activePlayers.findIndex(p => p.id === cand.id);
                return;
            }
        }
        // 理论不可达（调用方已保证至少 2 名有筹码玩家）
        this.dealerPosition = 0;
        this.dealerPlayerId = this.activePlayers[0]?.id ?? null;
    }

    // 依据 dealerPosition 计算盲注位（activePlayers 下标）
    _assignBlindPositions() {
        const len = this.activePlayers.length;
        if (len === 2) {
            this.smallBlindPosition = this.dealerPosition;
            this.bigBlindPosition = (this.dealerPosition + 1) % len;
        } else {
            this.smallBlindPosition = (this.dealerPosition + 1) % len;
            this.bigBlindPosition = (this.dealerPosition + 2) % len;
        }
    }

    startGame() {
        if (this.players.length < 2) {
            throw new Error('至少需要2个玩家才能开始游戏');
        }

        this.gameState = 'PREFLOP';
        this.deck = new Deck();
        this.mainPot = 0;
        this.sidePots = [];
        this.communityCards = [];
        
        console.log(`Starting new game - deck has ${this.deck.cards.length} cards`);
          // 重置玩家状态
        this.players.forEach(p => {
            p.hand = [];
            p.status = 'in-game';
            p.currentBet = 0;           // 当前回合的下注
            p.totalBetThisHand = 0;     // 整手牌的累计下注
            p.hasActed = false;
        });
          // 更新活跃玩家列表
        this.activePlayers = this.players.filter(p => p.chips > 0);
        if (this.activePlayers.length < 2) {
            throw new Error('没有足够的玩家有筹码参与游戏');
        }
        // 确定位置：以稳定身份轮转庄家钮，再计算盲注位
        this._rotateButton();
        this._assignBlindPositions();

        // 下盲注
        this._postBlind(this.smallBlindPosition, this.smallBlind);
        this._postBlind(this.bigBlindPosition, this.bigBlind);
        this.currentBet = this.bigBlind;
        this.minRaise = this.bigBlind; // 新一手最小加注增量重置为大盲
        // 发手牌
        for (let i = 0; i < 2; i++) {
            for (const player of this.activePlayers) {
                const dealtCard = this.deck.deal();
                player.hand.push(dealtCard);
            }
        }

        // 开始第一轮下注
        this.roundComplete = false;
        this.currentPlayerTurn = (this.bigBlindPosition + 1) % this.activePlayers.length;
        // 盲注位置的玩家尚未真正行动
        this.activePlayers[this.smallBlindPosition].hasActed = false;
        this.activePlayers[this.bigBlindPosition].hasActed = false;
        this.lastRaiser = this.activePlayers[this.bigBlindPosition].id;
    }    _postBlind(position, amount) {
        const player = this.activePlayers[position];
        const blindAmount = Math.min(player.chips, amount);
        player.chips -= blindAmount;
        player.currentBet = blindAmount;        // 当前回合下注
        player.totalBetThisHand = blindAmount;  // 整手牌累计下注
        this.mainPot += blindAmount;
        
        if (player.chips === 0) {
            player.status = 'all-in';
        }
    }playerAction(playerId, action, betAmount = 0) {
        const playerIndex = this.activePlayers.findIndex(p => p.id === playerId);
        if (playerIndex !== this.currentPlayerTurn) {
            throw new Error("不是你的回合");
        }

        const player = this.activePlayers[playerIndex];
        
        // 标记玩家已行动
        player.hasActed = true;

        switch (action) {
            case 'fold':
                player.status = 'folded';
                break;
                  case 'check':
                if (player.currentBet < this.currentBet) {
                    throw new Error(`无法过牌，必须跟注或加注。当前需要下注: ${this.currentBet}, 你的下注: ${player.currentBet}`);
                }
                console.log(`Player ${player.id} checked. Current bet: ${this.currentBet}, Player bet: ${player.currentBet}`);
                break;
                
            case 'call':
                this._handleCall(player);
                break;
                
            case 'raise':
            case 'bet':
                this._handleRaise(player, betAmount);
                break;
                
            default:
                throw new Error(`无效操作: ${action}`);        }

        const result = this._advanceTurn();

        if (result && (result.handResult || result.runout)) {
            return result;
        }

        return this._getGameState();
    }

    // all-in runout：推进一街（或在河牌后执行摊牌）。仅当 playerAction 返回
    // { runout: true } 后由服务端调用，每次调用推进一街并返回下一个标记/结果。
    advanceRunoutStreet() {
        return this._advanceGameState();
    }
      _handleCall(player) {
        const amountToCall = this.currentBet - player.currentBet;
        const callAmount = Math.min(player.chips, amountToCall);
        
        player.chips -= callAmount;
        player.currentBet += callAmount;        // 更新当前回合下注
        player.totalBetThisHand += callAmount;  // 更新整手牌累计
        this.mainPot += callAmount;
        
        console.log(`Player ${player.id} called:`, {
            callAmount,
            newCurrentBet: player.currentBet,
            newTotalBet: player.totalBetThisHand,
            remainingChips: player.chips
        });
        
        if (player.chips === 0) {
            player.status = 'all-in';
            // this._createSidePots(); // 移动到 _endBettingRound 统一处理
        }
    }_handleRaise(player, rawRaiseAmount) {
        // 规整客户端输入，杜绝 NaN / 负数 / 小数污染状态
        const raiseAmount = Game._sanitizeAmount(rawRaiseAmount);
        const amountToCall = this.currentBet - player.currentBet;

        // 如果玩家筹码不足以跟注，则只能全押跟注（并非加注）
        if (player.chips <= amountToCall) {
            return this._handleCall(player);
        }

        // 最小加注增量 = 本轮上一次“完整加注”的大小（首次加注为大盲）
        const minPureRaiseAmount = this.minRaise;

        // 玩家实际要投入的总金额 = 跟注金额 + 加注金额
        const totalBetAmount = amountToCall + raiseAmount;
        const actualAmount = Math.min(player.chips, totalBetAmount);
        const isAllIn = actualAmount >= player.chips;

        // 非全押时必须满足最小加注额（全押可低于最小加注）
        if (!isAllIn && raiseAmount < minPureRaiseAmount) {
            throw new Error(`加注金额必须至少为 ${minPureRaiseAmount}`);
        }

        const prevCurrentBet = this.currentBet;

        // 扣除筹码并更新下注
        player.chips -= actualAmount;
        player.currentBet += actualAmount;      // 更新当前回合下注
        player.totalBetThisHand += actualAmount; // 更新整手牌累计
        this.mainPot += actualAmount;

        // 更新当前最高下注
        if (player.currentBet > this.currentBet) {
            this.currentBet = player.currentBet;
        }

        const raiseIncrement = player.currentBet - prevCurrentBet;

        console.log(`Player ${player.id} raised:`, {
            raiseAmount,
            totalAmount: actualAmount,
            raiseIncrement,
            newGameCurrentBet: this.currentBet,
            newTotalBet: player.totalBetThisHand,
            remainingChips: player.chips
        });

        if (raiseIncrement >= minPureRaiseAmount) {
            // 完整加注：刷新最小加注增量并重新打开其他玩家的行动
            this.minRaise = raiseIncrement;
            this.lastRaiser = player.id;
            this.activePlayers.forEach(p => {
                if (p.id !== player.id && p.status === 'in-game') {
                    p.hasActed = false;
                }
            });
        }
        // 否则为低于最小加注的全押：不重新打开加注权；仍未跟注的玩家会因
        // betsEqual=false 被要求跟注，但已行动玩家不会被强制再次行动。

        if (player.chips === 0) {
            player.status = 'all-in';
            // this._createSidePots(); // 移动到 _endBettingRound 统一处理
        }
    }    _createSidePots() {
        // 使用所有参与了本手牌下注的玩家，包括已弃牌的
        const playersInHand = this.activePlayers;
        
        // 找出所有未弃牌的玩家
        const activePlayers = playersInHand.filter(p => p.status !== 'folded');
        
        // 获取所有玩家的下注额，去重并排序
        const uniqueBets = [...new Set(playersInHand.map(p => p.totalBetThisHand).filter(b => b > 0))].sort((a, b) => a - b);
        
        let totalProcessedBet = 0;
        const pots = []; // 一个临时数组，用于存放所有彩池（主池和边池）

        // 遍历每个下注级别来创建彩池
        for (const betLevel of uniqueBets) {
            const contributionThisLevel = betLevel - totalProcessedBet;
            if (contributionThisLevel <= 0) continue;

            let potThisLevel = 0;
            // 找出有资格赢取这个彩池的玩家（即下注额达到或超过当前级别的未弃牌玩家）
            const eligibleToWin = activePlayers
                .filter(p => p.totalBetThisHand >= betLevel)
                .map(p => p.id);

            // 从所有玩家（包括已弃牌）那里收集筹码
            for (const player of playersInHand) {
                // 玩家在这一级别贡献的筹码
                const playerContribution = Math.min(player.totalBetThisHand, betLevel) - totalProcessedBet;
                if (playerContribution > 0) {
                    potThisLevel += playerContribution;
                }
            }

            if (potThisLevel > 0) {
                pots.push({
                    amount: potThisLevel,
                    eligiblePlayers: eligibleToWin
                });
            }
            
            totalProcessedBet = betLevel;
        }
        
        // 从 pots 数组中设置主池和边池
        if (pots.length > 0) {
            this.mainPot = pots[0].amount;
            this.sidePots = pots.slice(1);
        } else {
            // 如果没有创建任何彩池，则根据所有下注计算主池
            this.mainPot = playersInHand.reduce((sum, p) => sum + p.totalBetThisHand, 0);
            this.sidePots = [];
        }

        console.log('Side pots created:', {
            mainPot: this.mainPot,
            sidePots: this.sidePots,
            playerBets: playersInHand.map(p => ({ 
                id: p.id, 
                totalBetThisHand: p.totalBetThisHand, 
                status: p.status 
            }))
        });
    }

    // 只剩一名未弃牌玩家时直接结算：赢家收下全部已投入筹码。
    // 由 _advanceTurn 及中途离桌导致的弃牌收敛共用。
    _resolveSingleWinner(winner) {
        const totalPot = this.activePlayers.reduce((sum, p) => sum + p.totalBetThisHand, 0);
        winner.chips += totalPot;
        winner.winnings = totalPot;

        const playersHands = this.activePlayers.map(p => ({
            playerId: p.id,
            nickname: p.nickname,
            hand: (p.hand && Array.isArray(p.hand)) ? p.hand.map(card => ({
                suit: card.suit,
                rank: card.rank,
                toString: card.toString()
            })) : [],
            handDescription: p.id === winner.id ? '唯一的赢家' : (p.status === 'folded' ? '弃牌' : '未摊牌'),
            handValue: p.id === winner.id ? 999999999 : 0,
            handRank: p.id === winner.id ? '获胜' : (p.status === 'folded' ? '弃牌' : '未摊牌'),
            rank: p.id === winner.id ? 1 : null,
            isWinner: p.id === winner.id,
            bestCards: [],
            status: p.status,
            result: p.id === winner.id ? { value: 999999999 } : null
        }));

        const result = {
            winners: [{
                playerId: winner.id,
                nickname: winner.nickname,
                amount: totalPot,
                handDescription: '唯一的赢家',
                handRank: '获胜',
                handValue: 999999999
            }],
            playersHands,
            handComparison: {
                rankedPlayers: [{
                    rank: 1,
                    playerId: winner.id,
                    nickname: winner.nickname,
                    handDescription: '唯一的赢家',
                    handRank: '获胜',
                    handValue: 999999999
                }],
                totalActivePlayers: 1
            },
            communityCards: (this.communityCards && Array.isArray(this.communityCards)) ? this.communityCards.map(c => c.toString()) : [],
            handResult: true
        };

        this._cleanupAfterHand();
        return result;
    }

    _advanceTurn() {
        console.log('_advanceTurn called');
        console.log('Current state:', {
            currentPlayerTurn: this.currentPlayerTurn,
            activePlayersLength: this.activePlayers.length,
            activePlayers: this.activePlayers.map(p => ({ id: p.id, nickname: p.nickname, status: p.status }))
        });
        
        // 检查是否只剩一个未弃牌玩家
        const contenders = this.activePlayers.filter(p => p.status !== 'folded');
        if (contenders.length === 1) {
            return this._resolveSingleWinner(contenders[0]);
        }

        // 检查回合是否结束
        if (this._isBettingRoundOver()) {
            return this._endBettingRound();
        }
        
        // 验证当前 currentPlayerTurn 的有效性
        if (this.currentPlayerTurn < 0 || this.currentPlayerTurn >= this.activePlayers.length) {
            console.warn(`Invalid currentPlayerTurn: ${this.currentPlayerTurn}, resetting to first valid player`);
            this.currentPlayerTurn = this.activePlayers.findIndex(p => p.status === 'in-game');
            if (this.currentPlayerTurn === -1) {
                console.error('No valid players found in activePlayers');
                return null;
            }
        }
        
        // 查找下一个可行动玩家
        let nextPlayer;
        let nextIndex = this.currentPlayerTurn;
        let attempts = 0;
        const maxAttempts = this.activePlayers.length; // 防止无限循环
        
        do {
            nextIndex = (nextIndex + 1) % this.activePlayers.length;
            nextPlayer = this.activePlayers[nextIndex];
            attempts++;
            
            if (attempts >= maxAttempts) {
                console.error('Could not find next valid player after full cycle');
                break;
            }
        } while (nextPlayer && nextPlayer.status !== 'in-game' && attempts < maxAttempts);
        
        if (!nextPlayer || nextPlayer.status !== 'in-game') {
            console.error('No valid next player found');
            return null;
        }
        
        this.currentPlayerTurn = nextIndex;
        console.log(`Advanced turn to player ${nextPlayer.id} (${nextPlayer.nickname}) at index ${nextIndex}`);
        return null;
    }    _isBettingRoundOver() {
        // 获取当前有行动能力的玩家（未弃牌且未全押）
        const actionablePlayers = this.activePlayers.filter(
            p => p.status === 'in-game'
        );
        
        // 获取所有未弃牌的玩家
        const playersInHand = this.activePlayers.filter(p => p.status !== 'folded');
        
        // 如果无人可行动，则回合结束（所有人都all-in或弃牌）
        if (actionablePlayers.length === 0) return true;
        
        // 如果只有一个人可以行动，其他人都all-in或弃牌，则该玩家无需再行动
        if (actionablePlayers.length === 1) {
            // 检查这个玩家的下注是否已经至少等于所有all-in玩家的最高下注
            const maxAllInBet = Math.max(
                ...playersInHand
                    .filter(p => p.status === 'all-in')
                    .map(p => p.currentBet),
                0
            );
            
            const activePlayer = actionablePlayers[0];
            if (activePlayer.currentBet >= maxAllInBet) {
                return true; // 该玩家已经匹配了最高下注，回合结束
            }
        }
        
        // 检查是否所有未弃牌玩家下注相等或已全押
        const betsEqual = playersInHand.every(p => 
            p.currentBet === this.currentBet || p.status === 'all-in'
        );
            
        // 检查是否所有有行动能力的玩家都已行动
        const allActed = actionablePlayers.every(p => p.hasActed);
        
        return betsEqual && allActed;
    }    _endBettingRound() {
        console.log('Ending betting round:', {
            gameState: this.gameState,
            mainPot: this.mainPot,
            currentBet: this.currentBet,
            playerBets: this.activePlayers.map(p => ({ 
                id: p.id, 
                currentBet: p.currentBet, 
                totalBetThisHand: p.totalBetThisHand,
                status: p.status 
            }))
        });
        
        // 在回合结束时创建边池（如果有all-in玩家）
        const hasAllInPlayers = this.activePlayers.some(p => p.status === 'all-in');
        if (hasAllInPlayers) {
            this._createSidePots();
        }
        
        // 重置玩家的回合状态
        this.activePlayers.forEach(p => {
            p.hasActed = false;
            // 在新回合开始时，清零当前回合下注，为新回合做准备
            p.currentBet = 0;
            // 保持 totalBetThisHand，这是整手牌的累计下注
        });
        
        // 新回合开始，重置当前回合的下注要求为0
        this.currentBet = 0;
        this.lastRaiser = null;
        this.minRaise = this.bigBlind; // 每条街最小加注增量重置为大盲
        this.roundComplete = true;
        
        console.log('Round ended, advancing game state...');
        return this._advanceGameState();
    }_advanceGameState() {
        console.log('Advancing game state from:', this.gameState);
        
        switch (this.gameState) {
            case 'PREFLOP':
                this.gameState = 'FLOP';
                // 发放翻牌（3张）
                const flopCards = [this.deck.deal(), this.deck.deal(), this.deck.deal()];
                this.communityCards.push(...flopCards);
                console.log('Flop cards dealt:', flopCards.map(c => c.toString()));
                break;
            case 'FLOP':
                this.gameState = 'TURN';
                // 发放转牌（1张）
                const turnCard = this.deck.deal();
                this.communityCards.push(turnCard);
                console.log('Turn card dealt:', turnCard.toString());
                break;
            case 'TURN':
                this.gameState = 'RIVER';
                // 发放河牌（1张）
                const riverCard = this.deck.deal();
                this.communityCards.push(riverCard);
                console.log('River card dealt:', riverCard.toString());
                break;
            case 'RIVER':
                this.gameState = 'SHOWDOWN';
                console.log('Moving to showdown');
                break;
        }

        if (this.gameState === 'SHOWDOWN') {
            return this._showdown();
        } else {
            // 开始新一轮下注
            const playersInGame = this.activePlayers.filter(p => p.status === 'in-game');
            
            if (playersInGame.length <= 1) {
                // 无人（或仅剩一人）可行动，后续街没有下注空间：返回 runout 标记，
                // 由调用方（index.js）逐街推进并广播。这同时修复了旧实现
                // “一人 all-in 被跟注后直接在当前街摊牌、不发剩余公共牌”的规则错误。
                console.log('Betting exhausted, runout pending...');
                this.currentPlayerTurn = -1;
                return { runout: true };
            }
            
            // 翻后行动顺序：多人从小盲位起；单挑（2人）由大盲位先行动，庄家/小盲最后行动
            let startPosition = this.activePlayers.length === 2
                ? this.bigBlindPosition
                : this.smallBlindPosition;
            let attempts = 0;
            
            while (attempts < this.activePlayers.length) {
                const player = this.activePlayers[startPosition];
                if (player && player.status === 'in-game') {
                    this.currentPlayerTurn = startPosition;
                    console.log('New round starting, first to act:', player.id);
                    break;
                }
                startPosition = (startPosition + 1) % this.activePlayers.length;
                attempts++;
            }
            
            console.log('New game state:', {
                gameState: this.gameState,
                communityCards: this.communityCards.length,
                currentPlayer: this.activePlayers[this.currentPlayerTurn]?.id
            });
            
            return null;
        }
    }    // 辅助方法：根据 poker-evaluator 的 handType(1-9) 获取中文牌型等级描述。
    // 注意：库的 value 范围仅约 0~37000，旧实现用百万级阈值判断，导致恒返回“高牌”。
    _getHandRank(result) {
        const handType = (result && typeof result === 'object') ? result.handType : result;
        const map = {
            1: '高牌',
            2: '一对',
            3: '两对',
            4: '三条',
            5: '顺子',
            6: '同花',
            7: '葫芦',
            8: '四条',
            9: '同花顺'
        };
        return map[handType] || '高牌';
    }_showdown() {
        const community = (this.communityCards && Array.isArray(this.communityCards)) ? this.communityCards.map(c => c.toString()) : [];
        let playerHands = [];// 计算所有玩家的最佳牌型
        this.activePlayers.forEach(player => {            if (player.status !== 'folded') {
                const hand = (player.hand && Array.isArray(player.hand)) ? player.hand.map(c => c.toString()) : [];
                const allCards = [...community, ...hand];                const result = poker.evalHand(allCards);
                
                console.log(`Player ${player.id} hand evaluation:`, {
                    allCards,
                    resultCards: result.cards,
                    resultCardsLength: result.cards?.length,
                    handName: result.handName
                });
                
                // 更安全的牌型描述处理
                let handDescription = '未知牌型';
                if (result.handName) {
                    handDescription = result.handName;
                } else if (result.handType) {
                    handDescription = result.handType;
                } else if (result.name) {
                    handDescription = result.name;
                }
                  // 获取牌型强度等级（用于排序和比较）
                const handRank = this._getHandRank(result);                // 确保最佳牌组正确：应该是5张牌
                let bestCards = [];
                
                if (result.cards && Array.isArray(result.cards) && result.cards.length === 5) {
                    // 如果评估器返回了正确的5张牌，直接使用
                    bestCards = result.cards;
                    console.log(`Player ${player.id}: Using evaluator's bestCards`);
                } else {
                    // 如果评估器返回的数据不正确，手动计算最佳5张牌
                    console.warn(`Player ${player.id}: result.cards invalid (${result.cards?.length} cards), calculating best 5 from 7`);
                    bestCards = this._findBestFiveCards(allCards);
                }
                
                console.log(`Player ${player.id} bestCards selection:`, {
                    communityLength: community.length,
                    handLength: hand.length,
                    allCardsLength: allCards.length,
                    selectedBestCards: bestCards,
                    bestCardsLength: bestCards.length
                });
                  // 将bestCards字符串数组转换为对象格式，供前端使用
                const bestCardsForFrontend = bestCards.map(cardStr => {
                    // 解析字符串格式的卡牌（如 "Ah", "Kd"）
                    if (cardStr && cardStr.length >= 2) {
                        const rank = cardStr.slice(0, -1).replace('T', '10');
                        const suitChar = cardStr.slice(-1);
                        const suitMap = { 'h': 'Hearts', 'd': 'Diamonds', 'c': 'Clubs', 's': 'Spades' };
                        return {
                            rank: rank,
                            suit: suitMap[suitChar] || 'Spades'
                        };
                    }
                    return { rank: 'A', suit: 'Spades' }; // 默认值
                });

                playerHands.push({ 
                    playerId: player.id, 
                    nickname: player.nickname,
                    result,
                    handDescription,
                    hand: player.hand,
                    handValue: result.value,
                    handRank: handRank,
                    bestCards: bestCardsForFrontend,
                    status: player.status
                });
            } else {
                // 为弃牌玩家也添加基本信息
                playerHands.push({
                    playerId: player.id,
                    nickname: player.nickname,
                    result: null,
                    handDescription: '弃牌',
                    hand: player.hand,
                    handValue: 0,
                    handRank: '弃牌',
                    bestCards: [],
                    status: player.status
                });
            }
        });        // 按牌型强弱排序（只对未弃牌的玩家排序）
        const activePlayerHands = playerHands.filter(ph => ph.status !== 'folded');
        activePlayerHands.sort((a, b) => b.result.value - a.result.value);
        
        // 保持原有的playerHands数组顺序，但添加排名信息
        playerHands.forEach(ph => {
            if (ph.status !== 'folded') {
                const rank = activePlayerHands.findIndex(aph => aph.playerId === ph.playerId) + 1;
                ph.rank = rank;
                ph.isWinner = rank === 1;
            } else {
                ph.rank = null;
                ph.isWinner = false;
            }
        });
        
        // 重置本轮的winnings
        this.activePlayers.forEach(p => p.winnings = 0);

        // 处理主池 - 使用activePlayerHands中的最佳牌型
        const mainPotWinners = activePlayerHands.filter(h => h.result.value === activePlayerHands[0].result.value);
        this._awardPot(this.mainPot, mainPotWinners.map(w => w.playerId));
          // 处理边池
        this.sidePots.forEach(pot => {
            // 找出有资格赢取边池的玩家手牌
            const eligibleHands = activePlayerHands.filter(h => 
                pot.eligiblePlayers.includes(h.playerId)
            );
            
            if (eligibleHands.length > 0) {
                const bestHand = Math.max(...eligibleHands.map(h => h.result.value));
                const potWinners = eligibleHands.filter(h => h.result.value === bestHand);
                this._awardPot(pot.amount, potWinners.map(w => w.playerId));
            }
        });        // 准备要返回给客户端的数据
        const result = {
            winners: this.activePlayers
                .filter(p => p.winnings > 0)
                .map(p => {
                    const handInfo = playerHands.find(h => h.playerId === p.id);
                    return {
                        playerId: p.id,
                        nickname: p.nickname,
                        amount: p.winnings,
                        handDescription: handInfo?.handDescription || "未知牌型",
                        handRank: handInfo?.handRank || "未知",
                        handValue: handInfo?.handValue || 0
                    };
                }),            playersHands: playerHands.map(ph => ({
                ...ph,
                // 确保hand数据格式正确，加入安全检查
                hand: (ph.hand && Array.isArray(ph.hand)) ? ph.hand.map(card => ({
                    suit: card.suit,
                    rank: card.rank,
                    toString: card.toString()
                })) : [],
                // 添加最佳5张牌信息，统一转换为对象格式
                bestCards: (ph.bestCards && Array.isArray(ph.bestCards)) ? ph.bestCards.map(card => ({
                    suit: card.suit,
                    rank: card.rank,
                    toString: card.toString()
                })) : []
            })),            handComparison: {
                // 添加牌型对比信息
                rankedPlayers: activePlayerHands.map((ph, index) => ({
                    rank: index + 1,
                    playerId: ph.playerId,
                    nickname: ph.nickname,
                    handDescription: ph.handDescription,
                    handRank: ph.handRank,
                    handValue: ph.handValue                })),                totalActivePlayers: activePlayerHands.length
            },
            communityCards: (this.communityCards && Array.isArray(this.communityCards)) ? this.communityCards.map(c => c.toString()) : [],
            handResult: true
        };
        
        console.log('Showdown result prepared:', {
            winnersCount: result.winners.length,
            playersHandsCount: result.playersHands.length,
            rankedPlayersCount: result.handComparison.rankedPlayers.length,
            playerHands: result.playersHands.map(ph => ({
                playerId: ph.playerId,
                nickname: ph.nickname,
                handDescription: ph.handDescription,
                rank: ph.rank,
                isWinner: ph.isWinner
            }))
        });
        
        // 清理牌局状态以备下一轮
        this._cleanupAfterHand();
        
        // 返回最终结果
        return result;
    }

    _awardPot(potAmount, winnerIds) {
        if (winnerIds.length === 0 || potAmount === 0) return;
        
        const amountPerWinner = Math.floor(potAmount / winnerIds.length);
        const remainder = potAmount % winnerIds.length;
        
        winnerIds.forEach((id, index) => {
            const winner = this.activePlayers.find(p => p.id === id);
            if (winner) {
                const extra = index === 0 ? remainder : 0;
                const winAmount = amountPerWinner + extra;
                winner.chips += winAmount;
                winner.winnings = (winner.winnings || 0) + winAmount;
            }
        });
    }

    _cleanupAfterHand() {
        console.log('Cleaning up hand...');
        console.log('Final chip counts:', this.activePlayers.map(p => ({
            id: p.id,
            chips: p.chips,
            status: p.status
        })));
        
        this.gameState = 'SHOWDOWN_COMPLETE';
        this.activePlayers.forEach(p => {
            if (p.chips > 0) {
                p.status = 'in-game';
            } else {
                p.status = 'out-of-chips';
            }
            p.currentBet = 0;
            p.totalBetThisHand = 0;
            p.hasActed = false;
            p.hand = [];
            p.winnings = 0;
        });
        
        this.communityCards = [];
        this.mainPot = 0;
        this.sidePots = [];
        this.currentBet = 0;
        this.minRaise = this.bigBlind;
        this.currentPlayerTurn = -1;
        this.lastRaiser = null;

        // 清除本手中途离桌（leftTable）的玩家：他们已不在房间名单中，也不应参与后续手牌
        this.activePlayers = this.activePlayers.filter(p => !p.leftTable);

        console.log('Hand ended, total players:', this.players.length);
        console.log('Players with chips:', this.players.filter(p => p.chips > 0).length);    }

    // 新增方法：准备下一手
    prepareNextHand() {
        if (this.gameState === 'SHOWDOWN_COMPLETE') {
            // 更新活跃玩家列表，只包含有筹码的玩家
            this.activePlayers = this.players.filter(p => p.chips > 0);
            
            console.log('Preparing next hand:', {
                totalPlayers: this.players.length,
                activePlayers: this.activePlayers.length,
                chips: this.activePlayers.map(p => ({ id: p.id, chips: p.chips }))
            });
            
            // 检查是否还有足够玩家继续游戏
            if (this.activePlayers.length < 2) {
                console.log('Game over - not enough players with chips');
                this.gameState = 'GAME_OVER';
                return false;
            }
              // 重置游戏状态并开始新一手
            this._resetHandState();
            this._startNewHand();
            
            console.log('Next hand prepared successfully:', {
                gameState: this.gameState,
                currentPlayerTurn: this.currentPlayerTurn,
                currentPlayerId: this.activePlayers[this.currentPlayerTurn]?.id,
                activePlayers: this.activePlayers.map(p => ({
                    id: p.id,
                    chips: p.chips,
                    status: p.status,
                    hasActed: p.hasActed
                }))
            });
            
            return true;        }
        return false;
    }    // 重置手牌状态
    _resetHandState() {
        this.deck = new Deck();
        this.mainPot = 0;
        this.sidePots = [];
        this.communityCards = [];
        
        console.log(`Resetting hand state - new deck has ${this.deck.cards.length} cards`);
        
        // 重置玩家状态
        this.activePlayers.forEach(p => {
            p.hand = [];
            p.status = 'in-game';
            p.currentBet = 0;
            p.totalBetThisHand = 0;
            p.hasActed = false;
            p.winnings = 0;
            p.isAllIn = false; // 重置all-in状态
            p.leftTable = false;
        });

        this.roundComplete = false;
        this.currentBet = 0;
        this.minRaise = this.bigBlind;
        this.currentPlayerTurn = -1; // 重置当前玩家
        
        console.log('Hand state reset for new hand');
    }

    // 开始新一手
    _startNewHand() {
        this.gameState = 'PREFLOP';

        // 确定位置：以稳定身份轮转庄家钮，再计算盲注位
        this._rotateButton();
        this._assignBlindPositions();

        // 下盲注
        this._postBlind(this.smallBlindPosition, this.smallBlind);
        this._postBlind(this.bigBlindPosition, this.bigBlind);
        this.currentBet = this.bigBlind;
        this.minRaise = this.bigBlind; // 新一手最小加注增量重置为大盲
        // 发手牌
        for (let i = 0; i < 2; i++) {
            for (const player of this.activePlayers) {
                const dealtCard = this.deck.deal();
                player.hand.push(dealtCard);
            }
        }// 设置第一个行动的玩家
        this._setFirstPlayerToAct();
        
        console.log('New hand started with detailed state:', {
            gameState: this.gameState,
            dealerPosition: this.dealerPosition,
            smallBlind: this.smallBlindPosition,
            bigBlind: this.bigBlindPosition,
            currentPlayer: this.currentPlayerTurn,
            currentPlayerId: this.activePlayers[this.currentPlayerTurn]?.id,
            activePlayers: this.activePlayers.length,
            playersStatus: this.activePlayers.map(p => ({
                id: p.id,
                position: this.activePlayers.indexOf(p),
                chips: p.chips,
                currentBet: p.currentBet,
                hasActed: p.hasActed,
                status: p.status
            }))
        });
    }    // 设置第一个行动的玩家
    _setFirstPlayerToAct() {
        if (this.activePlayers.length === 2) {
            // 2人游戏：小盲注（庄家）先行动
            this.currentPlayerTurn = this.smallBlindPosition;
        } else {
            // 多人游戏：大盲注左边的玩家先行动（UTG位置）
            this.currentPlayerTurn = (this.bigBlindPosition + 1) % this.activePlayers.length;
        }
        
        console.log('Set first player to act:', {
            gameState: this.gameState,
            currentPlayerTurn: this.currentPlayerTurn,
            currentPlayerId: this.activePlayers[this.currentPlayerTurn]?.id,
            smallBlindPos: this.smallBlindPosition,
            bigBlindPos: this.bigBlindPosition
        });
    }

    _getGameState() {
        // 在等待状态或结算完成状态时使用所有玩家，游戏中使用活跃玩家
        const playersToShow = (this.gameState === 'WAITING' || this.gameState === 'SHOWDOWN_COMPLETE') 
            ? this.players : this.activePlayers;
        
        console.log(`Game._getGameState() - gameState: ${this.gameState}`);
        console.log(`Total players: ${this.players.length}, Active players: ${this.activePlayers.length}, Showing: ${playersToShow.length}`);
        console.log('Players to show:', playersToShow.map(p => ({ id: p.id, nickname: p.nickname, chips: p.chips, status: p.status })));
        
        // 验证 currentPlayerTurn 的有效性
        let currentPlayerTurnId = null;
        if (this.currentPlayerTurn >= 0 && this.currentPlayerTurn < this.activePlayers.length) {
            const currentPlayer = this.activePlayers[this.currentPlayerTurn];
            if (currentPlayer) {
                currentPlayerTurnId = currentPlayer.id;
                console.log(`Current player turn: index ${this.currentPlayerTurn}, player ${currentPlayer.id} (${currentPlayer.nickname})`);
            } else {
                console.warn(`currentPlayerTurn index ${this.currentPlayerTurn} points to undefined player`);
            }
        } else {
            console.warn(`currentPlayerTurn index ${this.currentPlayerTurn} is out of bounds for activePlayers array (length: ${this.activePlayers.length})`);
        }
        
        return {
            gameState: this.gameState,
            communityCards: this.communityCards,
            currentBet: this.currentBet,
            minRaise: this.minRaise,
            mainPot: this.mainPot,
            sidePots: this.sidePots,
            smallBlind: this.smallBlind,
            bigBlind: this.bigBlind,
            dealerPosition: this.dealerPosition,
            smallBlindPosition: this.smallBlindPosition,
            bigBlindPosition: this.bigBlindPosition,
            currentPlayerTurn: currentPlayerTurnId,
            players: playersToShow.map(p => ({
                id: p.id,
                nickname: p.nickname,
                chips: p.chips,
                status: p.status,
                currentBet: p.currentBet,
                hasActed: p.hasActed
            }))
        };
    }

    addPlayer(player) {
        if (!this.players.includes(player)) {
            this.players.push(player);
        }
    }    removePlayer(playerId) {
        console.log(`Removing player ${playerId}`);

        const handInProgress = this.gameState !== 'WAITING'
            && this.gameState !== 'SHOWDOWN_COMPLETE'
            && this.gameState !== 'GAME_OVER';

        const activeIndex = this.activePlayers.findIndex(p => p.id === playerId);

        // —— 手牌进行中且该玩家仍在本手：不从 activePlayers 中移除，改为“弃权/保留全押”，
        //    其已投入彩池的筹码原地保留，保证筹码守恒与边池计算正确。 ——
        if (handInProgress && activeIndex >= 0) {
            const leaver = this.activePlayers[activeIndex];
            const wasCurrentPlayer = activeIndex === this.currentPlayerTurn;
            const wasContender = leaver.status !== 'folded';

            leaver.leftTable = true; // 手牌结束后再从名单清除
            if (leaver.status === 'in-game') {
                // 尚可行动的玩家离桌 → 视为弃牌（已投入的筹码留在池中）
                leaver.status = 'folded';
                leaver.hasActed = true;
            }
            // 若为 all-in 玩家离桌：保持 all-in，仍以已投入筹码参与摊牌

            // 从房间名单移除（不参与后续手牌），但保留在 activePlayers 直到本手结束
            this.players = this.players.filter(p => p.id !== playerId);

            // 收敛牌局
            let result = null;
            const contenders = this.activePlayers.filter(p => p.status !== 'folded');
            if (contenders.length === 1) {
                // 只剩一名未弃牌玩家 → 直接结算
                result = this._resolveSingleWinner(contenders[0]);
            } else if (wasCurrentPlayer) {
                // 离桌者正是当前行动者：从其槽位推进（_advanceTurn 会跳到下一名可行动玩家，
                // 或在本轮已完成时收尾）
                this.currentPlayerTurn = activeIndex;
                result = this._advanceTurn();
            } else if (wasContender && this._isBettingRoundOver()) {
                // 其弃牌可能使本轮下注提前完成
                result = this._endBettingRound();
            }

            console.log('After mid-hand leave:', {
                leaver: playerId,
                currentPlayerTurn: this.currentPlayerTurn,
                players: this.players.length,
                resultKind: result && result.handResult ? 'handResult'
                    : (result && result.runout ? 'runout' : 'none')
            });

            return { shouldResetGame: false, result };
        }

        // —— 非手牌进行中（或该玩家已不在本手）：从名单与活跃列表真正移除 ——
        let wasCurrentPlayer = false;
        let currentPlayerIndex = -1;
        if (this.currentPlayerTurn >= 0 && this.currentPlayerTurn < this.activePlayers.length) {
            const currentPlayer = this.activePlayers[this.currentPlayerTurn];
            if (currentPlayer && currentPlayer.id === playerId) {
                wasCurrentPlayer = true;
                currentPlayerIndex = this.currentPlayerTurn;
            }
        }

        this.players = this.players.filter(p => p.id !== playerId);
        this.activePlayers = this.activePlayers.filter(p => p.id !== playerId);

        let shouldResetGame = false;
        if (handInProgress && this.players.length < 2) {
            console.log('Insufficient players during game, resetting to WAITING state');
            shouldResetGame = true;
            this._resetToWaiting();
        }

        if (!shouldResetGame) {
            if (wasCurrentPlayer) {
                if (this.activePlayers.length === 0) {
                    this.currentPlayerTurn = -1;
                } else {
                    if (currentPlayerIndex >= this.activePlayers.length) {
                        this.currentPlayerTurn = 0;
                    } else {
                        this.currentPlayerTurn = currentPlayerIndex;
                    }
                    let attempts = 0;
                    while (attempts < this.activePlayers.length &&
                           this.activePlayers[this.currentPlayerTurn]?.status !== 'in-game') {
                        this.currentPlayerTurn = (this.currentPlayerTurn + 1) % this.activePlayers.length;
                        attempts++;
                    }
                    if (attempts >= this.activePlayers.length) {
                        this.currentPlayerTurn = -1;
                    }
                }
            } else if (this.currentPlayerTurn >= this.activePlayers.length) {
                this.currentPlayerTurn = this.activePlayers.length > 0 ? 0 : -1;
            }
        }

        return { shouldResetGame };
    }
    
    // 新增方法：重置游戏到准备阶段
    _resetToWaiting() {
        console.log('Resetting game to WAITING state due to insufficient players');
        this.gameState = 'WAITING';
        this.mainPot = 0;
        this.sidePots = [];
        this.communityCards = [];
        this.currentBet = 0;
        this.lastRaiser = null;
        this.roundComplete = false;
        this.currentPlayerTurn = -1;
        this.activePlayers = [];
        
        // 重置所有玩家状态
        this.players.forEach(player => {
            player.hand = [];
            player.status = 'in-game';
            player.currentBet = 0;
            player.totalBetThisHand = 0;
            player.hasActed = false;
        });
    }

    // 新增：更新玩家ID（用于重连）
    updatePlayerId(oldPlayerId, newPlayerId) {
        console.log(`Updating player ID from ${oldPlayerId} to ${newPlayerId}`);
        console.log('Before update - currentPlayerTurn:', this.currentPlayerTurn);
        console.log('Before update - activePlayers:', this.activePlayers.map(p => ({ id: p.id, nickname: p.nickname })));
        
        // 检查当前轮到的玩家是否是要更新的玩家
        let wasCurrentPlayer = false;
        if (this.currentPlayerTurn >= 0 && this.currentPlayerTurn < this.activePlayers.length) {
            const currentPlayer = this.activePlayers[this.currentPlayerTurn];
            if (currentPlayer && currentPlayer.id === oldPlayerId) {
                wasCurrentPlayer = true;
                console.log('The player being updated is currently the active player');
            }
        }
        
        // 保持庄家钮的稳定身份追踪跨重连有效
        if (this.dealerPlayerId === oldPlayerId) {
            this.dealerPlayerId = newPlayerId;
        }

        // 更新players数组中的玩家ID
        const player = this.players.find(p => p.id === oldPlayerId);
        if (player) {
            player.id = newPlayerId;
            console.log(`Updated player in players array: ${player.nickname} -> ${newPlayerId}`);
        }
        
        // 更新activePlayers数组中的玩家ID
        const activePlayer = this.activePlayers.find(p => p.id === oldPlayerId);
        if (activePlayer) {
            activePlayer.id = newPlayerId;
            console.log(`Updated player in activePlayers array: ${activePlayer.nickname} -> ${newPlayerId}`);
        }
        
        // 验证currentPlayerTurn索引的有效性
        if (this.currentPlayerTurn >= 0) {
            if (this.currentPlayerTurn >= this.activePlayers.length) {
                console.warn(`currentPlayerTurn index ${this.currentPlayerTurn} is out of bounds for activePlayers array (length: ${this.activePlayers.length})`);
                // 重置到第一个可行动的玩家
                this.currentPlayerTurn = this.activePlayers.findIndex(p => p.status === 'in-game');
                if (this.currentPlayerTurn === -1) {
                    this.currentPlayerTurn = 0; // 如果没有找到，默认为0
                }
                console.log(`Reset currentPlayerTurn to: ${this.currentPlayerTurn}`);
            }
        }
        
        console.log('After update - currentPlayerTurn:', this.currentPlayerTurn);
        console.log('After update - activePlayers:', this.activePlayers.map(p => ({ id: p.id, nickname: p.nickname })));
        console.log('Current player after update:', this.activePlayers[this.currentPlayerTurn]?.id);
        
        if (wasCurrentPlayer) {
            console.log(`Successfully updated current player ID from ${oldPlayerId} to ${newPlayerId}`);
        }
        
        console.log(`Player ID update completed from ${oldPlayerId} to ${newPlayerId}`);
    }

    // 从7张牌中找到最佳的5张牌组合
    _findBestFiveCards(allCards) {
        // 如果只有5张或更少的牌，直接返回
        if (allCards.length <= 5) {
            return allCards;
        }

        let bestCards = [];
        let bestValue = -1;
        
        // 生成所有可能的5张牌组合
        const combinations = this._getCombinations(allCards, 5);
        
        for (const combination of combinations) {
            try {
                const evalResult = poker.evalHand(combination);
                if (evalResult.value > bestValue) {
                    bestValue = evalResult.value;
                    bestCards = combination;
                }
            } catch (error) {
                console.warn('Error evaluating combination:', combination, error);
            }
        }
        
        return bestCards.length > 0 ? bestCards : allCards.slice(0, 5);
    }

    // 生成组合的辅助方法（从n个元素中选择k个）
    _getCombinations(arr, k) {
        if (k === 1) return arr.map(x => [x]);
        if (k === arr.length) return [arr];
        
        const combinations = [];
        
        for (let i = 0; i <= arr.length - k; i++) {
            const first = arr[i];
            const rest = arr.slice(i + 1);
            const subCombinations = this._getCombinations(rest, k - 1);
            
            for (const subCombination of subCombinations) {
                combinations.push([first, ...subCombination]);
            }
        }
        
        return combinations;
    }
}

module.exports = { Card, Deck, Player, Game };
