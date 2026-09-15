const crypto = require('node:crypto');
const fail = (code, message) => Object.assign(new Error(message), { code });
const digest = token => crypto.createHash('sha256').update(token).digest('hex');
const ACTIVE_MS = 90000;
const GRANT_MS = 24 * 60 * 60 * 1000;

module.exports = {
  agentActive(member) { return !!member?.agent?.connected && member.agent.expiresAt > this.clock.now() && member.agent.activeUntil > this.clock.now(); },
  online(member) { return !!member && !member.departed && (member.control === 'bot' || !!member.socketId || this.agentActive(member)); },
  agentState(member) {
    const a = member.agent;
    return a ? { status: a.connected ? 'controlled' : 'pending', online: this.agentActive(member), lastSeenAt: a.lastSeenAt, expiresAt: a.expiresAt } : { status: 'none', online: false, lastSeenAt: null };
  },
  setAgentEnabled(enabled) {
    this.config.agentEnabled = enabled === true;
    for (const room of this.rooms.values()) {
      if (!enabled) this.members(room).forEach(m => this.revokeAgent(room, m, 'disabled'));
      this.checkIdle(room); this.reconcile(room); this.publish(room);
    }
  },
  revokeAgent(room, member, reason) {
    if (!member.agent) return;
    const a = member.agent;
    this.agentGrants.delete(a.hash);
    this.cancel(room, `agent-expiry:${member.id}`); this.cancel(room, `agent-active:${member.id}`);
    member.agent = null; member.controlVersion = (member.controlVersion || 0) + 1;
    if (!member.socketId) member.sittingOut = true;
    this.log('agent_revoked', { roomId: room.id, playerId: member.id, reason });
    for (const listener of [...this.agentListeners]) listener();
  },
  agentBrowserCommand(room, member, command) {
    if (room.training || member.role !== 'player' || member.departed) throw fail('NOT_SEATED', '仅普通房间的在座玩家可使用托管');
    if (command === 'reclaimControl') {
      this.revokeAgent(room, member, 'reclaimed'); this.checkIdle(room);
      return { ok: true };
    }
    if (!this.config.agentEnabled) throw fail('AGENT_DISABLED', 'Agent 托管尚未开放');
    if (['ENDED', 'ERROR'].includes(room.phase)) throw fail('INVALID_PHASE', '请等待新场次');
    this.revokeAgent(room, member, 'replaced');
    const token = crypto.randomBytes(32).toString('base64url');
    const a = { hash: digest(token), connected: false, lastSeenAt: null, activeUntil: 0,
      expiresAt: this.clock.now() + GRANT_MS, requests: new Map(), rateStart: this.clock.now(), rateCount: 0 };
    member.agent = a; this.agentGrants.set(a.hash, { room, member });
    this.timer(room, `agent-expiry:${member.id}`, GRANT_MS, () => {
      this.revokeAgent(room, member, 'expired'); this.checkIdle(room); this.reconcile(room);
    });
    this.log('agent_granted', { roomId: room.id, playerId: member.id });
    return { ok: true, agentToken: token };
  },
  authorizeAgent(token, { connected = true, rate = true } = {}) {
    if (!this.config.agentEnabled) throw fail('AGENT_DISABLED', 'Agent 托管已停用');
    if (typeof token !== 'string' || token.length > 128) throw fail('INVALID_GRANT', '授权已失效');
    const binding = this.agentGrants.get(digest(token));
    if (!binding) throw fail('INVALID_GRANT', '授权已失效或房间已关闭');
    const { room, member } = binding, a = member.agent;
    if (!this.rooms.has(room.id)) throw fail('ROOM_GONE', '房间已关闭');
    if (!a || a.expiresAt <= this.clock.now()) {
      this.revokeAgent(room, member, 'expired'); this.checkIdle(room); this.reconcile(room); this.publish(room);
      throw fail('INVALID_GRANT', '授权已过期');
    }
    if (connected && !a.connected) throw fail('NOT_CONNECTED', '请先连接 Agent');
    if (rate) {
      if (this.clock.now() - a.rateStart >= 60000) { a.rateStart = this.clock.now(); a.rateCount = 0; }
      if (++a.rateCount > 120) throw fail('RATE_LIMIT', '请求过于频繁，请稍后重试');
    }
    return { room, member, grant: a };
  },
  touchAgent(room, member) {
    const wasOnline = this.agentActive(member), a = member.agent;
    a.lastSeenAt = this.clock.now(); a.activeUntil = a.lastSeenAt + ACTIVE_MS;
    this.timer(room, `agent-active:${member.id}`, ACTIVE_MS, () => { this.checkIdle(room); this.reconcile(room); });
    this.checkIdle(room);
    if (!wasOnline) { this.reconcile(room); this.publish(room); }
  },
  agentObservation(room, member) {
    // Explicit projection: never expose browser identity, credentials, or room administration permissions.
    const s = this.snapshot(room, member);
    return { apiVersion: 1, roomId: s.roomId, sessionId: s.sessionId, handId: s.handId, turnId: s.turnId,
      revision: s.revision, serverNow: s.serverNow, phase: s.phase, street: s.gameState,
      turnDeadline: s.turnDeadline, nextHandAt: s.nextHandAt, currentPlayerTurn: s.currentPlayerTurn,
      self: { playerId: member.id, controlVersion: member.controlVersion, sittingOut: member.sittingOut, role: member.role, agent: this.agentState(member) },
      privateCards: s.privateCards, communityCards: s.communityCards, players: s.players,
      mainPot: s.mainPot, sidePots: s.sidePots, currentBet: s.currentBet,
      smallBlind: s.smallBlind, bigBlind: s.bigBlind, dealerPosition: s.dealerPosition,
      smallBlindPosition: s.smallBlindPosition, bigBlindPosition: s.bigBlindPosition,
      legalActions: s.legalActions, history: structuredClone(s.publicHistory), lastResult: s.lastResult,
      pauseReason: s.pauseReason };
  },
  normalizeAction(room, member, action, amount) {
    const legal = room.phase === 'BETTING' && room.game.legalActions(member.id);
    if (!legal) throw fail('INVALID_ACTION', '当前不可行动');
    if (action === 'raise_to') {
      if (!Number.isSafeInteger(amount) || !legal.raise_to || amount < legal.minRaiseTo || amount > legal.maxRaiseTo) throw fail('INVALID_ACTION', '加注目标不在合法范围');
      return { action: 'raise', amount: amount - room.game.currentBet };
    }
    if (action === 'all_in') {
      if (!legal.all_in) throw fail('INVALID_ACTION', '当前不能全押');
      return member.player.chips <= room.game.currentBet - member.player.currentBet
        ? { action: 'call', amount: 0 } : { action: 'raise', amount: legal.maxRaiseTo - room.game.currentBet };
    }
    if (['check', 'call', 'fold'].includes(action) && !legal[action]) throw fail('INVALID_ACTION', '当前不允许此行动');
    return { action, amount };
  },
  publicAction(room, id, action, amount) {
    if (room.training) return null;
    const p = room.members.get(id).player;
    const invested = ['check', 'fold'].includes(action) ? 0 : Math.min(p.chips, Math.max(0, room.game.currentBet - p.currentBet) + (['raise', 'bet'].includes(action) ? room.game.constructor._sanitizeAmount(amount) : 0));
    return { type: 'action', playerId: id, street: room.game.gameState, action, invested, to: p.currentBet + invested };
  },
  recordPublicAction(room, id, action, amount) {
    const event = this.publicAction(room, id, action, amount);
    if (event) (room.publicHistory ||= []).push(event);
  },
  agentCommand(token, command, args = {}) {
    const began = this.clock.now();
    try {
      const { room, member, grant } = this.authorizeAgent(token, { connected: command !== 'connect' });
      if (command === 'connect' && !grant.connected) {
        grant.connected = true; member.controlVersion++;
        this.log('agent_connected', { roomId: room.id, playerId: member.id });
      }
      this.touchAgent(room, member);
      if (command === 'release') {
        this.revokeAgent(room, member, 'released'); this.checkIdle(room); this.reconcile(room); this.publish(room);
        return { ok: true };
      }
      if (command === 'action') {
        const { requestId, handId, turnId, controlVersion, action, amount } = args;
        if (typeof requestId !== 'string' || !requestId.length || requestId.length > 100) throw fail('REQUEST_REQUIRED', '需要请求标识');
        if (controlVersion !== member.controlVersion) throw fail('CONTROL_LOST', '控制权已变化');
        const fingerprint = JSON.stringify({ handId, turnId, controlVersion, action, amount });
        const cached = grant.requests.get(requestId);
        if (cached) {
          if (cached.fingerprint !== fingerprint) throw fail('REQUEST_CONFLICT', '请求标识已用于其他行动');
          return { ok: true, receipt: cached.receipt, observation: this.agentObservation(room, member) };
        }
        if (handId !== room.handId || turnId !== room.turnId || !room.turnId || this.clock.now() >= room.turnDeadline) throw fail('STALE_TURN', '行动已过期');
        if (member.sittingOut) throw fail('SITTING_OUT', '请玩家在网页恢复入桌');
        if (!['check', 'call', 'fold', 'raise_to', 'all_in'].includes(action)) throw fail('INVALID_ACTION', '无效行动');
        const normalized = this.normalizeAction(room, member, action, amount);
        this.executeAction(room, member.id, normalized.action, normalized.amount); member.timeouts = 0;
        const receipt = { requestId, handId, turnId, action, ...(amount == null ? {} : { amount }), executed: true };
        this.remember(grant.requests, requestId, { fingerprint, receipt });
        this.reconcile(room); this.publish(room);
        // Settlement may end the session and revoke the grant; return only the action receipt then.
        return { ok: true, receipt, ...(member.agent === grant ? { observation: this.agentObservation(room, member) } : {}) };
      }
      if (!['connect', 'observation', 'heartbeat', 'status'].includes(command)) throw fail('UNKNOWN_COMMAND', '未知操作');
      if (command === 'heartbeat') { this.publish(room); return { ok: true, serverNow: this.clock.now() }; }
      return { ok: true, ...(command === 'status' ? { receipt: grant.requests.get(args.requestId)?.receipt || null } : {}), observation: this.agentObservation(room, member) };
    } catch (error) {
      this.log('agent_rejected', { command, code: error.code || 'INVALID_ACTION' });
      return this.errorResponse(error);
    } finally { this.log('agent_request', { command, elapsedMs: this.clock.now() - began }); }
  },
  waitAgent(token, revision, signal) {
    let binding;
    try {
      binding = this.authorizeAgent(token);
      if (!Number.isSafeInteger(revision) || revision < 0) throw fail('INVALID_REQUEST', 'revision 必须为非负整数');
      if (binding.grant.waiting) throw fail('WAIT_IN_PROGRESS', '已有等待请求');
      this.touchAgent(binding.room, binding.member);
    } catch (error) { return Promise.resolve(this.errorResponse(error)); }
    return new Promise(resolve => {
      let timer, done = false;
      const finish = result => {
        if (done) return; done = true;
        this.clock.clearTimeout(timer); this.agentListeners.delete(check); signal?.removeEventListener('abort', abort);
        binding.grant.waiting = false; resolve(result);
      };
      const check = (force = false) => {
        try {
          const { room, member } = this.authorizeAgent(token, { rate: false });
          if (force || room.revision > revision || room.game.legalActions(member.id) || member.sittingOut || ['ENDED', 'ERROR'].includes(room.phase))
            finish({ ok: true, observation: this.agentObservation(room, member) });
        } catch (error) { finish(this.errorResponse(error)); }
      };
      const abort = () => finish({ ok: false, code: 'CANCELLED', message: '等待已取消' });
      binding.grant.waiting = true; this.agentListeners.add(check);
      timer = this.clock.setTimeout(() => check(true), 25000);
      signal?.addEventListener('abort', abort, { once: true });
      if (signal?.aborted) abort(); else check();
    });
  },
};
