const { test } = require('node:test');
const assert = require('node:assert/strict');
const { analyzeDecision, explainAction } = require('./training-coach');
function input(overrides = {}) {
  return { selfId: 'hero', hand: [{rank:'A',suit:'Hearts'},{rank:'K',suit:'Hearts'}], names:{bot:'对手'},history:[],
    decision:{street:'PREFLOP',pot:100,call:25,chips:200,positions:{dealer:'hero'},board:[],players:[{id:'hero',chips:200,status:'in-game'},{id:'bot',chips:200,status:'in-game'}],...overrides} };
}
test('coach explains the actual call price without claiming it is win probability',()=>{
 const context=analyzeDecision(input());assert.equal(context.price.threshold,.2);assert.equal(context.price.call,25);
 assert(context.insights.some(s=>s.includes('20.0%')&&s.includes('不是你的实际胜率')));
 assert(context.evidence[0].text.includes('尚无行动样本'));
 const sidepot=analyzeDecision(input({chips:10}));assert.equal(sidepot.price.call,10);assert.equal(sidepot.price.threshold,null);
 const allin=analyzeDecision(input({players:[{id:'bot',chips:0,status:'all-in'}]}));assert.equal(allin.price.threshold,null);
});
test('feedback identifies free folds and separates call cost from the raise',()=>{
 assert(explainAction(input({call:0}),'fold',0).takeaway.includes('没有节省筹码'));
 const raise=explainAction(input(),'raise',75);assert(raise.takeaway.includes('补齐跟注 25，额外加注 50'));
 assert(explainAction(input(),'check',0).takeaway.includes('仍可能需要再次作决定'));
});
test('board analysis recognizes shared river strength and suit texture',()=>{
 const board=[{rank:'10',suit:'Spades'},{rank:'J',suit:'Spades'},{rank:'Q',suit:'Spades'},{rank:'K',suit:'Spades'},{rank:'A',suit:'Spades'}];
 const context=analyzeDecision(input({street:'RIVER',board}));assert.equal(context.handLabel,'同花顺');
 assert(context.insights.some(s=>s.includes('完全由公共牌组成')));
 assert(context.insights.some(s=>s.includes('至少三张同花色')));
});
test('evidence is street-specific and does not infer a bot profile or use outcome fields',()=>{
 const state=input();state.history=[{events:[{type:'action',before:{playerId:'bot',street:'FLOP',call:0},action:'raise'},{type:'action',before:{playerId:'bot',street:'PREFLOP',call:10},action:'fold'}]}];
 const context=analyzeDecision(state);assert.equal(context.evidence[0].samples,1);assert.equal(context.evidence[0].raises,0);assert.equal(context.evidence[0].folds,1);
 assert.deepEqual(analyzeDecision({...state,outcome:'hero wins',deck:['As'],profile:'aggressive',otherHands:['Ac','Ad']}),context);
});
