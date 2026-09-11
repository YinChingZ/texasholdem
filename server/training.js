const poker = require('poker-evaluator');
const VERSION = 'observation-v1';
const PROFILES = {
  cautious: { label: '谨慎', threshold: .58, call: .1, aggression: .14, size: .5 },
  caller: { label: '偏爱跟注', threshold: .28, call: .48, aggression: .08, size: .4 },
  aggressive: { label: '偏激进', threshold: .38, call: .2, aggression: .48, size: .8 },
};
const copy = value => JSON.parse(JSON.stringify(value));
const rank = c => ({ J: 11, Q: 12, K: 13, A: 14 }[c.rank] || Number(c.rank));
function strength(hand, board) {
  const ranks = hand.map(rank).sort((a,b) => b-a);
  if (!board.length) return Math.min(.95, (ranks[0]+ranks[1])/36 + (ranks[0]===ranks[1] ? .25 : 0) + (hand[0].suit===hand[1].suit ? .06 : 0));
  const cards = [...hand, ...board];
  const strings = cards.map(c => `${c.rank === '10' ? 'T' : c.rank}${c.suit[0].toLowerCase()}`);
  const type = poker.evalHand(strings).handType;
  const suits = cards.reduce((a,c) => ({ ...a, [c.suit]: (a[c.suit] || 0)+1 }), {});
  const values = new Set(cards.map(rank)); if (values.has(14)) values.add(1);
  const straightDraw = Array.from({length:10},(_,i)=>i+1).some(start => Array.from({length:5},(_,i)=>start+i).filter(n=>values.has(n)).length===4);
  const draw = board.length < 5 && (Object.values(suits).includes(4) || straightDraw);
  return Math.min(.98, .15 + type*.105 + (draw ? .12 : 0));
}
// This is the entire information boundary supplied to a bot; no Game reference.
function observation(game, id) {
  const p = game.activePlayers.find(p => p.id===id);
  return copy({ hand: p.hand, board: game.communityCards, street: game.gameState,
    chips: p.chips, call: Math.max(0,game.currentBet-p.currentBet), minRaise: game.minRaise,
    pot: game.mainPot + game.sidePots.reduce((n,p)=>n+p.amount,0),
    position: (game.activePlayers.indexOf(p)-game.dealerPosition+game.activePlayers.length)%game.activePlayers.length,
    opponents: game.activePlayers.filter(q=>q.id!==id && q.status!=='folded').map(q=>({chips:q.chips,currentBet:q.currentBet,status:q.status})) });
}
function decide(view, profile, random = Math.random) {
  const p = PROFILES[profile];
  const power = strength(view.hand,view.board) + (view.position===0 ? .04 : 0);
  const cost = view.call / Math.max(1, view.pot+view.call);
  const roll = random();
  if (view.call && power + p.call < p.threshold + cost && roll > p.call) return {action:'fold'};
  if (view.chips > view.call && roll < p.aggression * (power > .65 ? 1.5 : .65)) {
    const effective = Math.min(view.chips, Math.max(...view.opponents.map(o=>o.chips+o.currentBet),view.minRaise));
    const amount = Math.min(view.chips-view.call, Math.max(view.minRaise, Math.floor(Math.min(effective,view.pot*p.size))));
    return {action:'raise',betAmount:amount};
  }
  return {action: view.call ? 'call' : 'check'};
}
function before(game, playerId) {
  const p = game.activePlayers.find(p=>p.id===playerId);
  return copy({playerId, street:game.gameState, board:game.communityCards, pot:game.mainPot+game.sidePots.reduce((n,p)=>n+p.amount,0),
    call:Math.max(0,game.currentBet-p.currentBet), chips:p.chips, currentBet:p.currentBet,
    positions:{dealer:game.activePlayers[game.dealerPosition]?.id,smallBlind:game.activePlayers[game.smallBlindPosition]?.id,bigBlind:game.activePlayers[game.bigBlindPosition]?.id},
    players:game.activePlayers.map(p=>({id:p.id,chips:p.chips,currentBet:p.currentBet,status:p.status}))});
}
function report(room, now) {
  const t=room.training;
  const bots=[...room.members.values()].filter(m=>m.control==='bot');
  const opponents=bots.map(m=>{
    const metric=()=>({count:0,opportunities:0,hands:[]});
    const vpip=metric(), raises=metric(), folds=metric();
    for(const h of t.hands) {
      const actions=h.events.filter(e=>e.type==='action'&&e.before.playerId===m.id);
      const pre=actions.filter(e=>e.before.street==='PREFLOP');
      if(pre.length) {vpip.opportunities++; if(pre.some(e=>e.invested>0)) {vpip.count++;vpip.hands.push(h.number);}}
      for(const e of actions) {
        if(e.before.chips>e.before.call) {raises.opportunities++;if(e.action==='raise'||e.action==='bet'){raises.count++;raises.hands.push(h.number);}}
        if(e.before.call>0) {folds.opportunities++;if(e.action==='fold'){folds.count++;folds.hands.push(h.number);}}
      }
    }
    return {id:m.id,nickname:m.nickname,profile:copy(PROFILES[m.profile]),metrics:{vpip,raises,folds}};
  });
  const linked=[...t.notes].reverse().flatMap(n=>n.hands).filter(n=>t.hands.some(h=>h.number===n));
  const sorted=[...t.hands].sort((a,b)=>score(b)-score(a)||a.number-b.number);
  function score(h){return Math.max(0,...h.events.filter(e=>e.type==='action'&&e.before.playerId===room.creator).map(e=>e.before.call/Math.max(1,e.before.pot)));}
  const selected=[...new Set([...linked,...sorted.map(h=>h.number)])].slice(0,3);
  return copy({id:room.sessionId,version:VERSION,finishedAt:now,completed:t.hands.length,heroId:room.creator,
    players:[...room.members.values()].map(m=>({id:m.id,nickname:m.nickname})),opponents,notes:t.notes,
    hands:t.hands,selected,feedback:'先查看当时可见的信息，再揭示底牌。单手结果不能证明判断正确；短样本也可能未体现预设倾向。'});
}
module.exports={VERSION,PROFILES,copy,observation,decide,before,report};
