const players = [
  { id: 'player-1', nickname: '河牌猎手', chips: 1240, currentBet: 40, status: 'in-game', hand: [] },
  { id: 'player-2', nickname: '北岸', chips: 860, currentBet: 40, status: 'in-game', hand: [] },
  { id: 'player-3', nickname: '慢打', chips: 1020, currentBet: 0, status: 'folded', hand: [] },
  { id: 'player-4', nickname: '灯塔', chips: 880, currentBet: 40, status: 'in-game', hand: [] },
]

const fullTablePlayers = [
  ...players,
  { id: 'player-5', nickname: '松针', chips: 1000, currentBet: 0, status: 'in-game', hand: [] },
  { id: 'player-6', nickname: '青石', chips: 1000, currentBet: 0, status: 'in-game', hand: [] },
  { id: 'player-7', nickname: '晚风', chips: 1000, currentBet: 0, status: 'in-game', hand: [] },
  { id: 'player-8', nickname: '纸牌屋', chips: 1000, currentBet: 0, status: 'in-game', hand: [] },
]

const communityCards = [
  { rank: 'A', suit: 'Hearts' },
  { rank: '10', suit: 'Spades' },
  { rank: '7', suit: 'Clubs' },
  { rank: 'K', suit: 'Diamonds' },
  { rank: '2', suit: 'Hearts' },
]

const baseGame = {
  roomId: 'CLUB24',
  gameState: 'FLOP',
  players,
  spectators: [{ id: 'spectator-1', nickname: '看牌的人' }],
  creator: 'player-1',
  currentPlayerTurn: 'player-1',
  currentBet: 40,
  bigBlind: 20,
  mainPot: 280,
  sidePots: [],
  dealerPosition: 0,
  smallBlindPosition: 1,
  bigBlindPosition: 2,
  communityCards: communityCards.slice(0, 3),
  settings: { showAllHands: true, initialChips: 1000 },
}

const leaderboard = players.map((player) => ({
  id: player.id,
  nickname: player.nickname,
  chips: player.chips,
}))

const resultHands = [
  {
    playerId: 'player-1', nickname: '河牌猎手', handDescription: '两对，A 和 10', rank: 1, isWinner: true,
    hand: [{ rank: 'A', suit: 'Spades' }, { rank: '10', suit: 'Diamonds' }],
    bestCards: [communityCards[0], { rank: 'A', suit: 'Spades' }, communityCards[1], { rank: '10', suit: 'Diamonds' }, communityCards[3]],
  },
  {
    playerId: 'player-2', nickname: '北岸', handDescription: '一对 10', rank: 2, isWinner: false,
    hand: [{ rank: '10', suit: 'Hearts' }, { rank: '9', suit: 'Hearts' }],
    bestCards: [communityCards[1], { rank: '10', suit: 'Hearts' }, communityCards[0], communityCards[3], { rank: '9', suit: 'Hearts' }],
  },
]

const handComparison = {
  rankedPlayers: resultHands.map(({ playerId, nickname, handDescription, rank }) => ({ playerId, nickname, handDescription, rank })),
  totalActivePlayers: resultHands.length,
}

const handResults = {
  result: {
    winners: [{ playerId: 'player-1', nickname: '河牌猎手', amount: 280, handDescription: '两对，A 和 10' }],
    communityCards,
    playersHands: resultHands,
    handComparison,
    showAllHands: true,
  },
  'result-hidden': {
    winners: [{ playerId: 'player-1', nickname: '河牌猎手', amount: 280, handDescription: '两对，A 和 10' }],
    communityCards,
    playersHands: resultHands.slice(0, 1),
    handComparison: null,
    showAllHands: false,
  },
  'result-split': {
    winners: [
      { playerId: 'player-1', nickname: '河牌猎手', amount: 140, handDescription: '同花 A 高', potLabel: '主池平分' },
      { playerId: 'player-2', nickname: '北岸', amount: 140, handDescription: '同花 A 高', potLabel: '主池平分' },
    ],
    communityCards,
    playersHands: resultHands.map((hand) => ({ ...hand, handDescription: '同花 A 高', rank: 1, isWinner: true })),
    handComparison: { rankedPlayers: resultHands.map(({ playerId, nickname }) => ({ playerId, nickname, handDescription: '同花 A 高', rank: 1 })) },
    showAllHands: true,
  },
  'result-side-pot': {
    winners: [
      { playerId: 'player-1', nickname: '河牌猎手', amount: 180, handDescription: '三条 A', potLabel: '主池' },
      { playerId: 'player-4', nickname: '灯塔', amount: 100, handDescription: '两对，K 和 10', potLabel: '边池' },
    ],
    communityCards,
    playersHands: resultHands,
    handComparison,
    showAllHands: true,
  },
  'result-last-player': {
    winners: [{ playerId: 'player-1', nickname: '河牌猎手', amount: 280, handDescription: '唯一留在牌局中的玩家' }],
    communityCards: communityCards.slice(0, 3),
    playersHands: resultHands.slice(0, 1),
    handComparison,
    showAllHands: true,
  },
}

// 脚本化演示序列：按帧步进 gameState，驱动排程器播放完整一手牌的
// 音效与动画（加注/跟注/弃牌气泡、翻牌、全押 runout、派彩、结算弹窗）。
// 用法：?uiPreview=game-demo
const demoPlayers = (patches = {}) => [
  { id: 'player-1', nickname: '河牌猎手', chips: 1240, currentBet: 0, status: 'in-game', hand: [] },
  { id: 'player-2', nickname: '北岸', chips: 860, currentBet: 0, status: 'in-game', hand: [] },
  { id: 'player-3', nickname: '慢打', chips: 1020, currentBet: 0, status: 'in-game', hand: [] },
  { id: 'player-4', nickname: '灯塔', chips: 880, currentBet: 0, status: 'in-game', hand: [] },
].map((player) => (patches[player.id] ? { ...player, ...patches[player.id] } : player))

const demoFrame = (patch, playerPatches) => ({
  ...baseGame,
  gameState: 'PREFLOP',
  communityCards: [],
  mainPot: 30,
  currentBet: 20,
  players: demoPlayers(playerPatches),
  ...patch,
})

export const demoScript = [
  // 盲注就位，等待 player-4 行动
  { holdMs: 1600, gameState: demoFrame({ currentPlayerTurn: 'player-4' }, {
    'player-2': { chips: 850, currentBet: 10 },
    'player-3': { chips: 1000, currentBet: 20 },
  }) },
  // player-4 加注到 60
  { holdMs: 1800, gameState: demoFrame({ currentPlayerTurn: 'player-1', currentBet: 60, mainPot: 90 }, {
    'player-2': { chips: 850, currentBet: 10 },
    'player-3': { chips: 1000, currentBet: 20 },
    'player-4': { chips: 820, currentBet: 60 },
  }) },
  // 英雄跟注
  { holdMs: 1600, gameState: demoFrame({ currentPlayerTurn: 'player-2', currentBet: 60, mainPot: 150 }, {
    'player-1': { chips: 1180, currentBet: 60 },
    'player-2': { chips: 850, currentBet: 10 },
    'player-3': { chips: 1000, currentBet: 20 },
    'player-4': { chips: 820, currentBet: 60 },
  }) },
  // player-2 弃牌
  { holdMs: 1500, gameState: demoFrame({ currentPlayerTurn: 'player-3', currentBet: 60, mainPot: 150 }, {
    'player-1': { chips: 1180, currentBet: 60 },
    'player-2': { chips: 850, currentBet: 10, status: 'folded' },
    'player-3': { chips: 1000, currentBet: 20 },
    'player-4': { chips: 820, currentBet: 60 },
  }) },
  // player-3 补齐跟注 → 翻牌（下注清零、发3张公共牌）
  { holdMs: 2400, gameState: demoFrame({
    gameState: 'FLOP', currentPlayerTurn: 'player-3', currentBet: 0, mainPot: 190,
    communityCards: communityCards.slice(0, 3),
  }, {
    'player-1': { chips: 1180 },
    'player-2': { chips: 850, status: 'folded' },
    'player-3': { chips: 960 },
    'player-4': { chips: 820 },
  }) },
  // player-3 过牌
  { holdMs: 1500, gameState: demoFrame({
    gameState: 'FLOP', currentPlayerTurn: 'player-4', currentBet: 0, mainPot: 190,
    communityCards: communityCards.slice(0, 3),
  }, {
    'player-1': { chips: 1180 },
    'player-2': { chips: 850, status: 'folded' },
    'player-3': { chips: 960 },
    'player-4': { chips: 820 },
  }) },
  // player-4 下注 80
  { holdMs: 1800, gameState: demoFrame({
    gameState: 'FLOP', currentPlayerTurn: 'player-1', currentBet: 80, mainPot: 270,
    communityCards: communityCards.slice(0, 3),
  }, {
    'player-1': { chips: 1180 },
    'player-2': { chips: 850, status: 'folded' },
    'player-3': { chips: 960 },
    'player-4': { chips: 740, currentBet: 80 },
  }) },
  // 英雄全押
  { holdMs: 2000, gameState: demoFrame({
    gameState: 'FLOP', currentPlayerTurn: 'player-4', currentBet: 1180, mainPot: 1450,
    communityCards: communityCards.slice(0, 3),
  }, {
    'player-1': { chips: 0, currentBet: 1180, status: 'all-in' },
    'player-2': { chips: 850, status: 'folded' },
    'player-3': { chips: 960, status: 'folded' },
    'player-4': { chips: 740, currentBet: 80 },
  }) },
  // player-4 跟注全押 → runout 到河牌
  { holdMs: 2600, gameState: demoFrame({
    gameState: 'RIVER', currentPlayerTurn: null, currentBet: 0, mainPot: 2190,
    communityCards,
  }, {
    'player-1': { chips: 0, currentBet: 1180, status: 'all-in' },
    'player-2': { chips: 850, status: 'folded' },
    'player-3': { chips: 960, status: 'folded' },
    'player-4': { chips: 0, currentBet: 820, status: 'all-in' },
  }) },
  // 结算：清场快照 + handResult
  { holdMs: 60000, gameState: demoFrame({
    gameState: 'SHOWDOWN_COMPLETE', currentPlayerTurn: null, currentBet: 0, mainPot: 0,
  }, {
    'player-1': { chips: 2190 },
    'player-2': { chips: 850 },
    'player-3': { chips: 960 },
    'player-4': { chips: 0, status: 'out-of-chips' },
  }), handResult: {
    winners: [{ playerId: 'player-1', nickname: '河牌猎手', amount: 2190, handDescription: '两对，A 和 10' }],
    communityCards: ['Ah', 'Ts', '7c', 'Kd', '2h'],
    playersHands: resultHands,
    handComparison,
    showAllHands: true,
  } },
]

function createSocket(id = 'player-1') {
  return {
    id,
    connected: true,
    on: () => {},
    off: () => {},
    emit: () => {},
  }
}

export const previewStateNames = [
  'welcome',
  'connecting',
  'reconnecting',
  'disconnected',
  'lobby-host',
  'lobby-guest',
  'lobby-one',
  'lobby-full',
  'game-turn',
  'game-waiting',
  'game-two',
  'game-six',
  'game-eight',
  'game-preflop',
  'game-turn-phase',
  'game-river',
  'game-showdown',
  'game-no-raise',
  'game-all-in',
  'spectator',
  'result',
  'result-hidden',
  'result-split',
  'result-side-pot',
  'result-last-player',
  'leaderboard',
  'message-allin',
  'game-demo',
]

export function createPreviewValue(state) {
  const isGuest = state === 'lobby-guest'
  const isSpectator = state === 'spectator'
  const socketId = isGuest ? 'player-2' : isSpectator ? 'spectator-1' : 'player-1'
  const socket = createSocket(socketId)
  const room = state === 'welcome' || state === 'disconnected' ? null : { id: 'CLUB24' }

  let gameState = null
  if (state.startsWith('lobby')) {
    const lobbyPlayers = state === 'lobby-one' ? players.slice(0, 1) : state === 'lobby-full' ? fullTablePlayers : players
    gameState = { ...baseGame, players: lobbyPlayers, gameState: 'WAITING', communityCards: [], mainPot: 0 }
  }
  const resultPreview = state.startsWith('result')
  const gamePreview = state.startsWith('game-') || resultPreview || ['spectator', 'leaderboard'].includes(state)
  if (gamePreview) {
    const phaseCards = {
      'game-preflop': [],
      'game-turn-phase': communityCards.slice(0, 4),
      'game-river': communityCards,
      'game-showdown': communityCards,
      result: communityCards,
    }
    // 与真实服务器一致：handResult 到达时牌局已是 SHOWDOWN_COMPLETE（结算后广播）
    const phase = resultPreview ? 'SHOWDOWN_COMPLETE' : ({
      'game-preflop': 'PREFLOP',
      'game-turn-phase': 'TURN',
      'game-river': 'RIVER',
      'game-showdown': 'SHOWDOWN',
      leaderboard: 'GAME_OVER',
    }[state] ?? 'FLOP')
    const previewPlayers = state === 'game-two'
      ? fullTablePlayers.slice(0, 2)
      : state === 'game-six'
        ? fullTablePlayers.slice(0, 6)
        : state === 'game-eight'
          ? fullTablePlayers
          : state === 'game-no-raise'
            ? players.map((player) => player.id === 'player-1' ? { ...player, chips: 30, currentBet: 40 } : player)
            : state === 'game-all-in'
              ? players.map((player) => player.id === 'player-1' ? { ...player, chips: 0, currentBet: 80, status: 'all-in' } : player)
              : players
    const resultPlayers = state === 'result-last-player'
      ? players.map((player) => player.id === 'player-1' ? player : { ...player, chips: 0, status: 'out' })
      : previewPlayers
    gameState = {
      ...baseGame,
      players: resultPlayers,
      currentPlayerTurn: ['game-waiting', 'game-all-in'].includes(state) ? 'player-2' : 'player-1',
      currentBet: state === 'game-no-raise' ? 80 : baseGame.currentBet,
      gameState: phase,
      communityCards: resultPreview ? communityCards : (phaseCards[state] ?? baseGame.communityCards),
      leaderboard: state === 'leaderboard' ? leaderboard : undefined,
    }
  }

  return {
    socket,
    isConnected: state !== 'disconnected',
    gameState,
    privateCards: [
      { rank: 'A', suit: 'Spades' },
      { rank: 'K', suit: 'Spades' },
    ],
    room,
    error: null,
    handResult: handResults[state] ?? null,
    clearHandResult: () => {},
    isRoomCreator: !isGuest && !isSpectator,
    isSpectator,
    roomSettings: baseGame.settings,
    connectionStatus: state === 'disconnected' ? 'disconnected' : 'connected',
    isReconnecting: state === 'reconnecting',
    attemptReconnect: () => {},
    leaveRoom: () => {},
  }
}
