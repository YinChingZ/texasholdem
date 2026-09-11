const crypto = require('node:crypto');
const Training = require('./training');
const { Game, Player } = require('./game');

const PROTOCOL_VERSION = 2;
const BETTING = new Set(['PREFLOP', 'FLOP', 'TURN', 'RIVER']);
const DEFAULTS = { turnMs: 45000, nextHandMs: 8000, runoutMs: 600, hostGraceMs: 30000, probeMs: 3000, idleMs: 1800000 };
const failure = (code, message) => Object.assign(new Error(message), { code });

// Every room mutation is synchronous. Async transport probes only enqueue a new,
// generation-checked binding decision; timers never retain a mutable hand across await.
class RoomService {
  constructor({ clock = { now: () => Date.now(), setTimeout, clearTimeout }, transport, config = {}, deckRandom = Math.random, botRandom = Math.random, log = () => {}, id = () => crypto.randomUUID() } = {}) {
    this.clock = clock;
    this.deckRandom = deckRandom; this.botRandom = botRandom;
    this.transport = transport || { emit() {}, probe: async () => false };
    this.config = { ...DEFAULTS, ...config };
    this.log = log;
    this.id = id;
    this.rooms = new Map();
    this.bindings = new Map();
    this.entryRequests = new Map();
  }

  timer(room, key, delay, callback) {
    this.cancel(room, key);
    const timer = { handle: null };
    room.timers.set(key, timer);
    timer.handle = this.clock.setTimeout(() => {
      if (this.rooms.get(room.id) !== room || room.timers.get(key) !== timer) return;
      room.timers.delete(key);
      try { callback(); this.publish(room); }
      catch (error) { this.fault(room, error); }
    }, Math.max(0, delay));
  }

  cancel(room, key) {
    const timer = room.timers.get(key);
    if (timer) this.clock.clearTimeout(timer.handle);
    room.timers.delete(key);
  }

  cancelHand(room) {
    for (const key of ['turn', 'runout', 'next']) this.cancel(room, key);
    room.turnId = null;
    room.turnDeadline = null;
    room.nextHandAt = null;
  }

  fault(room, error) {
    this.cancelHand(room);
    room.phase = 'ERROR';
    room.pauseReason = '牌局状态异常，请结束本场并重新准备';
    this.log('invariant_failure', { roomId: room.id, code: error.code || 'STATE_ERROR' });
    this.publish(room);
  }

  inHand(room) { return BETTING.has(room.game.gameState); }
  members(room) { return [...room.members.values()]; }
  eligible(room) { return this.members(room).filter(m => m.role === 'player' && !m.departed && (m.socketId || m.control === 'bot') && !m.sittingOut && m.player.chips > 0); }

  addMember(room, socketId, nickname, role) {
    if (typeof nickname !== 'string' || !nickname.trim()) throw failure('INVALID_NAME', '昵称不能为空');
    const playerId = this.id();
    const member = { id: playerId, token: this.id(), nickname: nickname.trim().slice(0, 32), role, control: 'human',
      player: new Player(playerId, nickname.trim().slice(0, 32), room.settings.initialChips), socketId: null,
      generation: 0, sittingOut: false, departed: false, pendingSeat: false, enteredSession: false,
      timeouts: 0, requests: new Map(), joinedAt: room.memberSequence++ };
    room.members.set(member.id, member);
    if (role === 'player') room.game.addPlayer(member.player);
    this.bind(room, member, socketId);
    return member;
  }

  bind(room, member, socketId) {
    const previous = this.bindings.get(socketId);
    if (previous && (previous.roomId !== room.id || previous.playerId !== member.id)) throw failure('ALREADY_JOINED', '请先退出当前房间');
    if (member.socketId === socketId && previous?.generation === member.generation) return;
    if (member.socketId) {
      const oldSocket = member.socketId;
      this.bindings.delete(oldSocket);
      this.transport.emit(oldSocket, 'sessionReplaced', { roomId: room.id, message: '此身份已在其他页面接管' });
    }
    member.generation++;
    member.socketId = socketId;
    member.departed = false;
    if (!room.started) member.sittingOut = false;
    this.bindings.set(socketId, { roomId: room.id, playerId: member.id, generation: member.generation });
    this.cancel(room, 'idle');
    if (room.creator === member.id) this.cancel(room, 'host');
    if (!room.creator) this.electHost(room);
  }

  authorize(socketId, roomId) {
    const room = this.rooms.get(roomId);
    if (!room) throw failure('ROOM_GONE', '房间已失效，请重新创建或加入');
    const binding = this.bindings.get(socketId);
    const member = binding && room.members.get(binding.playerId);
    if (!member || binding.roomId !== roomId || member.socketId !== socketId || binding.generation !== member.generation) throw failure('SESSION_STALE', '连接身份已失效，请恢复会话');
    return { room, member };
  }

  host(room, member) { if (room.creator !== member.id) throw failure('HOST_ONLY', '只有房主可以执行此操作'); }

  async resume(socketId, args = {}) {
    const began = this.clock.now();
    try {
      this.checkProtocol(args);
      const room = this.rooms.get(args.roomId);
      if (!room) throw failure('ROOM_GONE', '房间已失效，请重新创建或加入');
      const member = this.members(room).find(m => m.control !== 'bot' && typeof args.token === 'string' && m.token === args.token);
      if (!member) throw failure('INVALID_TOKEN', '身份凭证已失效，请重新加入');
      const existing = this.bindings.get(socketId);
      if (existing && (existing.roomId !== room.id || existing.playerId !== member.id)) throw failure('ALREADY_JOINED', '请先退出当前房间');
      if (member.socketId && member.socketId !== socketId && !args.takeover) {
        const generation = member.generation, oldSocket = member.socketId;
        const alive = await this.transport.probe(oldSocket, this.config.probeMs);
        if (this.rooms.get(room.id) !== room) throw failure('ROOM_GONE', '房间已失效');
        if (member.socketId && member.socketId !== socketId && (alive || member.generation !== generation)) throw failure('SESSION_IN_USE', '此身份正在其他页面使用');
      }
      // The adapter fences disconnected callers, including probes that finish late.
      if (this.transport.isConnected && !this.transport.isConnected(socketId)) throw failure('DISCONNECTED', '网络已断开');
      this.bind(room, member, socketId);
      this.reconcile(room);
      this.publish(room);
      this.log('resume', { roomId: room.id, outcome: 'ok', elapsedMs: this.clock.now() - began });
      return { ok: true, token: member.token, snapshot: this.snapshot(room, member) };
    } catch (error) {
      this.log('resume', { outcome: error.code || 'ERROR', elapsedMs: this.clock.now() - began });
      return this.errorResponse(error);
    }
  }

  disconnect(socketId) {
    const binding = this.bindings.get(socketId);
    this.bindings.delete(socketId);
    this.entryRequests.delete(socketId);
    if (!binding) return;
    const room = this.rooms.get(binding.roomId), member = room?.members.get(binding.playerId);
    if (!member || member.socketId !== socketId || member.generation !== binding.generation) return;
    member.socketId = null;
    member.sittingOut = true;
    if (room.training) { room.paused = true; this.cancelHand(room); this.checkIdle(room); this.reconcile(room); this.publish(room); return; }
    if (room.creator === member.id) this.timer(room, 'host', this.config.hostGraceMs, () => {
      if (!room.members.get(room.creator)?.socketId) this.electHost(room);
    });
    this.checkIdle(room);
    this.reconcile(room);
    this.publish(room);
  }

  checkIdle(room) {
    if (!this.members(room).some(m => m.socketId)) {
      if (!room.timers.has('idle')) this.timer(room, 'idle', this.config.idleMs, () => this.close(room));
    } else this.cancel(room, 'idle');
  }

  electHost(room) {
    const online = this.members(room).filter(m => m.socketId && !m.departed)
      .sort((a, b) => (a.role === 'player' ? 0 : 1) - (b.role === 'player' ? 0 : 1) || a.joinedAt - b.joinedAt);
    const before = room.creator;
    room.creator = online[0]?.id || null;
    this.cancel(room, 'host');
    if (before !== room.creator) this.log('host_changed', { roomId: room.id, playerId: room.creator });
  }

  checkProtocol(args) {
    if (args.protocolVersion !== PROTOCOL_VERSION) throw failure('PROTOCOL_MISMATCH', '游戏已更新，请刷新页面');
  }

  errorResponse(error) { return { ok: false, code: error.code || 'INVALID_COMMAND', message: error.code ? error.message : '操作无法执行，请同步牌桌后重试' }; }

  remember(cache, key, value) {
    cache.set(key, value);
    if (cache.size > 512) cache.delete(cache.keys().next().value);
  }

  dispatch(socketId, command, args = {}) {
    try {
      this.checkProtocol(args);
      if (typeof args.requestId !== 'string' || !args.requestId || args.requestId.length > 100) throw failure('REQUEST_REQUIRED', '缺少有效请求标识');
      const fingerprint = JSON.stringify({ command, ...args, requestId: undefined, generation: undefined });
      if (command === 'createRoom' || command === 'createTraining' || command === 'joinRoom') {
        let cache = this.entryRequests.get(socketId);
        if (!cache) { cache = new Map(); this.entryRequests.set(socketId, cache); }
        const previous = cache.get(args.requestId);
        if (previous) {
          if (previous.fingerprint !== fingerprint) throw failure('REQUEST_CONFLICT', '请求标识已用于其他操作');
          const { room, member } = this.authorize(socketId, previous.roomId);
          return { ok: true, token: member.token, snapshot: this.snapshot(room, member) };
        }
        if (this.bindings.has(socketId)) throw failure('ALREADY_JOINED', '请先退出当前房间');
        let room, member;
        if (command === 'createRoom' || command === 'createTraining') {
          if (typeof args.nickname !== 'string' || !args.nickname.trim()) throw failure('INVALID_NAME', '昵称不能为空');
          let roomId; do { roomId = this.id().replaceAll('-', '').slice(0, 6); } while (this.rooms.has(roomId));
          room = { id: roomId, members: new Map(), memberSequence: 0, game: new Game([], 5, 10, this.deckRandom), creator: null,
            settings: { initialChips: 1000, showAllHands: true }, sessionId: this.id(), handId: null,
            turnId: null, revision: 0, phase: 'LOBBY', started: false, paused: false, endRequested: false,
            pauseReason: null, lastResult: null, leaderboard: null, timers: new Map() };
          this.rooms.set(roomId, room);
          member = this.addMember(room, socketId, args.nickname, 'player');
          room.creator = member.id;
          if (command === 'createTraining') this.createTraining(room);
        } else {
          room = this.rooms.get(args.roomId);
          if (!room) throw failure('ROOM_GONE', '房间不存在或已失效');
          if (room.training) throw failure('PRIVATE_ROOM', '观察练习为私人牌桌');
          const seated = this.members(room).filter(m => m.role === 'player').length;
          if (!args.asSpectator && seated >= 8) throw failure('ROOM_FULL', '座位已满，可选择旁观');
          const role = args.asSpectator || this.inHand(room) || room.phase === 'ENDED' ? 'spectator' : 'player';
          member = this.addMember(room, socketId, args.nickname, role);
          if (!args.asSpectator && role === 'spectator' && room.phase !== 'ENDED') member.pendingSeat = true;
          if (room.started && role === 'player') member.enteredSession = true;
        }
        this.remember(cache, args.requestId, { fingerprint, roomId: room.id });
        this.reconcile(room);
        this.publish(room);
        return { ok: true, token: member.token, snapshot: this.snapshot(room, member) };
      }
      const receiptCache = this.entryRequests.get(socketId);
      const receipt = receiptCache?.get(`receipt:${args.requestId}`);
      if (receipt) {
        if (receipt.fingerprint !== fingerprint) throw failure('REQUEST_CONFLICT', '请求标识已用于其他操作');
        return receipt.response;
      }
      if (command === 'commandStatus') {
        const terminal = receiptCache?.get(`receipt:${args.commandRequestId}`);
        if (terminal) return { ok: true, commandResult: terminal.response };
      }
      const { room, member } = this.authorize(socketId, args.roomId);
      const cached = member.requests.get(args.requestId);
      if (cached) {
        if (cached.fingerprint !== fingerprint) throw failure('REQUEST_CONFLICT', '请求标识已用于其他操作');
        return { ...cached.response, snapshot: this.snapshot(room, member) };
      }
      if (args.generation !== member.generation) throw failure('SESSION_STALE', '连接已被替换，请恢复会话');
      let response;
      if (command === 'syncSession') response = { ok: true, token: member.token };
      else if (command === 'commandStatus') response = { ok: true, commandResult: member.requests.get(args.commandRequestId)?.response || null };
      else response = this.mutate(room, member, command, args) || { ok: true };
      this.remember(member.requests, args.requestId, { fingerprint, response });
      if (response.left || response.closed) {
        let receipts = this.entryRequests.get(socketId);
        if (!receipts) { receipts = new Map(); this.entryRequests.set(socketId, receipts); }
        this.remember(receipts, `receipt:${args.requestId}`, { fingerprint, response });
      }
      if (this.rooms.has(room.id)) { this.reconcile(room); this.publish(room); }
      return { ...response, ...(this.rooms.has(room.id) && !member.departed ? { snapshot: this.snapshot(room, member) } : {}) };
    } catch (error) {
      this.log('command_rejected', { command, code: error.code || 'INVALID_COMMAND' });
      return this.errorResponse(error);
    }
  }

  mutate(room, member, command, args) {
    if (room.training) { const response = this.trainingCommand(room, member, command, args); if (response) return response; }
    switch (command) {
      case 'startGame':
        this.host(room, member);
        if (room.started) throw failure('ALREADY_STARTED', '场次已经开始');
        if (this.eligible(room).length < 2) throw failure('NEED_PLAYERS', '至少需要两名在线且有筹码的玩家');
        room.started = true;
        this.members(room).filter(m => m.role === 'player').forEach(m => { m.enteredSession = true; });
        this.startHand(room);
        break;
      case 'playerAction':
        if (args.handId !== room.handId || args.turnId !== room.turnId || !room.turnId) throw failure('STALE_TURN', '行动已过期，请查看当前牌桌');
        if (!['check', 'call', 'fold', 'raise', 'bet'].includes(args.action)) throw failure('INVALID_ACTION', '无效的行动');
        { this.executeAction(room, member.id, args.action, args.betAmount); member.timeouts = 0; }
        break;
      case 'pauseGame':
        this.host(room, member); room.paused = true;
        break;
      case 'resumeGame':
        this.host(room, member); room.paused = false;
        break;
      case 'prepareNextHand':
        this.host(room, member);
        if (this.inHand(room) || !room.started || room.phase === 'ENDED') throw failure('INVALID_PHASE', '当前不能开始下一手');
        if (this.eligible(room).length < 2) throw failure('NEED_PLAYERS', '等待至少两名可参赛玩家');
        room.paused = false;
        this.startHand(room);
        break;
      case 'endGame':
        this.host(room, member);
        if (!room.started) throw failure('INVALID_PHASE', '场次尚未开始');
        room.endRequested = true;
        if (!this.inHand(room)) this.finish(room);
        break;
      case 'resetGame':
        this.host(room, member);
        if (this.inHand(room) && room.phase !== 'ERROR') throw failure('HAND_RUNNING', '请先结束本手');
        this.reset(room);
        break;
      case 'closeRoom':
        this.host(room, member); this.close(room); return { ok: true, closed: true };
      case 'switchToPlayer':
        if (room.phase === 'ENDED') throw failure('SESSION_ENDED', '请等待新场次');
        if (member.enteredSession && member.player.chips === 0) throw failure('ELIMINATED', '本场筹码已耗尽，请等待新场次');
        if (member.role !== 'player') member.pendingSeat = true;
        member.sittingOut = false;
        break;
      case 'returnToTable':
        if (member.role !== 'player') throw failure('NOT_SEATED', '请先申请入座');
        if (member.player.chips <= 0 || room.phase === 'ENDED') throw failure('ELIMINATED', '请等待新场次');
        member.sittingOut = false; member.timeouts = 0;
        break;
      case 'switchToSpectator':
        if (this.inHand(room)) throw failure('HAND_RUNNING', '请在手间离座');
        this.unseat(room, member); break;
      case 'releaseSeat': {
        this.host(room, member);
        if (this.inHand(room)) throw failure('HAND_RUNNING', '请在手间释放座位');
        const target = room.members.get(args.playerId);
        if (!target || target.socketId || target.role !== 'player') throw failure('INVALID_PLAYER', '只能释放离线玩家座位');
        this.unseat(room, target); break;
      }
      case 'leaveRoom': {
        member.departed = true; member.pendingSeat = false; member.sittingOut = true;
        this.bindings.delete(member.socketId); member.socketId = null;
        const beforeActor = room.game.activePlayers[room.game.currentPlayerTurn]?.id;
        const beforeStreet = room.game.gameState;
        const removal = member.role === 'player' ? room.game.removePlayer(member.id) : {};
        member.role = 'spectator';
        if (removal.result) this.advance(room, removal.result);
        else if (this.inHand(room)) {
          if (beforeActor !== room.game.activePlayers[room.game.currentPlayerTurn]?.id || beforeStreet !== room.game.gameState) this.advance(room, null);
          else this.ensureTurn(room);
        }
        if (room.creator === member.id) this.electHost(room);
        this.checkIdle(room);
        return { ok: true, left: true };
      }
      case 'updateRoomSettings':
        this.host(room, member);
        if (typeof args.settings?.showAllHands !== 'boolean') throw failure('INVALID_SETTINGS', '设置无效');
        room.settings.showAllHands = args.settings.showAllHands;
        break;
      case 'updateInitialChips':
        this.host(room, member);
        if (room.started) throw failure('SESSION_RUNNING', '只能在准备阶段修改初始筹码');
        if (!Number.isInteger(args.initialChips) || args.initialChips < 500 || args.initialChips > 50000) throw failure('INVALID_CHIPS', '初始筹码必须为 500 至 50000 的整数');
        room.settings.initialChips = args.initialChips;
        this.members(room).forEach(m => { m.player.chips = args.initialChips; });
        break;
      case 'sendMessage': {
        if (typeof args.message !== 'string' || !args.message.trim()) throw failure('EMPTY_MESSAGE', '消息不能为空');
        if (member.lastMessageAt != null && this.clock.now() - member.lastMessageAt < 400) throw failure('RATE_LIMIT', '发送过于频繁');
        member.lastMessageAt = this.clock.now();
        this.members(room).filter(m => m.socketId).forEach(m => this.transport.emit(m.socketId, 'newMessage', { sender: member.nickname, message: args.message.trim().slice(0, 500), isSpectator: member.role === 'spectator' }));
        break;
      }
      default: throw failure('UNKNOWN_COMMAND', '未知操作');
    }
    return { ok: true };
  }

  unseat(room, member) {
    room.game.removePlayer(member.id);
    member.role = 'spectator'; member.sittingOut = true; member.pendingSeat = false;
  }

  processSeats(room) {
    if (this.inHand(room) || room.phase === 'ENDED') return;
    for (const member of this.members(room)) {
      if (!member.pendingSeat || !member.socketId || member.departed) continue;
      if (this.members(room).filter(m => m.role === 'player').length >= 8) break;
      if (member.enteredSession && member.player.chips === 0) { member.pendingSeat = false; continue; }
      member.role = 'player'; member.pendingSeat = false; member.sittingOut = false;
      if (room.started) member.enteredSession = true;
      room.game.addPlayer(member.player);
    }
  }

  startHand(room) {
    if (room.training) this.trainingStart(room);
    this.processSeats(room);
    const eligible = this.eligible(room);
    if (eligible.length < 2) return;
    this.cancelHand(room);
    room.handId = this.id();
    room.phase = 'BETTING'; room.pauseReason = null;
    eligible.forEach(m => { m.enteredSession = true; });
    const result = room.game.startGame(eligible.map(m => m.id));
    if (room.training) this.trainingDealt(room);
    this.advance(room, result);
  }

  advance(room, result) {
    this.cancel(room, 'turn'); room.turnId = null; room.turnDeadline = null;
    if (room.training) {
      this.trainingAdvance(room, result);
      if (result?.handResult) room.lastResult = { ...result, handId: room.handId };
      this.reconcileTraining(room); return;
    }
    if (result?.handResult) {
      this.cancel(room, 'runout');
      if (room.lastResult?.handId !== room.handId) {
        room.lastResult = { ...result, handId: room.handId };
        this.log('hand_settled', { roomId: room.id, handId: room.handId });
      }
      room.phase = 'INTERMISSION';
      const remaining = this.members(room).filter(m => m.enteredSession && !m.departed && m.player.chips > 0);
      const participants = this.members(room).filter(m => m.enteredSession && !m.departed);
      if (room.endRequested || (remaining.length === 1 && participants.length > 1 && participants.some(m => m.player.chips === 0))) this.finish(room);
    } else if (result?.runout) {
      room.phase = 'RUNOUT';
      const handId = room.handId;
      this.timer(room, 'runout', this.config.runoutMs, () => {
        if (room.handId !== handId || room.phase !== 'RUNOUT') return;
        this.advance(room, room.game.advanceRunoutStreet());
        this.reconcile(room);
      });
    } else this.ensureTurn(room);
    this.reconcile(room);
  }

  ensureTurn(room) {
    if (!this.inHand(room) || room.phase === 'RUNOUT') return;
    const actor = room.game.activePlayers[room.game.currentPlayerTurn];
    if (!actor || actor.status !== 'in-game') throw failure('NO_ACTOR', '下注阶段缺少合法行动者');
    if (room.turnId && room.timers.has('turn')) return;
    room.phase = 'BETTING'; room.turnId = this.id(); room.turnDeadline = this.clock.now() + this.config.turnMs;
    const handId = room.handId, turnId = room.turnId;
    this.timer(room, 'turn', this.config.turnMs, () => {
      if (room.handId !== handId || room.turnId !== turnId) return;
      const action = actor.currentBet >= room.game.currentBet ? 'check' : 'fold';
      const result = room.game.playerAction(actor.id, action);
      const member = room.members.get(actor.id);
      if (member) { member.timeouts++; if (member.timeouts >= 2) member.sittingOut = true; }
      this.log('turn_timeout', { roomId: room.id, handId, action });
      this.advance(room, result);
    });
  }

  reconcile(room) {
    if (!this.rooms.has(room.id) || room.phase === 'ENDED' || room.phase === 'ERROR') return;
    if (room.training) { this.reconcileTraining(room); return; }
    this.processSeats(room);
    if (!room.started) { room.phase = 'LOBBY'; return; }
    if (this.inHand(room)) { if (room.phase !== 'RUNOUT') this.ensureTurn(room); return; }
    if (room.endRequested) { this.finish(room); return; }
    const reason = room.paused ? '房主已暂停续局' : this.eligible(room).length < 2 ? '等待至少两名在线且有筹码的玩家回到牌桌' : null;
    if (reason) {
      this.cancel(room, 'next'); room.nextHandAt = null;
      room.phase = room.paused ? 'PAUSED' : 'WAITING_PLAYERS'; room.pauseReason = reason;
      return;
    }
    room.phase = 'INTERMISSION'; room.pauseReason = null;
    if (!room.timers.has('next')) {
      room.nextHandAt = this.clock.now() + this.config.nextHandMs;
      const handId = room.handId, sessionId = room.sessionId;
      this.timer(room, 'next', this.config.nextHandMs, () => {
        room.nextHandAt = null;
        if (room.sessionId !== sessionId || room.handId !== handId) return;
        if (!room.paused && this.eligible(room).length >= 2) this.startHand(room);
        else this.reconcile(room);
      });
    }
  }

  finish(room) {
    if (room.training) room.training.report = Training.report(room, this.clock.now());
    this.cancelHand(room); room.game.finishSession(); room.phase = 'ENDED'; room.pauseReason = null;
    room.leaderboard = this.members(room).filter(m => m.enteredSession).map(m => ({ id: m.id, nickname: m.nickname, chips: m.player.chips })).sort((a, b) => b.chips - a.chips);
  }

  reset(room) {
    this.cancelHand(room);
    room.sessionId = this.id(); room.handId = null; room.lastResult = null; room.leaderboard = null;
    room.started = false; room.paused = false; room.endRequested = false; room.pauseReason = null; room.phase = 'LOBBY';
    this.members(room).forEach(m => {
      m.player.chips = room.settings.initialChips; m.player.hand = []; m.player.status = 'in-game';
      m.enteredSession = false; m.timeouts = 0; m.sittingOut = !m.socketId;
    });
    room.game.resetSession(room.settings.initialChips);
    this.processSeats(room);
  }

  close(room) {
    for (const key of [...room.timers.keys()]) this.cancel(room, key);
    this.members(room).forEach(m => {
      if (m.socketId) { this.bindings.delete(m.socketId); this.transport.emit(m.socketId, 'roomClosed', { roomId: room.id, message: '房间已关闭' }); }
    });
    this.rooms.delete(room.id);
  }

  resultFor(room) {
    if (!room.lastResult) return null;
    const result = room.lastResult;
    if (room.training) { const shown = result.playersHands.filter(p => p.status !== 'folded'); return { ...result, handComparison: null, showAllHands: false, playersHands: shown.length > 1 ? shown : [] }; }
    if (room.settings.showAllHands) return { ...result, showAllHands: true };
    const winners = new Set(result.winners.map(w => w.playerId));
    return { ...result, showAllHands: false, handComparison: null, playersHands: result.playersHands.filter(p => winners.has(p.playerId)) };
  }

  snapshot(room, member) {
    const state = room.game._getGameState();
    const inHand = this.inHand(room);
    const players = inHand || room.training ? state.players : this.members(room).filter(m => m.role === 'player' && !m.departed).map(m => ({ id: m.id, nickname: m.nickname, chips: m.player.chips, status: m.player.chips ? 'in-game' : 'out-of-chips', currentBet: 0 }));
    const publicMembers = this.members(room).filter(m => !m.departed).map(m => ({ id: m.id, nickname: m.nickname, role: m.role, connected: m.control === 'bot' || !!m.socketId, sittingOut: m.sittingOut, pendingSeat: m.pendingSeat, chips: m.player.chips }));
    const isHost = room.creator === member.id;
    return { ...state, mode: room.mode || 'multiplayer', ...(room.training ? { training: { completed: room.training.hands.length, target: 20, coach: this.coachingFor(room), pendingPrompt: room.training.pendingPrompt, notes: room.training.notes, fast: room.training.fast, history: [...room.training.hands, ...(room.training.current && !room.training.hands.includes(room.training.current) ? [room.training.current] : [])].map(h => ({ number: h.number, events: h.events.filter(e => ['blind', 'action', 'board'].includes(e.type)) })) } } : {}), protocolVersion: PROTOCOL_VERSION, roomId: room.id, sessionId: room.sessionId, handId: room.handId,
      revision: room.revision, serverNow: this.clock.now(), phase: room.phase, creator: room.creator, settings: { ...room.settings },
      players: players.map(p => { const m = room.members.get(p.id); return { ...p, connected: m?.control === 'bot' || !!m?.socketId, sittingOut: !!m?.sittingOut }; }),
      members: publicMembers, spectators: Object.fromEntries(publicMembers.filter(m => m.role === 'spectator').map(m => [m.id, m])),
      turnId: room.turnId, turnDeadline: room.turnDeadline, nextHandAt: room.nextHandAt, paused: room.paused,
      pauseReason: room.pauseReason, endRequested: room.endRequested, lastResult: this.resultFor(room), leaderboard: room.leaderboard,
      self: { playerId: member.id, generation: member.generation, role: member.role, sittingOut: member.sittingOut, pendingSeat: member.pendingSeat },
      privateCards: inHand && room.game.activePlayers.includes(member.player) ? member.player.hand.map(c => ({ suit: c.suit, rank: c.rank })) : [],
      allowedActions: {
        start: isHost && !room.started && this.eligible(room).length >= 2,
        pause: isHost && room.started && !room.paused && room.phase !== 'ENDED',
        resume: isHost && room.paused && room.phase !== 'ENDED',
        nextHand: !room.training && isHost && room.started && !inHand && room.phase !== 'ENDED' && this.eligible(room).length >= 2,
        reset: !room.training && isHost && (!inHand || room.phase === 'ERROR'), end: isHost && room.started && room.phase !== 'ENDED', close: isHost,
        returnToTable: member.role === 'player' && member.sittingOut && member.player.chips > 0 && room.phase !== 'ENDED',
        requestSeat: member.role === 'spectator' && !member.pendingSeat && room.phase !== 'ENDED' && (!member.enteredSession || member.player.chips > 0),
        releaseSeat: isHost && !inHand,
      } };
  }

  publish(room) {
    if (this.rooms.get(room.id) !== room) return;
    const actor = room.game.activePlayers[room.game.currentPlayerTurn];
    const trainingInvalid = room.training && ((room.phase === 'BETTING' && (!room.turnId || actor?.status !== 'in-game' || (room.members.get(actor.id)?.control === 'bot' && !room.timers.has('turn')))) || (room.phase === 'RUNOUT' && !room.timers.has('runout')) || (room.phase === 'INTERMISSION' && !room.timers.has('next')));
    if (trainingInvalid || (!room.training && ((room.phase === 'BETTING' && (!room.turnId || !room.timers.has('turn') || actor?.status !== 'in-game'))
      || (room.phase === 'RUNOUT' && !room.timers.has('runout'))
      || (room.phase === 'INTERMISSION' && !room.timers.has('next'))))) {
      this.fault(room, failure('NO_PROGRESS_PATH', '状态缺少推进路径'));
      return;
    }
    room.revision++;
    for (const member of this.members(room)) if (member.socketId) this.transport.emit(member.socketId, 'roomSnapshot', this.snapshot(room, member));
  }

  dispose() { for (const room of this.rooms.values()) for (const key of [...room.timers.keys()]) this.cancel(room, key); }
}
Object.assign(RoomService.prototype, require('./training-service'));
module.exports = { RoomService, PROTOCOL_VERSION, DEFAULTS };
