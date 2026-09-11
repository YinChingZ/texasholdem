const {test}=require('node:test');
const assert=require('node:assert/strict');
const {RoomService}=require('./room-service');
const T=require('./training');
function rng(seed=12){return()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};}
class Clock {
  time=1000;seq=0;tasks=new Map();
  now=()=>this.time;
  setTimeout=(fn,ms)=>{const id=++this.seq;this.tasks.set(id,{fn,at:this.time+ms});return id;};
  clearTimeout=id=>this.tasks.delete(id);
  next(){const item=[...this.tasks].sort((a,b)=>a[1].at-b[1].at)[0];if(!item)return false;this.tasks.delete(item[0]);this.time=item[1].at;item[1].fn();return true;}
}
function setup(seed=7){
  const clock=new Clock();let seq=0;
  const service=new RoomService({clock,deckRandom:rng(seed),botRandom:rng(seed+12),id:()=>String(++seq).padStart(8,'0'),transport:{emit(){},probe:async()=>false}});
  let req=0;
  const raw=(socket,event,args={})=>service.dispatch(socket,event,{protocolVersion:2,requestId:`r${++req}`,...args});
  const entry=raw('a','createTraining',{nickname:'Hero'});assert(entry.ok,JSON.stringify(entry));
  const room=service.rooms.get(entry.snapshot.roomId),hero=room.members.get(room.creator);
  const command=(event,args={})=>raw(hero.socketId,event,{roomId:room.id,generation:hero.generation,...args});
  const step=()=>{
    assert.notEqual(room.phase,'ERROR',room.pauseReason);
    if(room.training.pendingPrompt){assert(command('dismissObservation').ok);return;}
    const actor=room.game.activePlayers[room.game.currentPlayerTurn];
    if(room.phase==='BETTING'&&actor?.id===hero.id){assert(command('playerAction',{handId:room.handId,turnId:room.turnId,action:actor.currentBet>=room.game.currentBet?'check':'call'}).ok);}
    else assert(clock.next(),'No progress path');
  };
  const until=n=>{for(let i=0;room.training.hands.length<n&&i<5000;i++)step();assert.equal(room.training.hands.length,n);};
  return {clock,service,room,hero,raw,command,step,until,entry};
}
test('20 hands reset stacks, conserve chips, record evidence and produce an authenticated report',()=>{
 const h=setup();h.until(20);assert.equal(h.room.phase,'ENDED');
 const result=h.command('getTrainingReport');assert(result.ok);assert.equal(result.report.completed,20);assert.equal(result.report.selected.length,3);
 for(const hand of result.report.hands){assert.equal(hand.holes.length,4);assert.equal(new Set(hand.holes.flatMap(p=>p.hand.map(c=>c.rank+c.suit))).size,8);
 const paid=hand.result.winners.reduce((n,w)=>n+w.amount,0);const invested=hand.events.reduce((n,e)=>n+(e.type==='blind'?e.amount:e.invested||0),0);assert.equal(paid,invested);
 assert(hand.events.some(e=>e.type==='payout'));assert(hand.events.filter(e=>e.type==='action').every(e=>e.before.chips<=1000));}
 assert.equal(h.room.game.players.reduce((n,p)=>n+p.chips,0),4000);
 assert.equal(h.raw('intruder','getTrainingReport',{roomId:h.room.id}).ok,false);
});
test('private rooms, no bot tokens, and live snapshots hide strategy, deck and other holes',()=>{
 const h=setup();assert.equal(h.raw('b','joinRoom',{roomId:h.room.id,nickname:'X',asSpectator:true}).code,'PRIVATE_ROOM');
 const bots=h.service.members(h.room).filter(m=>m.control==='bot');assert(bots.every(m=>!m.token&&!m.socketId));
 const s=h.service.snapshot(h.room,h.hero);assert.equal(s.privateCards.length,2);
 const wire=JSON.stringify(s);for(const key of ['profile','holes','deck','threshold','aggression'])assert(!wire.includes(`"${key}"`));
 assert.equal(s.turnDeadline,null);
 const actor=h.room.game.activePlayers[0];const original=T.observation(h.room.game,actor.id);
 h.room.game.deck.cards.reverse();h.room.game.activePlayers.filter(p=>p.id!==actor.id).forEach(p=>{p.hand=[{rank:'A',suit:'Spades'},{rank:'K',suit:'Hearts'}];});
 assert.deepEqual(T.observation(h.room.game,actor.id),original);
 assert.deepEqual(T.decide(original,'aggressive',rng()),T.decide(T.observation(h.room.game,actor.id),'aggressive',rng()));
 h.service.dispose();
});
test('pause and disconnect fence tasks; reconnect requires manual resume; bots cannot keep room alive',async()=>{
 const h=setup();const tasks=[...h.clock.tasks.values()];assert(h.command('pauseGame').ok);
 const hand=h.room.handId,events=h.room.training.current.events.length;tasks.forEach(t=>t.fn());assert.equal(h.room.training.current.events.length,events);assert.equal(h.room.phase,'PAUSED');
 assert.equal(h.command('playerAction',{handId:hand,turnId:h.room.turnId,action:'fold'}).ok,false);
 assert(h.command('resumeGame').ok);h.service.disconnect('a');assert.equal(h.room.phase,'PAUSED');
 const r=await h.service.resume('new',{protocolVersion:2,requestId:'restore',roomId:h.room.id,token:h.hero.token});assert(r.ok);assert.equal(h.room.phase,'PAUSED');assert(h.command('resumeGame').ok);assert.equal(h.room.handId,hand);
 h.service.disconnect('new');assert(h.clock.next());assert.equal(h.service.rooms.size,0);
});
test('observation prompts stop at 5; notes preserve versions and reports prioritize linked hands',()=>{
 const h=setup();h.until(5);assert(h.room.training.pendingPrompt);assert(!h.room.timers.has('next'));
 const bot=h.service.members(h.room).find(m=>m.control==='bot');
 for(const text of ['似乎谨慎','证据还不足'])assert(h.command('saveObservation',{playerId:bot.id,text,confidence:'tentative',hands:[2]}).ok);
 assert.equal(h.room.training.notes.length,2);
 assert.equal(h.command('saveObservation',{playerId:bot.id,text:'future',confidence:'tentative',hands:[6]}).ok,false);
 assert(h.command('endGame').ok);const report=h.command('getTrainingReport').report;assert.equal(report.selected[0],2);assert.equal(report.notes.length,2);
});
test('duplicate action records once and early end closes an empty practice',()=>{
 const h=setup();while(h.room.game.activePlayers[h.room.game.currentPlayerTurn]?.id!==h.hero.id)h.step();
 const args={protocolVersion:2,requestId:'duplicate',roomId:h.room.id,generation:h.hero.generation,handId:h.room.handId,turnId:h.room.turnId,action:'fold'};
 assert(h.service.dispatch('a','playerAction',args).ok);const count=h.room.training.current.events.length;assert(h.service.dispatch('a','playerAction',args).ok);assert.equal(h.room.training.current.events.length,count);
 const end=h.command('endGame');assert(end.closed);assert.equal(h.clock.tasks.size,0);
});
test('fixed seeds reproduce hands; strategy profiles have measurably different actions',()=>{
 const a=setup(),b=setup();a.until(3);b.until(3);assert.deepEqual(a.room.training.hands,b.room.training.hands);a.service.dispose();b.service.dispose();
 const view={hand:[{rank:'7',suit:'Hearts'},{rank:'2',suit:'Clubs'}],board:[],street:'PREFLOP',chips:1000,call:100,minRaise:100,pot:200,position:2,opponents:[{chips:900,currentBet:100}]};
 const counts={};for(const profile of Object.keys(T.PROFILES)){const random=rng(1);counts[profile]={raise:0,fold:0,call:0};for(let i=0;i<2000;i++)counts[profile][T.decide(view,profile,random).action]++;}
 assert(counts.cautious.fold>counts.caller.fold+500);assert(counts.aggressive.raise>counts.caller.raise+100);assert(counts.caller.call>counts.aggressive.call);
});
test('runout pause cancels old street tasks and early end waits for exactly one settlement',()=>{
 const h=setup();h.until(1);h.step(); // begin the second hand
 if(!h.service.inHand(h.room))h.clock.next();
 while(h.room.game.currentPlayerTurn>=0&&h.service.inHand(h.room)) {
   const actor=h.room.game.activePlayers[h.room.game.currentPlayerTurn];
   h.service.executeAction(h.room,actor.id,'raise',actor.chips);
 }
 assert.equal(h.room.phase,'RUNOUT');
 const stale=[...h.clock.tasks.values()];assert(h.command('pauseGame').ok);
 const count=h.room.game.communityCards.length;stale.forEach(t=>t.fn());assert.equal(h.room.game.communityCards.length,count);
 assert(h.command('endGame').ok);assert.notEqual(h.room.phase,'ENDED');
 h.until(2);assert.equal(h.room.phase,'ENDED');assert.equal(h.room.training.report.hands.length,2);assert.equal(h.clock.tasks.size,0);
});
test('metrics use explicit opportunity denominators and event history never publishes holes',()=>{
 const h=setup();h.until(2);const bot=h.service.members(h.room).find(m=>m.control==='bot');
 const action=(street,call,chips,action,invested)=>({type:'action',before:{playerId:bot.id,street,call,chips,pot:20},action,invested});
 h.room.training.hands=[{number:1,events:[action('PREFLOP',0,990,'check',0),action('FLOP',10,990,'call',10),action('TURN',20,980,'fold',0)]},{number:2,events:[action('PREFLOP',10,1000,'raise',30),action('RIVER',100,50,'call',50)]}];
 const metrics=T.report(h.room,0).opponents.find(o=>o.id===bot.id).metrics;
 assert.deepEqual(metrics.vpip,{count:1,opportunities:2,hands:[2]});assert.deepEqual(metrics.raises,{count:1,opportunities:4,hands:[2]});assert.deepEqual(metrics.folds,{count:1,opportunities:4,hands:[1]});
 h.service.dispose();
});

test('multiple independent deck and strategy streams complete without illegal actions or chip loss',()=>{
 for(let seed=30;seed<42;seed++){const h=setup(seed);h.until(20);assert.equal(h.room.phase,'ENDED');for(const hand of h.room.training.hands){const paid=hand.result.winners.reduce((n,w)=>n+w.amount,0);const invested=hand.events.reduce((n,e)=>n+(e.type==='blind'?e.amount:e.invested||0),0);assert.equal(paid,invested);}assert.equal(h.clock.tasks.size,0);}
});

test('training seat and button identities remain stable across the intermission',()=>{
 const h=setup();const seats=h.service.snapshot(h.room,h.hero).players.map(p=>p.id);h.until(1);
 const state=h.service.snapshot(h.room,h.hero);assert.deepEqual(state.players.map(p=>p.id),seats);
 assert.equal(state.players[state.dealerPosition].id,h.room.game.dealerPlayerId);
 h.step();assert.deepEqual(h.service.snapshot(h.room,h.hero).players.map(p=>p.id),seats);h.service.dispose();
});
test('live coaching appears before a human turn, freezes after the action, and restores on reconnect',async()=>{
 const h=setup();while(h.room.game.activePlayers[h.room.game.currentPlayerTurn]?.id!==h.hero.id)h.step();
 const pre=h.service.snapshot(h.room,h.hero).training.coach.current;assert(pre);assert.equal(pre.price.pot,h.room.game.mainPot);
 const action={handId:h.room.handId,turnId:h.room.turnId,action:'fold'};
 assert(h.command('playerAction',action).ok);const feedback=structuredClone(h.room.training.latestFeedback);assert.equal(feedback.action,'fold');
 assert(h.command('pauseGame').ok);h.service.disconnect('a');
 assert((await h.service.resume('b',{protocolVersion:2,requestId:'coaching-restore',roomId:h.room.id,token:h.hero.token})).ok);
 assert.deepEqual(h.service.snapshot(h.room,h.hero).training.coach.latest,feedback);
 assert(h.command('resumeGame').ok);h.until(1);
 assert.deepEqual(h.room.training.hands[0].feedback[0],feedback);assert.deepEqual(h.room.training.latestFeedback,feedback);
 h.service.dispose();
});
