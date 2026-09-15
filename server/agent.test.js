const { test } = require('node:test');
const assert = require('node:assert/strict');
const { RoomService } = require('./room-service');
const { Game, Player } = require('./game');

class Clock {
  nowValue = 1000; tasks = new Map(); serial = 0;
  now = () => this.nowValue;
  setTimeout = (fn, ms) => { const id = ++this.serial; this.tasks.set(id, { fn, at: this.nowValue + ms }); return id; };
  clearTimeout = id => this.tasks.delete(id);
  tick(ms) {
    const end = this.nowValue + ms;
    for (let i = 0; i < 2000; i++) {
      const next = [...this.tasks].filter(([, t]) => t.at <= end).sort((a, b) => a[1].at - b[1].at)[0];
      if (!next) { this.nowValue = end; return; }
      this.nowValue = next[1].at; this.tasks.delete(next[0]); next[1].fn();
    }
    throw new Error('timer loop');
  }
}
function setup(config = {}) {
  const clock = new Clock(), logs = [], events = [];
  const service = new RoomService({ clock, config: { agentEnabled: true, ...config }, log: (...a) => logs.push(a), transport: { emit: (...a) => events.push(a), probe: async () => false } });
  let seq = 0;
  const raw = (socket, command, args = {}) => service.dispatch(socket, command, { protocolVersion: 2, requestId: `r${++seq}`, ...args });
  const initial = raw('a', 'createRoom', { nickname: 'A' });
  const room = service.rooms.get(initial.snapshot.roomId);
  raw('b', 'joinRoom', { roomId: room.id, nickname: 'B' });
  const members = service.members(room);
  const cmd = (i, command, args = {}) => raw(members[i].socketId, command, { roomId: room.id, generation: members[i].generation, controlVersion: members[i].controlVersion, ...args });
  const grant = i => { const r = cmd(i, 'createAgentGrant'); assert(r.ok, JSON.stringify(r)); return r.agentToken; };
  const action = (token, action = 'fold', extra = {}) => {
    const o = service.agentCommand(token, 'observation').observation;
    return { requestId: `a${++seq}`, handId: o.handId, turnId: o.turnId, controlVersion: o.self.controlVersion, action, ...extra };
  };
  return { service, clock, room, members, cmd, raw, grant, action, logs, events };
}

test('grant is seat-scoped, hashed, one-time displayed, and never gives browser token', () => {
  const h = setup(); const token = h.grant(0);
  assert.equal(h.members[0].agent.status, undefined);
  assert(!JSON.stringify([...h.service.agentGrants.values()]).includes(token));
  const r = h.service.agentCommand(token, 'connect'); assert(r.ok);
  assert.equal(r.observation.self.playerId, h.members[0].id);
  assert.equal(r.observation.self.generation, undefined);
  assert.equal(r.observation.allowedActions, undefined);
  assert(!JSON.stringify(r).includes(h.members[0].token));
  assert(!JSON.stringify([...h.members[0].requests.values()]).includes(token));
  assert(!JSON.stringify(h.logs).includes(token));
  const browser = h.service.snapshot(h.room, h.members[1]);
  assert.equal(browser.players[0].agentControlled, true);
  assert.equal(browser.members[0].agent, undefined);
  h.service.dispose();
});

test('browser and agent private cards agree, other hole cards absent before showdown', () => {
  const h = setup(); const token = h.grant(0); h.service.agentCommand(token, 'connect'); h.cmd(0, 'startGame');
  const o = h.service.agentCommand(token, 'observation').observation;
  assert.equal(o.privateCards.length, 2);
  assert.deepEqual(o.privateCards, h.service.snapshot(h.room, h.members[0]).privateCards);
  assert(o.players.every(p => !('hand' in p) && !('privateCards' in p)));
  assert(o.history.every(e => e.type === 'blind'));
  assert.equal(o.deck, undefined); h.service.dispose();
});

test('takeover fences pending actions and revoked cached receipts', () => {
  const h = setup(); const tokens = [h.grant(0), h.grant(1)]; tokens.forEach(t => h.service.agentCommand(t, 'connect'));
  h.cmd(0, 'startGame');
  const index = h.members.findIndex(m => m.id === h.room.game.activePlayers[h.room.game.currentPlayerTurn].id);
  const args = h.action(tokens[index]); const deadline = h.room.turnDeadline;
  assert.equal(h.cmd(index, 'playerAction', { handId: h.room.handId, turnId: h.room.turnId, action: 'fold' }).code, 'AGENT_CONTROLLED');
  assert(h.cmd(index, 'reclaimControl').ok);
  assert.equal(h.room.turnDeadline, deadline);
  assert.equal(h.service.agentCommand(tokens[index], 'action', args).code, 'INVALID_GRANT');
  assert.equal(h.service.agentCommand(tokens[index], 'status', { requestId: args.requestId }).code, 'INVALID_GRANT');
  assert.equal(h.cmd(index, 'playerAction', { ...args, controlVersion: args.controlVersion }).code, 'CONTROL_LOST');
  assert(h.cmd(index, 'playerAction', { handId: h.room.handId, turnId: h.room.turnId, action: 'fold' }).ok); h.service.dispose();
});

test('same action ID is idempotent; conflict, stale turn, stale control and invalid target fail', () => {
  const h = setup(); const tokens = [h.grant(0), h.grant(1)]; tokens.forEach(t => h.service.agentCommand(t, 'connect')); h.cmd(0, 'startGame');
  const index = h.members.findIndex(m => m.id === h.room.game.activePlayers[h.room.game.currentPlayerTurn].id), token = tokens[index];
  const args = h.action(token);
  assert.equal(h.service.agentCommand(token, 'action', { ...args, controlVersion: 0 }).code, 'CONTROL_LOST');
  assert.equal(h.service.agentCommand(token, 'action', { ...args, action: 'raise_to', amount: 1 }).code, 'INVALID_ACTION');
  assert(h.service.agentCommand(token, 'action', args).ok);
  const chips = h.members.map(m => m.player.chips);
  assert(h.service.agentCommand(token, 'action', args).ok);
  assert.deepEqual(h.members.map(m => m.player.chips), chips);
  assert(h.service.agentCommand(token, 'status', { requestId: args.requestId }).receipt.executed);
  assert.equal(h.service.agentCommand(token, 'action', { ...args, action: 'call' }).code, 'REQUEST_CONFLICT');
  assert.equal(h.service.agentCommand(token, 'action', { ...args, requestId: 'new' }).code, 'STALE_TURN');
  h.service.dispose();
});

test('agent keeps seat eligible after browser closes; expiry changes presence but not controller', () => {
  const h = setup(); const token = h.grant(0); h.service.agentCommand(token, 'connect');
  h.service.disconnect('a');
  assert.equal(h.members[0].sittingOut, false);
  assert.equal(h.service.eligible(h.room).length, 2);
  h.clock.tick(90000);
  assert.equal(h.service.agentActive(h.members[0]), false);
  assert.equal(h.members[0].agent.connected, true);
  assert(h.service.agentCommand(token, 'heartbeat').ok);
  assert.equal(h.service.eligible(h.room).length, 2);
  h.service.disconnect('b'); assert.equal(h.room.timers.has('idle'), false);
  h.clock.tick(90000); assert.equal(h.room.timers.has('idle'), true);
  h.service.dispose();
});

test('wait is bounded, single per grant, cancellable, and cleared on revoke or close', async () => {
  const h = setup(); const token = h.grant(0); let r = h.service.agentCommand(token, 'connect');
  const wait = h.service.waitAgent(token, r.observation.revision);
  assert.equal((await h.service.waitAgent(token, r.observation.revision)).code, 'WAIT_IN_PROGRESS');
  h.clock.tick(25000); assert((await wait).ok); assert.equal(h.service.agentListeners.size, 0);
  r = h.service.agentCommand(token, 'observation');
  const controller = new AbortController(); const cancelled = h.service.waitAgent(token, r.observation.revision, controller.signal);
  controller.abort(); assert.equal((await cancelled).code, 'CANCELLED'); assert.equal(h.service.agentListeners.size, 0);
  const revoked = h.service.waitAgent(token, r.observation.revision); h.cmd(0, 'reclaimControl');
  assert.equal((await revoked).code, 'INVALID_GRANT');
  const fresh = h.grant(0); r = h.service.agentCommand(fresh, 'connect');
  const closed = h.service.waitAgent(fresh, r.observation.revision); h.service.close(h.room);
  assert.equal((await closed).code, 'INVALID_GRANT'); assert.equal(h.service.agentListeners.size, 0); h.service.dispose();
});

test('replacement, expiry, release, end, reset and disabling revoke grants', () => {
  for (const operation of ['replace', 'expire', 'release', 'end', 'reset', 'disable', 'leave', 'spectate']) {
    const h = setup(); const token = h.grant(0); h.service.agentCommand(token, 'connect');
    if (operation === 'replace') h.grant(0);
    if (operation === 'expire') h.clock.tick(86400000);
    if (operation === 'release') assert(h.service.agentCommand(token, 'release').ok);
    if (operation === 'end') h.service.finish(h.room);
    if (operation === 'reset') h.service.reset(h.room);
    if (operation === 'disable') h.service.setAgentEnabled(false);
    if (operation === 'leave') h.cmd(0, 'leaveRoom');
    if (operation === 'spectate') h.cmd(0, 'switchToSpectator');
    assert(!h.service.agentCommand(token, 'observation').ok, operation);
    h.service.dispose();
  }
  const h = setup({ agentEnabled: false }); assert.equal(h.cmd(0, 'createAgentGrant').code, 'AGENT_DISABLED'); h.service.dispose();
});

test('45/120 seconds locked after start; heartbeats and takeovers preserve deadline', () => {
  const h = setup(); assert(h.cmd(0, 'updateRoomSettings', { settings: { turnMs: 120000 } }).ok);
  const token = h.grant(0); h.service.agentCommand(token, 'connect'); h.cmd(0, 'startGame');
  assert.equal(h.room.turnDeadline - h.clock.now(), 120000);
  assert.equal(h.cmd(0, 'updateRoomSettings', { settings: { turnMs: 45000 } }).code, 'INVALID_SETTINGS');
  const deadline = h.room.turnDeadline; h.clock.tick(20000); h.service.agentCommand(token, 'heartbeat');
  assert.equal(h.room.turnDeadline, deadline); h.cmd(0, 'reclaimControl'); assert.equal(h.room.turnDeadline, deadline); h.service.dispose();
});

test('short all-in does not reopen raising, cumulative full raise does; next street resets', () => {
  const players = [new Player('a','A'), new Player('b','B', 15), new Player('c','C')];
  const g = new Game(players, 5, 10); g.startGame();
  g.activePlayers = players; g.currentPlayerTurn = 0; g.currentBet = 10; g.minRaise = 10;
  players.forEach(p => { p.currentBet = 0; p.actedAtBet = null; p.hasActed = false; p.status = 'in-game'; });
  players[1].chips = 15;
  g.playerAction('a', 'call');
  g.playerAction('b', 'raise', 5);
  g.playerAction('c', 'call');
  assert.equal(g.currentPlayerTurn, 0);
  assert.equal(g.legalActions('a').raise_to, false);
  assert.equal(g.legalActions('a').all_in, false);
  assert.throws(() => g.playerAction('a', 'raise', 10));
  assert.equal(g.legalActions('a').callAmount, 5);
  g.currentBet = 20; assert.equal(g.legalActions('a').raise_to, true);
  g.currentBet = 15; g.playerAction('a', 'call');
  assert.equal(players[0].actedAtBet, null);
});

test('raise_to and all_in share engine validation; two agents play 20 hands without browsers', () => {
  const h = setup({ nextHandMs: 1 }); const tokens = [h.grant(0), h.grant(1)]; tokens.forEach(t => h.service.agentCommand(t, 'connect')); h.cmd(0, 'startGame');
  h.service.disconnect('a'); h.service.disconnect('b');
  for (let hand = 0; hand < 20; hand++) {
    const index = h.members.findIndex(m => m.id === h.room.game.activePlayers[h.room.game.currentPlayerTurn].id);
    assert(h.service.agentCommand(tokens[index], 'action', h.action(tokens[index])).ok);
    assert.equal(h.members.reduce((sum,m) => sum + m.player.chips, 0), 2000);
    h.clock.tick(1);
  }
  assert.equal(h.room.phase, 'BETTING');
  h.service.dispose();
});

test('raise_to contributes target minus own bet; all_in call and short raise conserve chips', () => {
  for (const mode of ['raise', 'short-raise', 'short-call']) {
    const h = setup(); const tokens = [h.grant(0), h.grant(1)]; tokens.forEach(t => h.service.agentCommand(t, 'connect')); h.cmd(0, 'startGame');
    const index = h.members.findIndex(m => m.id === h.room.game.activePlayers[h.room.game.currentPlayerTurn].id);
    const actor = h.members[index].player;
    const call = h.room.game.currentBet - actor.currentBet;
    if (mode === 'short-raise') actor.chips = call + 3;
    if (mode === 'short-call') actor.chips = Math.max(1, call - 1);
    const before = actor.chips, originalBet = actor.currentBet;
    const args = mode === 'raise' ? h.action(tokens[index], 'raise_to', { amount: 40 }) : h.action(tokens[index], 'all_in');
    const r = h.service.agentCommand(tokens[index], 'action', args); assert(r.ok, JSON.stringify(r));
    assert.equal(actor.chips, mode === 'raise' ? before - (40 - originalBet) : 0);
    assert.equal(h.room.publicHistory.filter(e => e.type === 'action').at(-1).invested, mode === 'raise' ? 40 - originalBet : before);
    h.service.dispose();
  }
});

test('rate limit is bounded; valid requests cannot extend original turn; feature-off resolves wait', async () => {
  const h = setup(); const token = h.grant(0); const r = h.service.agentCommand(token, 'connect');
  const wait = h.service.waitAgent(token, r.observation.revision);
  h.service.setAgentEnabled(false); assert.equal((await wait).code, 'AGENT_DISABLED');
  h.service.setAgentEnabled(true); const fresh = h.grant(0); h.service.agentCommand(fresh, 'connect');
  let result;
  for (let n = 0; n < 121; n++) result = h.service.agentCommand(fresh, 'observation');
  assert.equal(result.code, 'RATE_LIMIT');
  h.clock.tick(60001); assert(h.service.agentCommand(fresh, 'observation').ok); h.service.dispose();
});

test('a prior check retains raise rights against a short opening all-in; completing to big blind is legal', () => {
  const players = [new Player('a','A'), new Player('b','B'), new Player('c','C')];
  const g = new Game(players, 5, 10); g.startGame();
  g.gameState = 'FLOP'; g.currentPlayerTurn = 0; g.currentBet = 0; g.minRaise = 10;
  players.forEach(p => { p.currentBet = 0; p.actedAtBet = null; p.hasActed = false; p.status = 'in-game'; });
  g.activePlayers = players; players[1].chips = 3;
  g.playerAction('a', 'check'); g.playerAction('b', 'raise', 3); g.playerAction('c', 'call');
  assert.equal(g.legalActions('a').raise_to, true);
  assert.equal(g.legalActions('a').minRaiseTo, 10);
  g.playerAction('a', 'raise', 7);
  assert.equal(g.currentBet, 10); assert.equal(g.minRaise, 10);
});
