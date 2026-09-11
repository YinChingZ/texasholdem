const { Player } = require('./game');
const T = require('./training');
const Coach = require('./training-coach');
const fail = (message) => Object.assign(new Error(message),{code:'INVALID_TRAINING_COMMAND'});
module.exports = {
  createTraining(room) {
    room.mode='training'; room.settings.showAllHands=false;
    room.training={hands:[],notes:[],pendingPrompt:false,fast:false,current:null};
    const names=['林舟','苏禾','陈默'];
    const profiles=Object.keys(T.PROFILES);
    for(let i=profiles.length-1;i>0;i--){const j=Math.floor(this.botRandom()*(i+1));[profiles[i],profiles[j]]=[profiles[j],profiles[i]];}
    names.forEach((nickname,i)=>{
      const id=this.id(); const member={id,nickname,control:'bot',profile:profiles[i],role:'player',player:new Player(id,nickname),socketId:null,sittingOut:false,departed:false,enteredSession:true};
      room.members.set(id,member);room.game.addPlayer(member.player);
    });
    // Randomize all seats, including the human, independently from the deck.
    for(let i=room.game.players.length-1;i>0;i--){const j=Math.floor(this.botRandom()*(i+1));[room.game.players[i],room.game.players[j]]=[room.game.players[j],room.game.players[i]];}
    room.started=true;this.startHand(room);
  },
  trainingCommand(room,member,command,args) {
    this.host(room,member);
    if(['resetGame','switchToPlayer','switchToSpectator','releaseSeat','updateRoomSettings','updateInitialChips','startGame','returnToTable','sendMessage'].includes(command)) throw fail('观察练习不支持此操作');
    if(command==='getTrainingReport') {
      if(!room.training.report) throw fail('练习结束后可获取报告');
      return {ok:true,report:room.training.report};
    }
    if(room.phase==='ENDED'&&!['closeRoom','leaveRoom'].includes(command)) throw fail('练习已经结束');
    if(command==='saveObservation') {
      if(room.phase==='ENDED') throw fail('练习已经结束');
      if(room.members.get(args.playerId)?.control!=='bot'||typeof args.text!=='string'||args.text.length>2000||!['tentative','confident'].includes(args.confidence)||!Array.isArray(args.hands)||args.hands.length>20||args.hands.some(n=>!Number.isInteger(n)||n<1||n>room.training.hands.length)) throw fail('观察记录无效，请选择已完成的手牌');
      if(room.training.notes.length>=500) throw fail('本次练习记录已达上限');
      room.training.notes.push({playerId:args.playerId,text:args.text,confidence:args.confidence,hands:[...new Set(args.hands)],at:this.clock.now(),handNumber:room.training.hands.length,activeHandNumber:this.inHand(room)?room.training.current.number:null,actionIndex:this.inHand(room)?room.training.current.events.filter(e=>e.type==='action').length:null});
      return {ok:true};
    }
    if(command==='dismissObservation') {room.training.pendingPrompt=false;return {ok:true};}
    if(command==='pauseGame') {room.paused=true;this.cancelHand(room);return {ok:true};}
    if(command==='resumeGame') {room.paused=false;member.sittingOut=false;return {ok:true};}
    if(command==='fastForward') {
      if(!this.inHand(room)||member.player.status!=='folded') throw fail('弃牌后可以快速看完');
      room.training.fast=true;this.cancelHand(room);return {ok:true};
    }
    if(command==='prepareNextHand') {
      if(this.inHand(room)||room.phase==='ENDED'||room.training.pendingPrompt||room.paused) throw fail('当前不能开始下一手');
      this.startHand(room);return {ok:true};
    }
    if(command==='endGame') {
      if(!room.training.hands.length){this.close(room);return {ok:true,closed:true};}
      room.endRequested=true;room.training.pendingPrompt=false;room.paused=false;
      if(!this.inHand(room))this.finish(room);
      return {ok:true};
    }
    if(command==='leaveRoom'){this.close(room);return {ok:true,closed:true};}
    if(command==='playerAction'&&room.paused)throw fail('练习已暂停');
    return null;
  },
  trainingStart(room) {
    const t=room.training;t.fast=false;
    this.members(room).forEach(m=>{m.player.chips=1000;m.sittingOut=false;});
  },
  trainingDealt(room) {
    const g=room.game;
    room.training.current={number:room.training.hands.length+1,handId:room.handId,
      holes:T.copy(g.activePlayers.map(p=>({playerId:p.id,hand:p.hand}))),
      events:g.activePlayers.filter(p=>p.currentBet>0).map(p=>({type:'blind',playerId:p.id,amount:p.currentBet})),boardCount:0};
  },
  coachInput(room, decision) {
    return T.copy({selfId:room.creator, hand:room.members.get(room.creator).player.hand, decision,
      names:Object.fromEntries(this.members(room).map(m=>[m.id,m.nickname])),
      history:[...room.training.hands, ...(room.training.current && !room.training.hands.includes(room.training.current) ? [room.training.current] : [])].map(h=>({events:h.events.filter(e=>e.type==='action')}))});
  },
  coachingFor(room) {
    const actor=room.game.activePlayers[room.game.currentPlayerTurn];
    const current=this.inHand(room)&&actor?.id===room.creator&&actor.status==='in-game'
      ? Coach.analyzeDecision(this.coachInput(room,T.before(room.game,room.creator))) : null;
    return {current,latest:room.training.latestFeedback || null};
  },
  executeAction(room,id,action,amount=0) {
    const state=room.training?T.before(room.game,id):null;
    const coachInput=state&&id===room.creator?this.coachInput(room,state):null;
    const result=room.game.playerAction(id,action,amount);
    if(state) {
      const invested=['check','fold'].includes(action)?0:Math.min(state.chips,state.call+(['raise','bet'].includes(action)?room.game.constructor._sanitizeAmount(amount):0));
      room.training.current.events.push({type:'action',before:state,action,invested});
      if(coachInput) {
        const feedback={...Coach.explainAction(coachInput,action,invested),handNumber:room.training.current.number,actionIndex:room.training.current.events.filter(e=>e.type==='action').length};
        room.training.latestFeedback=feedback;
        (room.training.current.feedback ||= []).push(feedback);
      }
    }
    this.advance(room,result);
  },
  trainingAdvance(room,result) {
    const t=room.training,h=t.current;if(!h)return;
    const board=result?.handResult?result.communityCards:room.game.communityCards;
    if(board.length>h.boardCount){h.events.push({type:'board',cards:T.copy(board),street:['','','','FLOP','TURN','RIVER'][board.length]});h.boardCount=board.length;}
    if(result?.handResult&&!t.hands.some(old=>old.handId===h.handId)) {
      const showdown=result.playersHands.filter(p=>p.status!=='folded');
      h.events.push({type:'showdown',playerIds:showdown.length>1?showdown.map(p=>p.playerId):[]});
      h.events.push({type:'payout',winners:T.copy(result.winners)});
      h.result=T.copy(result);t.hands.push(h);
      t.pendingPrompt=[5,10,15].includes(t.hands.length)&&!room.endRequested;
    }
  },
  reconcileTraining(room) {
    if(room.phase==='ENDED'||room.phase==='ERROR')return;
    const t=room.training;
    if(room.paused){this.cancelHand(room);room.phase='PAUSED';room.pauseReason='练习已暂停';return;}
    room.pauseReason=null;
    if(this.inHand(room)) {
      if(room.game.currentPlayerTurn<0) {
        room.phase='RUNOUT';
        if(!room.timers.has('runout')){const handId=room.handId;this.timer(room,'runout',t.fast?20:this.config.runoutMs,()=>{if(room.handId!==handId||room.paused)return;this.advance(room,room.game.advanceRunoutStreet());});}
      } else {
        room.phase='BETTING';
        if(!room.turnId)room.turnId=this.id();
        const actor=room.game.activePlayers[room.game.currentPlayerTurn];
        if(room.members.get(actor.id)?.control==='bot'&&!room.timers.has('turn')) {
          const handId=room.handId,turnId=room.turnId;
          this.timer(room,'turn',t.fast?20:800,()=>{
            if(room.handId!==handId||room.turnId!==turnId||room.paused)return;
            const choice=T.decide(T.observation(room.game,actor.id),room.members.get(actor.id).profile,this.botRandom);
            this.executeAction(room,actor.id,choice.action,choice.betAmount);
          });
        }
      }
      return;
    }
    if(room.endRequested||t.hands.length>=20){this.finish(room);return;}
    if(t.pendingPrompt){this.cancel(room,'next');room.nextHandAt=null;room.phase='PAUSED';room.pauseReason='记录观察或跳过后继续';return;}
    room.phase='INTERMISSION';
    if(!room.timers.has('next')){room.nextHandAt=this.clock.now()+3000;const handId=room.handId;this.timer(room,'next',3000,()=>{if(room.handId===handId&&!room.paused&&!t.pendingPrompt)this.startHand(room);});}
  },
};
