const poker = require('poker-evaluator');
const VERSION = 'coach-v1';
const actionNames = { fold: '弃牌', check: '过牌', call: '跟注', raise: '加注', bet: '下注' };
const ranks = { J: 11, Q: 12, K: 13, A: 14, T: 10 };
const rank = card => ranks[card.rank] || Number(card.rank);
const cardCode = card => `${card.rank === '10' ? 'T' : card.rank}${card.suit[0].toLowerCase()}`;
const handNames = ['', '高牌', '一对', '两对', '三条', '顺子', '同花', '葫芦', '四条', '同花顺'];
const percentage = value => `${(100 * value).toFixed(1)}%`;

// Pure coaching boundary: own cards + information visible BEFORE the decision.
// Never accepts a Game, deck, bot profile, outcome, or other private cards.
function analyzeDecision({ selfId, hand, decision, history, names }) {
  const call = Math.min(decision.chips, decision.call);
  const active = decision.players.filter(p => p.id !== selfId && p.status !== 'folded');
  const hasSidePotRisk = active.some(p => p.status === 'all-in') || decision.call > decision.chips;
  const price = {
    pot: decision.pot, call, stackFraction: call / Math.max(1, decision.chips),
    threshold: call > 0 && !hasSidePotRisk ? call / (decision.pot + call) : null,
  };
  const insights = [];
  if (!call) insights.push('当前可以免费过牌；先区分“没有投入”与“必须弃牌”。');
  else if (hasSidePotRisk) insights.push(`需投入 ${call} 筹码；涉及全押或边池，不把全部底池直接当作你能争取的金额计算门槛。`);
  else insights.push(`跟注 ${call}，争取跟注后 ${decision.pot + call} 的底池。若此后无需追加投入，打平门槛约 ${percentage(price.threshold)}；这不是你的实际胜率。`);
  if (call && price.stackFraction >= .5) insights.push(`这次跟注会用掉当前筹码的 ${percentage(price.stackFraction)}，要把后续投入也纳入计划。`);

  let handLabel = '尚未发牌';
  if (hand.length === 2 && decision.board.length === 0) {
    const pair = hand[0].rank === hand[1].rank;
    const suited = hand[0].suit === hand[1].suit;
    const connected = Math.abs(rank(hand[0]) - rank(hand[1])) === 1;
    handLabel = pair ? `口袋对子 ${hand[0].rank}` : `${suited ? '同花' : '不同花'}起手牌${connected ? '，相连' : ''}`;
    insights.push(pair ? '口袋对子已经成对，但公共牌和对手的行动仍可能改变相对牌力。' : '起手牌结构只说明潜力；不能凭同花或两张高牌判断一定值得跟注。');
  } else if (hand.length === 2 && decision.board.length >= 3) {
    handLabel = handNames[poker.evalHand([...hand, ...decision.board].map(cardCode)).handType];
    const suitCounts = decision.board.reduce((counts, c) => ({ ...counts, [c.suit]: (counts[c.suit] || 0) + 1 }), {});
    if (Math.max(...Object.values(suitCounts)) >= 3) insights.push('公共牌已有至少三张同花色：对手可能完成同花，但这不证明他持有同花。');
    if (new Set(decision.board.map(c => c.rank)).size < decision.board.length) insights.push('公共牌出现对子：注意葫芦或四条的可能性，也要区分公共牌成对与底牌真正改善。');
    const unique = new Set(decision.board.map(rank));
    if (unique.has(14)) unique.add(1);
    if (Array.from({ length: 10 }, (_, start) => Array.from({ length: 5 }, (_, i) => start + i + 1).filter(n => unique.has(n)).length).some(count => count >= 3)) insights.push('公共牌点数较接近，顺子组合值得检查；请结合此前行动，而非只看最后一张牌。');
    if (decision.board.length === 5) {
      const shared = poker.evalHand(decision.board.map(cardCode));
      const best = poker.evalHand([...hand, ...decision.board].map(cardCode));
      if (shared.value === best.value) insights.push('你的最佳五张牌完全由公共牌组成，底牌没有提高牌力；其他玩家至少也能使用这组公共牌。');
    }
    insights.push(`当前最佳牌型为${handLabel}，牌型名称不等于领先概率；还需要判断对手可能有哪些组合。`);
  }
  insights.push(decision.positions.dealer === selfId
    ? '你在庄家位；仍需结合当前街道与未弃牌人数判断行动顺序。'
    : '你不在庄家位；作决定前看看还有哪些对手能继续行动。');

  const evidence = active.map(player => {
    const sameStreet = history.flatMap(h => h.events).filter(e => e.type === 'action' && e.before.playerId === player.id && e.before.street === decision.street);
    const raises = sameStreet.filter(e => ['raise', 'bet'].includes(e.action)).length;
    const facing = sameStreet.filter(e => e.before.call > 0);
    const folds = facing.filter(e => e.action === 'fold').length;
    return { playerId: player.id, name: names[player.id], samples: sameStreet.length, raises, facing: facing.length, folds,
      text: sameStreet.length
        ? `这条街已观察 ${sameStreet.length} 次行动，其中主动下注或加注 ${raises} 次；${facing.length ? `面对下注弃牌 ${folds}/${facing.length} 次。` : '尚无面对下注的行动样本。'}${sameStreet.length < 5 ? '样本很少，暂缓定性。' : '行动次数不等于独立手数，仍需结合位置与下注尺度。'}`
        : '这条街尚无行动样本，不把其他街道的激进表现直接当作这里的诈唬证据。' };
  });
  const prompt = call
    ? '先想出几种符合对手此前行动的强牌和弱牌，再判断继续投入是否合理。'
    : '若考虑下注：希望哪些更弱的牌跟注，或哪些更强的牌弃牌？';
  return { version: VERSION, street: decision.street, handLabel, price, insights, evidence, prompt };
}
function explainAction(input, action, invested) {
  const analysis = analyzeDecision(input);
  let takeaway;
  if (action === 'fold') takeaway = input.decision.call === 0
    ? '本次本可免费过牌。弃牌没有节省筹码，却放弃了继续争取底池的机会；下次先检查是否需要跟注。'
    : '弃牌避免了本次继续投入。判断是否合理，应回到当时的成本和对手范围，而不是看随后发出了什么牌。';
  else if (action === 'check') takeaway = '过牌没有投入筹码，并保留了手牌资格；若其他玩家继续下注，你仍可能需要再次作决定。';
  else if (action === 'call') takeaway = `你跟注投入 ${invested}。检查自己的判断是否足以支持这笔成本；如果仍有后续下注，当前打平门槛只是第一步。`;
  else takeaway = `你本次共投入 ${invested}，其中补齐跟注 ${Math.min(input.decision.call, invested)}，额外加注 ${Math.max(0, invested - input.decision.call)}。回看目的：是让更弱牌跟注获取价值，还是让更强牌弃牌？`;
  return { ...analysis, action, actionLabel: actionNames[action], invested, takeaway };
}
module.exports = { analyzeDecision, explainAction, VERSION };
