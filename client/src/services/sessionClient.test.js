import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SessionClient } from './sessionClient'

class MemoryStorage {
  values = new Map()
  getItem(key) { return this.values.get(key) ?? null }
  setItem(key, value) { this.values.set(key, String(value)) }
  removeItem(key) { this.values.delete(key) }
}
class FakeSocket {
  connected = false
  handlers = new Map()
  sent = []
  replies = new Map()
  volatile = { emit: (event, args, ack) => { this.sent.push({ event, args, ack }); this.replies.get(event)?.(args, ack) } }
  on(event, handler) { if (!this.handlers.has(event)) this.handlers.set(event, new Set()); this.handlers.get(event).add(handler) }
  off(event, handler) { this.handlers.get(event)?.delete(handler) }
  fire(event, ...args) { this.handlers.get(event)?.forEach(fn => fn(...args)) }
  connect = vi.fn(() => { this.connected = true; this.fire('connect') })
  disconnect() { this.connected = false; this.fire('disconnect') }
}
const snapshot = (overrides = {}) => ({ protocolVersion: 2, roomId: 'room', sessionId: 'session', revision: 1, handId: 'hand1', turnId: 'turn1',
  gameState: 'FLOP', phase: 'BETTING', players: [], creator: 'player1', self: { playerId: 'player1', generation: 1, role: 'player' },
  privateCards: [{ rank: 'A', suit: 'Spades' }], settings: { showAllHands: true }, serverNow: Date.now(), ...overrides })
function setup(saved = true) {
  const raw = new FakeSocket(), storage = new MemoryStorage(), tabStorage = new MemoryStorage()
  if (saved) { storage.setItem('texasholdem_sessions_v2', JSON.stringify({ room: { token: 'secret' } })); storage.setItem('texasholdem_last_room_v2', 'room') }
  const client = new SessionClient(raw, { storage, tabStorage })
  return { raw, storage, tabStorage, client }
}
const flush = async () => { await Promise.resolve(); await Promise.resolve() }
beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

describe('SessionClient recovery', () => {
  it('registers listeners before connecting, installs one complete private snapshot, and ignores stale revisions', async () => {
    const { client, raw } = setup()
    raw.replies.set('resumeSession', (_args, ack) => ack({ ok: true, token: 'secret', snapshot: snapshot() }))
    client.start(); await flush()
    expect(client.state.connectionStatus).toBe('synced')
    expect(client.state.playerId).toBe('player1'); expect(client.state.privateCards).toHaveLength(1)
    raw.fire('roomSnapshot', snapshot({ revision: 0, privateCards: [] }))
    expect(client.state.privateCards).toHaveLength(1)
    client.stop()
  })
  it('keeps credentials after timeout and retries with bounded exponential backoff', async () => {
    const { client, raw, storage } = setup(); client.start()
    await vi.advanceTimersByTimeAsync(8000)
    expect(client.state.connectionStatus).toBe('reconnecting')
    expect(storage.getItem('texasholdem_sessions_v2')).toContain('secret')
    await vi.advanceTimersByTimeAsync(1000); expect(raw.sent).toHaveLength(2)
    await vi.advanceTimersByTimeAsync(10000); expect(raw.sent).toHaveLength(3)
    client.stop()
  })
  it('manual retry while offline connects the transport without buffering a resume packet', async () => {
    const { client, raw } = setup(); client.start(); raw.disconnect()
    raw.connect.mockImplementation(() => {})
    const count = raw.sent.length; client.attemptReconnect()
    expect(raw.connect).toHaveBeenCalledTimes(2); expect(raw.sent).toHaveLength(count)
    expect(client.state.connectionStatus).toBe('disconnected')
    client.stop()
  })
  it('old-page priority retains shared credentials; replacement stops retries and ignores old packets', async () => {
    const { client, raw, storage } = setup()
    raw.replies.set('resumeSession', (_args, ack) => ack({ ok: false, code: 'SESSION_IN_USE', message: 'Occupied' }))
    client.start(); await flush(); expect(client.state.connectionStatus).toBe('in-use')
    expect(storage.getItem('texasholdem_sessions_v2')).toContain('secret')
    raw.replies.set('resumeSession', (args, ack) => { expect(args.takeover).toBe(true); ack({ ok: true, snapshot: snapshot(), token: 'secret' }) })
    await client.takeover(); expect(client.state.connectionStatus).toBe('synced')
    raw.fire('sessionReplaced'); raw.fire('roomSnapshot', snapshot({ revision: 8 }));raw.fire('connect')
    await vi.advanceTimersByTimeAsync(30000); expect(client.state.connectionStatus).toBe('replaced'); expect(client.state.gameState).toBeNull()
    client.stop()
  })
  it('server restart clears only matching invalid credentials and gives an explicit terminal state', async () => {
    const { client, raw, storage } = setup()
    storage.setItem('texasholdem_sessions_v2', JSON.stringify({ room: { token: 'secret' }, another: { token: 'keep' } }))
    raw.replies.set('resumeSession', (_args, ack) => ack({ ok: false, code: 'ROOM_GONE', message: 'Gone' }))
    client.start(); await flush(); expect(client.state.connectionStatus).toBe('expired'); expect(client.state.gameState).toBeNull()
    expect(storage.getItem('texasholdem_sessions_v2')).not.toContain('secret'); expect(storage.getItem('texasholdem_sessions_v2')).toContain('keep')
    client.stop()
  })
  it('late success after returning home cannot restore the abandoned room', async () => {
    const { client, raw } = setup(); client.start(); const pending=raw.sent[0]
    client.home();pending.ack({ ok: true, snapshot: snapshot(), token: 'secret' });await flush()
    expect(client.state.room).toBeNull();expect(client.state.connectionStatus).toBe('connected')
    client.stop()
  })
  it('never sends gameplay while offline; lost bet acknowledgement queries status instead of rebetting', async () => {
    const { client, raw } = setup()
    raw.replies.set('resumeSession', (_args, ack) => ack({ ok: true, snapshot: snapshot() }))
    client.start();await flush()
    raw.replies.set('commandStatus', (_args, ack) => ack({ ok: true, commandResult: { ok: true }, snapshot: snapshot({ revision: 3, turnId: 'turn2' }) }))
    const pending=client.command('playerAction',{roomId:'room',action:'call'})
    await vi.advanceTimersByTimeAsync(8000);await pending
    expect(raw.sent.filter(s=>s.event==='playerAction')).toHaveLength(1)
    expect(client.state.gameState.turnId).toBe('turn2')
    raw.disconnect();const count=raw.sent.length;await client.command('playerAction',{action:'fold'});expect(raw.sent).toHaveLength(count)
    client.stop()
  })
  it('dismissed settlement stays dismissed on broadcasts, can reopen, and clears on next hand', async () => {
    const { client, raw } = setup();const result={handId:'hand1',winners:[]}
    raw.replies.set('resumeSession', (_args, ack) => ack({ok:true,snapshot:snapshot({gameState:'SHOWDOWN_COMPLETE',lastResult:result})}))
    client.start();await flush();expect(client.state.handResult).toEqual(result)
    client.clearHandResult();raw.fire('roomSnapshot', snapshot({revision:2,gameState:'SHOWDOWN_COMPLETE',lastResult:result}));expect(client.state.handResult).toBeNull()
    client.showLastResult();expect(client.state.handResult).toEqual(result)
    raw.fire('roomSnapshot', snapshot({revision:3,gameState:'PREFLOP',handId:'hand2',lastResult:result}));expect(client.state.handResult).toBeNull();expect(client.state.lastResult).toEqual(result)
    client.stop()
  })
  it('spectator identity and empty private cards replace prior player state on recovery', async () => {
    const { client, raw }=setup();raw.replies.set('resumeSession',(_args,ack)=>ack({ok:true,snapshot:snapshot()}));client.start();await flush()
    raw.replies.set('resumeSession',(_args,ack)=>ack({ok:true,snapshot:snapshot({revision:2,self:{playerId:'player1',generation:2,role:'spectator'},privateCards:[]})}))
    await client.resume();expect(client.state.isSpectator).toBe(true);expect(client.state.privateCards).toEqual([]);expect(client.state.recoveryVersion).toBe(2)
    client.stop()
  })
})

it('returns to a usable homepage even when the transport cannot connect', async () => {
  const { client, raw }=setup(false);raw.connect.mockImplementation(()=>{raw.fire('connect_error')});client.start()
  expect(client.state.connectionStatus).toBe('disconnected');client.home()
  expect(client.state.connectionStatus).toBe('disconnected');expect(client.state.hasSessionTarget).toBe(false);expect(client.state.room).toBeNull()
  await client.command('createRoom',{nickname:'A'});expect(raw.sent).toHaveLength(0);client.stop()
})

it('lost leave acknowledgement confirms departure without restoring the exited seat', async () => {
  const {client,raw}=setup();raw.replies.set('resumeSession',(_args,ack)=>ack({ok:true,snapshot:snapshot()}));client.start();await flush()
  raw.replies.set('commandStatus',(_args,ack)=>ack({ok:true,commandResult:{ok:true,left:true}}))
  const pending=client.leaveRoom();await vi.advanceTimersByTimeAsync(8000);await pending
  expect(client.state.room).toBeNull();expect(client.target).toBeNull();client.stop()
})

it('first handshake failure is transient until three seconds, then clears on successful retry', async () => {
  const {client,raw}=setup(false)
  raw.connect.mockImplementation(()=>raw.fire('connect_error'));client.start()
  expect(client.state.hasSessionTarget).toBe(false);expect(client.state.entryConnectionIssue).toBe(false)
  await vi.advanceTimersByTimeAsync(1000);raw.fire('connect_error')
  await vi.advanceTimersByTimeAsync(1999);expect(client.state.entryConnectionIssue).toBe(false)
  await vi.advanceTimersByTimeAsync(1);expect(client.state.entryConnectionIssue).toBe(true)
  raw.connected=true;raw.fire('connect');expect(client.state.entryConnectionIssue).toBe(false);expect(client.state.connectionStatus).toBe('connected')
  client.stop()
})

it('only a saved credential marks startup as a room restoration', () => {
  const anonymous=setup(false), returning=setup(true)
  expect(anonymous.client.state.hasSessionTarget).toBe(false)
  expect(returning.client.state.hasSessionTarget).toBe(true)
})

it('a quick initial retry never produces a delayed failure indicator', async () => {
  const {client,raw}=setup(false);raw.connect.mockImplementation(()=>raw.fire('connect_error'));client.start()
  await vi.advanceTimersByTimeAsync(500);raw.connected=true;raw.fire('connect')
  await vi.advanceTimersByTimeAsync(4000);expect(client.state.entryConnectionIssue).toBe(false)
  expect(client.state.connectionStatus).toBe('connected');client.stop()
})
