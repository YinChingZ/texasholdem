export const PROTOCOL_VERSION = 2
const CREDENTIALS = 'texasholdem_sessions_v2'
const TARGET = 'texasholdem_target_v2'
const LAST_ROOM = 'texasholdem_last_room_v2'
const empty = { gameState: null, privateCards: [], room: null, handResult: null, lastResult: null,
  playerId: null, isRoomCreator: false, isSpectator: false, roomSettings: { showAllHands: true }, error: null }

// Transport lifecycle and identity lifecycle are separate. No gameplay command is
// ever buffered by Socket.IO; a missing acknowledgement is resolved by a snapshot
// and a request-status query, never by blindly replaying a bet.
export class SessionClient {
  constructor(socket, { storage = localStorage, tabStorage = sessionStorage, clock = { setTimeout: (fn, ms) => globalThis.setTimeout(fn, ms), clearTimeout: id => globalThis.clearTimeout(id), now: () => Date.now() }, uuid = () => crypto.randomUUID() } = {}) {
    this.raw = socket; this.storage = storage; this.tabStorage = tabStorage; this.clock = clock; this.uuid = uuid
    this.state = { ...empty, connectionStatus: 'connecting', isConnected: false, isReconnecting: false, notices: [], recoveryVersion: 0 }
    this.listeners = new Set(); this.pendingTimers = new Set(); this.retry = 0; this.epoch = 0; this.running = false
    this.target = this.readTarget(); this.homeChosen = false; this.dismissedResult = null; this.requestCounter = 0
    const client = this
    this.socket = {
      get id() { return client.state.playerId },
      get connected() { return client.state.connectionStatus === 'synced' },
      emit: (event, payload) => this.command(event, payload),
      on: (event, fn) => socket.on(event, fn), off: (event, fn) => socket.off(event, fn),
    }
    this.handlers = {
      connect: () => this.connected(),
      disconnect: () => this.disconnected(),
      connect_error: () => this.disconnected(),
      roomSnapshot: snapshot => {
        if (['reconnecting', 'in-use', 'replaced', 'expired', 'protocol-error'].includes(this.state.connectionStatus)) return
        if (this.state.room?.id === snapshot.roomId || this.entering) this.apply(snapshot)
      },
      sessionProbe: (_payload, ack) => { if (this.running && this.state.connectionStatus === 'synced') ack?.({ alive: true }) },
      sessionReplaced: () => { this.epoch++; this.clearTimers(); this.update({ ...empty, connectionStatus: 'replaced', isReconnecting: false, error: '此身份已在其他页面接管' }) },
      roomClosed: ({ roomId, message }) => {
        if (roomId !== this.state.room?.id && roomId !== this.target) return
        this.removeCredential(roomId); this.home(); this.notice(message || '房间已关闭')
      },
      error: error => this.update({ error: error?.message || '操作失败' }),
    }
  }

  readJSON(key) { try { const value = JSON.parse(this.storage.getItem(key) || '{}'); return value && typeof value === 'object' && !Array.isArray(value) ? value : {} } catch { return {} } }
  readTarget() {
    const tab = this.tabStorage.getItem(TARGET)
    return tab === '__home__' ? null : tab || this.storage.getItem(LAST_ROOM) || this.storage.getItem('texasholdem_room')
  }
  credential(roomId = this.target) {
    if (!roomId) return null
    const saved = this.readJSON(CREDENTIALS)[roomId]
    if (saved) return saved
    if (this.storage.getItem('texasholdem_room') === roomId && this.storage.getItem('texasholdem_token')) return { token: this.storage.getItem('texasholdem_token') }
    return null
  }
  saveCredential(roomId, token) {
    const credentials = this.readJSON(CREDENTIALS)
    credentials[roomId] = { token }
    this.storage.setItem(CREDENTIALS, JSON.stringify(credentials))
    this.storage.setItem(LAST_ROOM, roomId); this.tabStorage.setItem(TARGET, roomId); this.target = roomId
  }
  removeCredential(roomId, token) {
    const credentials = this.readJSON(CREDENTIALS)
    if (!token || credentials[roomId]?.token === token) { delete credentials[roomId]; this.storage.setItem(CREDENTIALS, JSON.stringify(credentials)) }
    if (this.storage.getItem('texasholdem_room') === roomId && (!token || this.storage.getItem('texasholdem_token') === token)) {
      this.storage.removeItem('texasholdem_room'); this.storage.removeItem('texasholdem_token')
    }
  }
  update(patch) { this.state = { ...this.state, ...patch }; this.listeners.forEach(fn => fn()) }
  subscribe = fn => { this.listeners.add(fn); return () => this.listeners.delete(fn) }
  getSnapshot = () => this.state
  notice(message) { if (message) this.update({ notices: [...this.state.notices, { id: this.uuid(), message }] }) }
  dismissNotice = id => this.update({ notices: this.state.notices.filter(n => n.id !== id) })
  clearError = () => this.update({ error: null })
  clearHandResult = () => { this.dismissedResult = this.state.handResult?.handId; this.update({ handResult: null }) }
  showLastResult = () => this.update({ handResult: this.state.lastResult })

  start() {
    if (this.running) return
    this.running = true
    Object.entries(this.handlers).forEach(([event, handler]) => this.raw.on(event, handler))
    if (this.raw.connected) this.connected(); else this.raw.connect()
  }
  stop() {
    this.running = false; this.epoch++; this.clearTimers()
    Object.entries(this.handlers).forEach(([event, handler]) => this.raw.off(event, handler))
    this.raw.disconnect()
  }
  clearTimers() { for (const task of this.pendingTimers) { this.clock.clearTimeout(task.handle); task.cancel?.() } this.pendingTimers.clear() }
  later(fn, ms, cancel) {
    const task = { handle: null, cancel }
    task.handle = this.clock.setTimeout(() => { this.pendingTimers.delete(task); fn() }, ms)
    this.pendingTimers.add(task); return task
  }
  cancelTask(task) { this.clock.clearTimeout(task.handle); this.pendingTimers.delete(task) }
  connected() {
    this.update({ isConnected: true })
    if (['replaced', 'in-use', 'protocol-error', 'expired'].includes(this.state.connectionStatus)) return
    if (this.target && this.credential()) this.resume()
    else this.update({ ...empty, connectionStatus: 'connected', isReconnecting: false })
  }
  disconnected() {
    this.epoch++; this.clearTimers(); this.entering = false
    if (['replaced', 'in-use', 'protocol-error', 'expired'].includes(this.state.connectionStatus)) { this.update({ isConnected: false }); return }
    this.update({ isConnected: false, connectionStatus: this.homeChosen && !this.target ? 'connected' : 'disconnected', isReconnecting: false, error: this.homeChosen && !this.target ? '网络不可用，连接后即可加入房间' : null })
  }

  request(event, args, timeout = 8000) {
    if (!this.raw.connected) return Promise.resolve(null)
    return new Promise(resolve => {
      let done = false
      const finish = response => { if (done) return; done = true; this.cancelTask(task); resolve(response) }
      const task = this.later(() => finish(null), timeout, () => { if (!done) { done = true; resolve(null) } })
      this.raw.volatile.emit(event, args, finish)
    })
  }

  attemptReconnect = () => {
    if (!this.raw.connected) { this.update({ connectionStatus: 'disconnected', isReconnecting: false }); this.raw.connect() }
    else if (this.target && this.credential()) this.resume()
    else this.connected()
  }
  takeover = () => this.resume(true)
  async resume(takeover = false) {
    const credential = this.credential(), roomId = this.target
    if (!credential || !roomId || !this.raw.connected) return
    const epoch = ++this.epoch
    this.clearTimers()
    this.update({ connectionStatus: 'reconnecting', isReconnecting: true, error: null })
    const response = await this.request('resumeSession', { protocolVersion: PROTOCOL_VERSION, requestId: this.uuid(), roomId, token: credential.token, takeover })
    if (epoch !== this.epoch || !this.running) return
    if (!response) {
      const delay = Math.min(8000, 1000 * 2 ** this.retry++)
      this.update({ error: '恢复暂未完成，正在重试；你的身份凭证仍然保留' })
      this.later(() => this.resume(takeover), delay)
      return
    }
    if (!response.ok) {
      if (response.code === 'SESSION_IN_USE') this.update({ connectionStatus: 'in-use', isReconnecting: false, error: response.message })
      else if (['ROOM_GONE', 'INVALID_TOKEN'].includes(response.code)) {
        this.removeCredential(roomId, credential.token)
        this.update({ ...empty, connectionStatus: 'expired', isReconnecting: false, error: response.message })
      } else if (response.code === 'PROTOCOL_MISMATCH') this.update({ connectionStatus: 'protocol-error', isReconnecting: false, error: response.message })
      else { this.update({ error: response.message }); this.later(() => this.resume(takeover), Math.min(8000, 1000 * 2 ** this.retry++)) }
      return
    }
    this.retry = 0; this.dismissedResult = null
    this.saveCredential(roomId, response.token || credential.token)
    this.apply(response.snapshot, true)
  }

  apply(snapshot, recovered = false) {
    if (!snapshot) return
    if (snapshot.protocolVersion !== PROTOCOL_VERSION) { this.update({ connectionStatus: 'protocol-error', isReconnecting: false, error: '游戏已更新，请刷新页面' }); return }
    const previous = this.state.gameState
    if (!recovered && previous?.roomId === snapshot.roomId && snapshot.revision <= previous.revision) return
    const newHand = previous?.handId !== snapshot.handId || previous?.sessionId !== snapshot.sessionId
    const incomingResult = snapshot.lastResult
    const result = incomingResult && this.state.lastResult?.handId === incomingResult.handId && this.state.lastResult?.showAllHands === incomingResult.showAllHands
      ? this.state.lastResult : incomingResult
    const atResult = ['SHOWDOWN_COMPLETE', 'GAME_OVER'].includes(snapshot.gameState)
    const show = result && atResult && (recovered || result.handId !== this.dismissedResult)
    this.update({ gameState: snapshot, room: { id: snapshot.roomId }, privateCards: snapshot.privateCards || [],
      playerId: snapshot.self.playerId, isRoomCreator: snapshot.creator === snapshot.self.playerId, isSpectator: snapshot.self.role === 'spectator',
      roomSettings: snapshot.settings, lastResult: result, handResult: show ? result : newHand || recovered ? null : this.state.handResult,
      connectionStatus: 'synced', isReconnecting: false, isConnected: true, error: recovered ? null : this.state.error,
      recoveryVersion: this.state.recoveryVersion + (recovered ? 1 : 0),
      serverOffset: snapshot.serverNow - this.clock.now(),
    })
  }

  home = () => {
    this.epoch++; this.clearTimers(); this.entering = false; this.homeChosen = true; this.target = null; this.tabStorage.setItem(TARGET, '__home__')
    // Detach any seat on this connection via a real disconnect; do not erase a
    // credential shared with a different tab. Its current hand remains valid.
    if (this.raw.connected) this.raw.disconnect()
    this.update({ ...empty, connectionStatus: 'connected', isReconnecting: false })
    if (this.running) this.raw.connect()
  }

  async command(event, payload = {}) {
    const entry = event === 'createRoom' || event === 'createTraining' || event === 'joinRoom'
    if (this.entering || !this.raw.connected || (!entry && this.state.connectionStatus !== 'synced') || (entry && this.state.connectionStatus !== 'connected')) {
      this.update({ error: '请等待连接与身份同步完成后再操作' }); return { ok: false, code: 'NOT_READY' }
    }
    if (event === 'joinRoom' && this.credential(payload.roomId)) { this.target = payload.roomId; this.tabStorage.setItem(TARGET, payload.roomId); return this.resume() }
    const epoch = this.epoch
    const args = { ...payload, protocolVersion: PROTOCOL_VERSION, requestId: this.uuid(),
      generation: this.state.gameState?.self.generation, ...(event === 'playerAction' ? { handId: this.state.gameState?.handId, turnId: this.state.gameState?.turnId } : {}) }
    if (entry) { this.entering = true; this.homeChosen = false }
    const response = await this.request(event, args)
    if (epoch !== this.epoch || !this.running) return null
    if (entry) this.entering = false
    if (!response) {
      if (entry) {
        // Entry commands are idempotent on the same socket. Retry the exact
        // request once to recover credentials if only its acknowledgement was lost.
        this.entering = true
        const retry = await this.request(event, args)
        this.entering = false
        if (epoch !== this.epoch) return null
        if (retry?.ok) { this.saveCredential(retry.snapshot.roomId, retry.token); this.apply(retry.snapshot, true); return retry }
        if (this.state.gameState) {
          const state = this.state.gameState
          const synced = await this.request('syncSession', { protocolVersion: PROTOCOL_VERSION, requestId: this.uuid(), roomId: state.roomId, generation: state.self.generation })
          if (epoch !== this.epoch) return null
          if (synced?.ok && synced.token) { this.saveCredential(state.roomId, synced.token); this.apply(synced.snapshot, true); return synced }
        }
      } else {
        const snapshot = this.state.gameState
        const status = await this.request('commandStatus', { protocolVersion: PROTOCOL_VERSION, requestId: this.uuid(), roomId: snapshot?.roomId, generation: snapshot?.self.generation, commandRequestId: args.requestId })
        if (epoch !== this.epoch) return null
        if (status?.snapshot) this.apply(status.snapshot, true)
        if (status?.commandResult?.ok) { if (status.commandResult.left || status.commandResult.closed) this.home(); return status.commandResult }
      }
      this.update({ error: '操作确认未收到，未自动重放操作。请同步后重试。' })
      if (!entry && this.target) this.resume()
      return null
    }
    if (!response.ok) {
      if (response.code === 'PROTOCOL_MISMATCH') this.update({ connectionStatus: 'protocol-error', error: response.message })
      else this.update({ error: response.message })
      if (['STALE_TURN', 'SESSION_STALE'].includes(response.code)) this.resume()
      return response
    }
    if (response.left || response.closed) { this.home(); return response }
    if (entry && response.token) this.saveCredential(response.snapshot.roomId, response.token)
    this.apply(response.snapshot)
    return response
  }
  leaveRoom = () => this.command('leaveRoom', { roomId: this.state.room?.id })
}
