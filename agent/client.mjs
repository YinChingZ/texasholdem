import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';

export class AgentError extends Error {
  constructor(result) { super(result.message || result.code); this.code = result.code; }
}
export class HoldemClient {
  constructor({ url = process.env.HOLDEM_API_URL, token = process.env.HOLDEM_AGENT_TOKEN, tokenFile = process.env.HOLDEM_AGENT_TOKEN_FILE, fetchImpl = fetch } = {}) {
    const endpoint = new URL(url);
    if (endpoint.username || endpoint.password || endpoint.search || endpoint.hash ||
      (endpoint.protocol !== 'https:' && !(endpoint.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(endpoint.hostname))))
      throw new Error('Use HTTPS, or HTTP on localhost only.');
    if (!token && !tokenFile) throw new Error('HOLDEM_AGENT_TOKEN or HOLDEM_AGENT_TOKEN_FILE is required');
    this.base = new URL('/api/agent/v1/', endpoint); this.token = token; this.tokenFile = tokenFile; this.fetch = fetchImpl;
    this.observation = null; this.timer = null; this.heartbeatBusy = false;
  }
  async request(path, method = 'GET', body, signal, retries = 2) {
    for (let attempt = 0; ; attempt++) {
      try {
        let token = this.token;
        if (this.tokenFile) {
          try { token = readFileSync(this.tokenFile, 'utf8').trim(); }
          catch { throw new AgentError({ code: 'CREDENTIAL_REQUIRED', message: '座位凭证尚未就绪，请先创建房间或保存座位凭证。' }); }
        }
        if (!token) throw new AgentError({ code: 'CREDENTIAL_REQUIRED', message: '座位凭证为空' });
        const response = await this.fetch(new URL(path, this.base), {
          method, headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
          body: body ? JSON.stringify(body) : undefined, redirect: 'error',
          signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(30000)]) : AbortSignal.timeout(30000),
        });
        const result = await response.json();
        if (!result.ok) throw new AgentError(result);
        if (result.observation) this.observation = result.observation;
        return result;
      } catch (error) {
        if (error instanceof AgentError) {
          if (['INVALID_GRANT', 'AGENT_DISABLED', 'ROOM_GONE', 'CONTROL_LOST'].includes(error.code)) this.stop();
          throw error;
        }
        if (signal?.aborted || attempt >= retries) throw error;
        await new Promise(resolve => setTimeout(resolve, 300 * 2 ** attempt));
      }
    }
  }
  async connect() {
    const result = await this.request('connect', 'POST', {});
    if (!this.timer) {
      this.timer = setInterval(async () => {
        if (this.heartbeatBusy) return;
        this.heartbeatBusy = true;
        try { await this.request('heartbeat', 'POST', {}); } catch { /* Main request reports loss to the caller. */ }
        finally { this.heartbeatBusy = false; }
      }, 20000);
      this.timer.unref?.();
    }
    return result;
  }
  observe() { return this.request('observation'); }
  wait(revision = this.observation?.revision ?? 0, signal) { return this.request(`wait?revision=${revision}`, 'GET', undefined, signal); }
  status(requestId) { return this.request(`actions/${encodeURIComponent(requestId)}`); }
  async act(args) {
    // A caller supplies the observation identifiers it actually reasoned over. Never substitute a newer turn.
    try { return await this.request('actions', 'POST', args, undefined, 0); }
    catch (error) {
      if (error instanceof AgentError) throw error;
      const status = await this.status(args.requestId);
      if (status.receipt) return status;
      // Exact same ID and turn only. The server will fence a stale or revoked action.
      return this.request('actions', 'POST', args);
    }
  }
  actionArgs(observation, action, amount) {
    return { requestId: randomUUID(), handId: observation.handId, turnId: observation.turnId,
      controlVersion: observation.self.controlVersion, action, ...(amount == null ? {} : { amount }) };
  }
  async release() { this.stop(); return this.request('release', 'POST', {}, undefined, 0); }
  stop() { clearInterval(this.timer); this.timer = null; }
}

// Supply your own async decision function. It receives only the authorized observation.
export async function play(client, decide, { maxHands = 20, signal } = {}) {
  const hands = new Set();
  let result = await client.connect();
  try {
    while (!signal?.aborted) {
      const o = result.observation;
      if (!o || o.self.sittingOut || ['ENDED', 'ERROR'].includes(o.phase)) break;
      if (o.lastResult?.handId) hands.add(o.lastResult.handId);
      if (hands.size >= maxHands) break;
      if (o.legalActions) {
        const decision = await decide(o);
        if (signal?.aborted) break;
        try { result = await client.act(client.actionArgs(o, decision.action, decision.amount)); }
        catch (error) {
          if (error.code !== 'STALE_TURN') throw error;
          result = await client.observe();
        }
      } else result = await client.wait(o.revision, signal);
    }
  } finally {
    try { await client.release(); } catch { client.stop(); }
  }
}
