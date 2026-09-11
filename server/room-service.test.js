const { test } = require('node:test');
const assert = require('node:assert/strict');
const { RoomService } = require('./room-service');

class FakeClock {
  constructor() { this.time = 1000; this.tasks = new Map(); this.seq = 0; }
  now = () => this.time;
  setTimeout = (fn, ms) => { const id = ++this.seq; this.tasks.set(id, { at: this.time + ms, fn }); return id; };
  clearTimeout = id => this.tasks.delete(id);
  tick(ms) {
    const end = this.time + ms;
    for (let count = 0; count < 2000; count++) {
      const next = [...this.tasks].filter(([,t]) => t.at <= end).sort((a,b) => a[1].at-b[1].at)[0];
      if (!next) { this.time = end; return; }
      const [id,t] = next; this.tasks.delete(id); this.time = t.at; t.fn();
    }
    throw new Error('Timer loop');
  }
}
function setup(n = 2) {
  const clock = new FakeClock(), events = [], logs = [];
  const service = new RoomService({ clock, transport: { emit: (...args) => events.push(args), probe: async () => true }, log: (...args) => logs.push(args) });
  let seq = 0;
  const raw = (socket, event, args = {}) => service.dispatch(socket, event, { protocolVersion: 2, requestId: `req-${++seq}`, ...args });
  const created = raw('a', 'createRoom', { nickname: 'A' }); assert(created.ok);
  const room = service.rooms.get(created.snapshot.roomId);
  const members = [room.members.get(created.snapshot.self.playerId)];
  for (let i=1; i<n; i++) { const socket=String.fromCharCode(97+i); const response=raw(socket, 'joinRoom', {roomId:room.id, nickname:socket}); assert(response.ok); members.push(room.members.get(response.snapshot.self.playerId)); }
  const command = (member, event, args = {}) => raw(member.socketId, event, {roomId:room.id, generation:member.generation, ...args});
  const start = () => { const res=command(members[0],'startGame'); assert(res.ok,JSON.stringify(res)); };
  const act = (action, betAmount) => { const member=room.members.get(room.game.activePlayers[room.game.currentPlayerTurn].id); const res=command(member,'playerAction',{handId:room.handId,turnId:room.turnId,action,betAmount}); assert(res.ok, JSON.stringify(res)); return res; };
  const resume = (member, socket, takeover=false) => service.resume(socket,{protocolVersion:2,roomId:room.id,token:member.token,requestId:`resume-${++seq}`,takeover});
  return {service,clock,events,logs,room,members,raw,command,start,act,resume};
}

test('refresh before disconnect preserves credentials; same-socket resume is idempotent', async () => {
  const h=setup(); const m=h.members[0];
  assert.equal((await h.resume(m,'new')).code,'SESSION_IN_USE');
  h.service.transport.probe=async()=>false;
  const first=await h.resume(m,'new'); assert(first.ok); assert.equal(first.snapshot.self.playerId,m.id);
  assert((await h.resume(m,'new')).ok); assert.equal(m.generation,2);
  h.service.disconnect('a'); assert.equal(m.socketId,'new');
});

test('explicit takeover fences old socket and does not extend turn deadline', async () => {
  const h=setup();h.start(); const m=h.room.members.get(h.room.game.activePlayers[h.room.game.currentPlayerTurn].id);
  const previous=m.socketId, deadline=h.room.turnDeadline, turn=h.room.turnId;
  assert((await h.resume(m,'new',true)).ok);
  assert.equal(h.room.turnDeadline,deadline);assert.equal(h.room.turnId,turn);
  assert.equal(h.raw(previous,'pauseGame',{roomId:h.room.id,generation:1}).code,'SESSION_STALE');
  assert(h.events.some(([id,event])=>id===previous&&event==='sessionReplaced'));
});

test('stale concurrent probe cannot steal a newly bound identity', async () => {
  const h=setup(); let resolve;
  h.service.transport.probe=()=>new Promise(r=>{resolve=r});
  const pending=h.resume(h.members[0],'x');
  await h.resume(h.members[0],'y',true);resolve(false);
  assert.equal((await pending).code,'SESSION_IN_USE');assert.equal(h.members[0].socketId,'y');
});

test('host grace checks current ownership across cascading disconnects', async () => {
  const h=setup(3);h.service.disconnect('a');h.clock.tick(10000);h.service.disconnect('b');h.clock.tick(20000);
  assert.equal(h.room.creator,h.members[2].id);
  h.clock.tick(10000); assert.equal(h.room.creator,h.members[2].id);
  await h.resume(h.members[0],'a2');assert.equal(h.room.creator,h.members[2].id);
});

test('all offline elects first returning member; idle room is reclaimed', async () => {
  const h=setup();h.service.disconnect('a');h.service.disconnect('b');h.clock.tick(30000);assert.equal(h.room.creator,null);
  await h.resume(h.members[1],'b2');assert.equal(h.room.creator,h.members[1].id);
  h.service.disconnect('b2');h.clock.tick(1800000);assert.equal(h.service.rooms.size,0);
});

test('spectator can recover and leave without changing current actor or pot', async () => {
  const h=setup(); const joined=h.raw('watch','joinRoom',{roomId:h.room.id,nickname:'Watch',asSpectator:true});
  const m=h.room.members.get(joined.snapshot.self.playerId);h.start();const turn=h.room.turnId,pot=h.room.game.mainPot;
  h.service.disconnect('watch');assert((await h.resume(m,'watch2')).ok);
  assert(h.command(m,'leaveRoom').ok); assert.equal(h.room.game.mainPot,pot);assert.equal(h.room.turnId,turn);
});

test('single player hand settles; reset and new player entry stay available', () => {
  const h=setup();h.start();assert(h.command(h.members[1],'leaveRoom').ok);
  assert.equal(h.room.phase,'WAITING_PLAYERS');assert(h.command(h.members[0],'resetGame').ok);
  assert.equal(h.room.phase,'LOBBY');assert(h.raw('c','joinRoom',{roomId:h.room.id,nickname:'C'}).ok);
  assert(h.command(h.members[0],'startGame').ok);
});

test('new player queues during hand, enters at hand boundary, auto continuation after eight seconds', () => {
  const h=setup();h.start();const joined=h.raw('c','joinRoom',{roomId:h.room.id,nickname:'C'});
  assert.equal(joined.snapshot.self.pendingSeat,true);assert.equal(joined.snapshot.self.role,'spectator');
  const oldHand=h.room.handId;h.act('fold');
  assert.equal(h.room.members.get(joined.snapshot.self.playerId).role,'player');
  h.clock.tick(7999);assert.equal(h.room.handId,oldHand);h.clock.tick(1);assert.notEqual(h.room.handId,oldHand);
  assert.equal(h.room.game.activePlayers.length,3);
});

test('pause and end requests finish the current hand before taking effect', () => {
  const h=setup();h.start();assert(h.command(h.members[0],'pauseGame').ok);assert.equal(h.room.phase,'BETTING');
  h.act('fold');assert.equal(h.room.phase,'PAUSED');const hand=h.room.handId;h.clock.tick(10000);assert.equal(h.room.handId,hand);
  assert(h.command(h.members[0],'resumeGame').ok);h.clock.tick(8000);assert.notEqual(h.room.handId,hand);
  assert(h.command(h.members[0],'endGame').ok);assert.equal(h.room.phase,'BETTING');h.act('fold');assert.equal(h.room.phase,'ENDED');assert(h.room.leaderboard);
});

test('invalid action and settings updates do not reset deadline or mutate acted flag', () => {
  const h=setup();h.start();const actor=h.room.game.activePlayers[h.room.game.currentPlayerTurn],m=h.room.members.get(actor.id),deadline=h.room.turnDeadline;
  const response=h.command(m,'playerAction',{handId:h.room.handId,turnId:h.room.turnId,action:'check'});
  assert(!response.ok);assert.equal(actor.hasActed,false);assert.equal(h.room.turnDeadline,deadline);
  h.command(h.members[0],'updateRoomSettings',{settings:{showAllHands:false}});assert.equal(h.room.turnDeadline,deadline);
});

test('duplicate bets apply once and expired turn commands are rejected', () => {
  const h=setup();h.start();const actor=h.room.game.activePlayers[h.room.game.currentPlayerTurn],m=h.room.members.get(actor.id);
  const args={requestId:'same-bet',handId:h.room.handId,turnId:h.room.turnId,action:'call'};
  assert(h.command(m,'playerAction',args).ok);const pot=h.room.game.mainPot;
  assert(h.command(m,'playerAction',args).ok);assert.equal(h.room.game.mainPot,pot);
  assert.equal(h.command(m,'playerAction',{...args,requestId:'old-turn'}).code,'STALE_TURN');
});

test('blind all-in skips ineligible actor and both blind all-in hands run out automatically', () => {
  const h=setup();h.room.game.dealerPlayerId=h.members[1].id;h.members[0].player.chips=5;h.start();
  assert(['RUNOUT','BETTING'].includes(h.room.phase));
  if(h.room.phase==='BETTING') assert.equal(h.room.game.activePlayers[h.room.game.currentPlayerTurn].status,'in-game');
  const z=setup();z.members.forEach(m=>m.player.chips=5);z.start();assert.equal(z.room.phase,'RUNOUT');
  z.clock.tick(2500);assert(['INTERMISSION','ENDED'].includes(z.room.phase));assert.equal(z.members.reduce((s,m)=>s+m.player.chips,0),10);
});

test('two consecutive timeouts sit player out without extending deadline on reconnect', async () => {
  const h=setup();h.start();const m=h.room.members.get(h.room.game.activePlayers[h.room.game.currentPlayerTurn].id);
  m.timeouts=1;const socket=m.socketId;h.service.disconnect(socket);const deadline=h.room.turnDeadline;
  await h.resume(m,socket+'2');assert.equal(h.room.turnDeadline,deadline);h.clock.tick(45000);
  assert(m.sittingOut);assert.equal(m.timeouts,2);assert.equal(h.room.phase,'WAITING_PLAYERS');
  assert(h.command(m,'returnToTable').ok);assert.equal(h.room.phase,'INTERMISSION');
});

test('offline seat release preserves bankroll; same identity cannot rebuy after elimination', async () => {
  const h=setup();h.members[1].player.chips=720;h.service.disconnect('b');
  assert(h.command(h.members[0],'releaseSeat',{playerId:h.members[1].id}).ok);
  await h.resume(h.members[1],'b2');assert(h.command(h.members[1],'switchToPlayer').ok);assert.equal(h.members[1].player.chips,720);
  h.members[1].enteredSession=true;h.members[1].player.chips=0;h.command(h.members[1],'switchToSpectator');
  assert.equal(h.command(h.members[1],'switchToPlayer').code,'ELIMINATED');
});

test('result and current private cards recover atomically; public fields contain no credentials', async () => {
  const h=setup();h.start();const m=h.members[0];const before=m.player.hand.map(c=>({rank:c.rank,suit:c.suit}));
  const response=await h.resume(m,'a',false);assert.deepEqual(response.snapshot.privateCards,before);
  const observer=h.service.snapshot(h.room,h.members[1]);assert(!JSON.stringify(observer).includes(m.token));
  h.act('fold');const restored=await h.resume(m,'a');assert(restored.snapshot.lastResult);assert.deepEqual(restored.snapshot.privateCards,[]);
  assert.equal(restored.snapshot.nextHandAt,h.room.nextHandAt);
});

test('hidden results only disclose winner hands and survive settings broadcasts', () => {
  const h=setup();h.start();h.command(h.members[0],'updateRoomSettings',{settings:{showAllHands:false}});h.act('fold');
  const result=h.service.snapshot(h.room,h.members[0]).lastResult;
  assert.equal(result.playersHands.length,1);assert.equal(result.handComparison,null);
});

test('natural GAME_OVER includes authoritative snapshot and leaderboard', () => {
  const h=setup();h.start();h.room.game.activePlayers[h.room.game.currentPlayerTurn].chips=0;h.act('fold');
  assert.equal(h.room.phase,'ENDED');const snapshot=h.service.snapshot(h.room,h.members[0]);
  assert.equal(snapshot.gameState,'GAME_OVER');assert(snapshot.leaderboard);assert(snapshot.allowedActions.reset);
});

test('close cancels runout; reset cancels stale next-hand timer', () => {
  const h=setup();h.start();h.act('fold');const next=h.room.timers.get('next').handle;
  const callback=h.clock.tasks.get(next).fn;h.command(h.members[0],'resetGame');callback();h.clock.tick(9000);assert.equal(h.room.phase,'LOBBY');
  const z=setup();z.members.forEach(m=>m.player.chips=5);z.start();const pending=z.room.timers.get('runout').handle;const run=z.clock.tasks.get(pending).fn;
  z.command(z.members[0],'closeRoom');run();z.clock.tick(5000);assert.equal(z.service.rooms.size,0);assert.equal(z.clock.tasks.size,0);
});

test('ended/reset snapshots and stale command versions are safe', () => {
  const h=setup();h.start();const handId=h.room.handId,turnId=h.room.turnId;h.command(h.members[0],'endGame');h.act('fold');h.command(h.members[0],'resetGame');h.start();
  assert.equal(h.command(h.members[0],'playerAction',{handId,turnId,action:'fold'}).code,'STALE_TURN');
  assert.equal(h.raw('x','createRoom',{nickname:'X',protocolVersion:1}).code,'PROTOCOL_MISMATCH');
});

module.exports={FakeClock};

test('lost leave acknowledgement has an idempotent receipt after membership detach', () => {
  const h=setup();const args={roomId:h.room.id,generation:h.members[1].generation,requestId:'leave-1'};
  assert(h.raw('b','leaveRoom',args).left);assert(h.raw('b','leaveRoom',args).left);
  const status=h.raw('b','commandStatus',{roomId:h.room.id,commandRequestId:'leave-1'});assert(status.ok);assert(status.commandResult.left);
});

test('confirmed action request stays idempotent across connection generations', async () => {
  const h=setup();h.start();const member=h.room.members.get(h.room.game.activePlayers[h.room.game.currentPlayerTurn].id);
  const args={requestId:'call-once',handId:h.room.handId,turnId:h.room.turnId,action:'call'};
  assert(h.command(member,'playerAction',args).ok);const chips=member.player.chips;
  await h.resume(member,'changed',true);assert(h.command(member,'playerAction',args).ok);assert.equal(member.player.chips,chips);
});

test('refresh during runout preserves full hand eligibility and end waits for payout', async () => {
  const h=setup();h.start();h.act('raise',10000);h.act('call');assert.equal(h.room.phase,'RUNOUT');
  const member=h.members[0],cards=member.player.hand.map(c=>c.toString()),socket=member.socketId;
  h.command(member,'endGame');h.service.disconnect(socket);const response=await h.resume(member,'return');
  assert(response.ok);assert.equal(response.snapshot.phase,'RUNOUT');assert.equal(response.snapshot.privateCards.length,2);
  assert.deepEqual(member.player.hand.map(c=>c.toString()),cards);assert.equal(member.player.status,'all-in');
  h.clock.tick(3000);assert.equal(h.room.phase,'ENDED');assert.equal(h.members.reduce((sum,m)=>sum+m.player.chips,0),2000);
  const total=h.members.reduce((sum,m)=>sum+m.player.chips,0);h.clock.tick(3000);assert.equal(h.members.reduce((sum,m)=>sum+m.player.chips,0),total);
});

test('bounded multihand simulation conserves chips and always has a progress path', () => {
  const h=setup(6);h.start();let actions=0,hands=0,lastHand=h.room.handId;
  while(hands<40 && actions<3000 && h.room.phase!=='ENDED') {
    if(h.room.handId!==lastHand) {hands++;lastHand=h.room.handId}
    if(h.room.phase==='BETTING') {
      assert(h.room.turnId);assert(h.room.timers.has('turn'));
      const p=h.room.game.activePlayers[h.room.game.currentPlayerTurn];assert.equal(p.status,'in-game');
      h.act(actions % 7===0 ? 'fold' : p.currentBet===h.room.game.currentBet ? 'check' : 'call');actions++;
    } else if(h.room.phase==='RUNOUT') h.clock.tick(600);
    else if(h.room.phase==='INTERMISSION') h.clock.tick(8000);
    else throw new Error(`Unexpected phase ${h.room.phase}`);
    const contributed=h.room.game.activePlayers.reduce((sum,p)=>sum+p.totalBetThisHand,0);
    assert.equal(h.members.reduce((sum,m)=>sum+m.player.chips,0)+contributed,6000);
  }
  assert(actions>30);assert.equal(h.logs.filter(([event])=>event==='invariant_failure').length,0);
});

test('current actor leaving hands timeout to the new actor instead of the departed player', () => {
  const h=setup(3);h.start();const before=h.room.turnId;
  const leaver=h.room.members.get(h.room.game.activePlayers[h.room.game.currentPlayerTurn].id);
  assert(h.command(leaver,'leaveRoom').ok);assert.notEqual(h.room.turnId,before);
  h.clock.tick(45000);assert.notEqual(h.room.phase,'ERROR');assert(!h.logs.some(([event])=>event==='invariant_failure'));
});
