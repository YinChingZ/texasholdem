import { test } from 'node:test';
import Ajv from 'ajv';
import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { HoldemClient } from './client.mjs';
const responseSchema = JSON.parse(await readFile(new URL('../server/agent-schema.json', import.meta.url), 'utf8')).definitions.response;
const validateResponse = new Ajv().compile(responseSchema);
const require = createRequire(import.meta.url);
const { createServer } = require('../server/index.js');
const { io } = require('../client/node_modules/socket.io-client');

async function fixture(t, config = {}) {
  const instance = createServer({ config: { agentEnabled: true, nextHandMs: 100, ...config }, log() {} });
  await new Promise(resolve => instance.server.listen(0, '127.0.0.1', resolve));
  const url = `http://127.0.0.1:${instance.server.address().port}`;
  const sockets = [io(url), io(url)];
  t.after(async () => { sockets.forEach(s => s.disconnect()); await instance.close(); });
  await Promise.all(sockets.map(s => once(s, 'connect')));
  let n = 0;
  const send = (i, event, args = {}) => new Promise(resolve => sockets[i].emit(event, { protocolVersion: 2, requestId: `r${++n}`, ...args }, resolve));
  const a = await send(0, 'createRoom', { nickname: 'A' });
  const b = await send(1, 'joinRoom', { roomId: a.snapshot.roomId, nickname: 'B' });
  const identities = [a.snapshot, b.snapshot];
  const command = (i, event, args = {}) => send(i, event, { roomId: a.snapshot.roomId, generation: identities[i].self.generation, ...args });
  const grants = await Promise.all([0,1].map(i => command(i, 'createAgentGrant')));
  assert(grants.every(g => g.ok));
  return { ...instance, url, sockets, command, tokens: grants.map(g => g.agentToken), roomId: a.snapshot.roomId };
}

test('HTTP validates schemas and isolates seats; cancellation and revocation clear waiters', async t => {
  const h = await fixture(t);
  const client = new HoldemClient({ url: h.url, token: h.tokens[0] }); t.after(() => client.stop());
  const { observation: o } = await client.connect();
  assert(o.self.playerId);
  const extra = await fetch(`${h.url}/api/agent/v1/actions`, { method: 'POST', headers: { Authorization: `Bearer ${h.tokens[0]}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ playerId: 'other' }) });
  assert.equal(extra.status, 400);
  const large = await fetch(`${h.url}/api/agent/v1/connect`, { method: 'POST', headers: { Authorization: `Bearer ${h.tokens[0]}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ data: 'x'.repeat(9000) }) });
  assert.equal(large.status, 413);
  const result = await fetch(`${h.url}/api/agent/v1/observation`, { headers: { Authorization: `Bearer invalid` } });
  assert.equal(result.status, 401);
  const waiting = client.wait(o.revision);
  await new Promise(r => setTimeout(r, 30));
  const rejected = assert.rejects(waiting, { code: 'INVALID_GRANT' });
  await h.command(0, 'reclaimControl'); await rejected;
  assert.equal(h.service.agentListeners.size, 0);
  await assert.rejects(client.status('old'), { code: 'INVALID_GRANT' });
});

test('real STDIO MCP and Python HTTP client play 20 hands in one room', { timeout: 45000 }, async t => {
  const h = await fixture(t);
  const mcp = new Client({ name: 'holdem-integration', version: '1.0.0' });
  const transport = new StdioClientTransport({ command: process.execPath, args: [new URL('mcp.mjs', import.meta.url).pathname],
    env: { ...process.env, HOLDEM_API_URL: h.url, HOLDEM_AGENT_TOKEN: h.tokens[0] }, stderr: 'pipe' });
  t.after(async () => { await mcp.close(); });
  await mcp.connect(transport);
  const tools = await mcp.listTools(); assert.equal(tools.tools.length, 6);
  const call = async (name, args = {}) => {
    const result = await mcp.callTool({ name, arguments: args });
    const parsed = JSON.parse(result.content[0].text);
    assert(validateResponse(parsed), JSON.stringify(validateResponse.errors));
    return parsed;
  };
  assert((await call('connect_table')).ok);
  const python = spawn('python3', [new URL('example.py', import.meta.url).pathname], { env: { ...process.env, HOLDEM_API_URL: h.url, HOLDEM_AGENT_TOKEN: h.tokens[1], HOLDEM_MAX_HANDS: '20' }, stdio: ['ignore', 'pipe', 'pipe'] });
  let pythonOutput = ''; python.stdout.on('data', chunk => { pythonOutput += chunk }); python.stderr.on('data', chunk => { pythonOutput += chunk });
  const pythonExit = once(python, 'exit'); t.after(() => python.kill());
  await new Promise((resolve, reject) => {
    let tries = 0;
    const timer = setInterval(() => {
      const room = h.service.rooms.get(h.roomId);
      if (h.service.members(room).every(m => m.agent?.connected)) { clearInterval(timer); resolve(); }
      else if (++tries > 100) { clearInterval(timer); reject(new Error('Python did not connect')); }
    }, 30);
  });
  assert((await h.command(0, 'startGame')).ok);
  h.sockets.forEach(s => s.disconnect());
  const completed = new Set();
  for (let step = 0; step < 200 && completed.size < 20; step++) {
    const r = await call('get_observation'); assert(r.ok, JSON.stringify(r));
    const o = r.observation;
    if (o.lastResult && !completed.has(o.lastResult.handId)) { completed.add(o.lastResult.handId); if (completed.size === 20) t.diagnostic('MCP/Python completed 20 hands'); }
    if (completed.size >= 20) break;
    if (o.legalActions) {
      const acted = await call('act', { requestId: `mcp-${step}`, handId: o.handId, turnId: o.turnId, controlVersion: o.self.controlVersion, action: 'fold' });
      assert(acted.ok, JSON.stringify(acted));
    } else await call('wait_for_turn', { revision: o.revision });
  }
  assert.equal(completed.size, 20, `Python output: ${pythonOutput}`);
  assert((await call('release_control')).ok);
  assert.equal((await pythonExit)[0], 0);
  const room = h.service.rooms.get(h.roomId);
  assert.equal(h.service.members(room).reduce((sum,m) => sum + m.player.chips,0), 2000);
  assert.equal(h.service.agentGrants.size, 0);
});
