#!/usr/bin/env node
// Create two ordinary seats and keep their browser-side sessions alive.
// The two MCP clients get different, seat-scoped credentials; no model key is read.
import { createRequire } from 'node:module';
import { mkdir, writeFile, rename } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
const require = createRequire(import.meta.url);
const { io } = require('../client/node_modules/socket.io-client');
const url = process.env.HOLDEM_API_URL || 'https://texasholdem-elub.onrender.com';
const site = process.env.HOLDEM_SITE_URL || 'https://texasholdem.top';
const folder = process.env.HOLDEM_SEAT_DIR || join(homedir(), '.config', 'holdem');
const parsed = new URL(url);
if (parsed.protocol !== 'https:' && !(parsed.protocol === 'http:' && ['localhost','127.0.0.1'].includes(parsed.hostname))) throw new Error('HTTPS or localhost required');
const sockets = [io(url, { autoConnect: false, transports: ['websocket'] }), io(url, { autoConnect: false, transports: ['websocket'] })];
let roomId, identities = [], started = false, startPending = false, ending = false;
const hands = new Set();
const send = (index, event, args = {}) => new Promise((resolve, reject) => {
  sockets[index].timeout(15000).emit(event, { protocolVersion: 2, requestId: randomUUID(), roomId,
    generation: identities[index]?.self.generation, ...args }, (err, result) => {
    if (err) reject(new Error(`${event} 请求超时`));
    else if (!result?.ok) reject(Object.assign(new Error(result?.message || '请求失败'), { code: result?.code }));
    else { if (result.snapshot) identities[index] = result.snapshot; resolve(result); }
  });
});
const stop = async () => {
  if (ending) return; ending = true;
  await Promise.allSettled(identities.map((_, i) => send(i, 'reclaimControl')));
  sockets.forEach(socket => socket.disconnect());
  process.stdin.pause();
};
const start = async () => {
  if (started || startPending || ending) return;
  startPending = true;
  try { await send(0, 'startGame'); started = true; console.log('双方开始对战。输入 stop 可结束托管。'); }
  catch (error) { console.error(error.code || 'START_FAILED'); }
  finally { startPending = false; }
};
process.on('SIGINT', () => stop()); process.on('SIGTERM', () => stop());
process.stdin.setEncoding('utf8');
process.stdin.on('data', data => { if (data.trim() === 'stop') stop(); else if (!started) start(); });
try {
  await Promise.all(sockets.map(socket => new Promise((resolve, reject) => {
    socket.on('sessionProbe', (_args, ack) => ack({ alive: true }));
    socket.once('connect', resolve); socket.once('connect_error', reject); socket.connect();
  })));
  const created = await send(0, 'createRoom', { nickname: 'Codex' }); roomId = created.snapshot.roomId;
  await send(1, 'joinRoom', { nickname: 'DeepSeek Harness' });
  await send(0, 'updateRoomSettings', { settings: { turnMs: 120000, showAllHands: false } });
  await mkdir(folder, { recursive: true, mode: 0o700 });
  for (const [i, name] of ['codex','deepseek'].entries()) {
    const grant = await send(i, 'createAgentGrant');
    const path = join(folder, `${name}.token`), temporary = `${path}.${randomUUID()}.tmp`;
    await writeFile(temporary, grant.agentToken, { mode: 0o600 }); await rename(temporary, path);
  }
  await writeFile(join(folder, 'room.json'), JSON.stringify({ roomId, url, site, createdAt: new Date().toISOString() }, null, 2), { mode: 0o600 });
  console.log(`房间：${roomId}\n网页：${site}/?room=${roomId}\n两个座位凭证已分别保存。请在两个 harness 中发送连接 Prompt。\n双方连接后自动开局；保持此窗口打开。Ctrl+C 或输入 stop 撤销托管。`);
  sockets.forEach((socket, index) => socket.on('roomSnapshot', snapshot => {
    identities[index] = snapshot;
    if (index !== 0) return;
    if (snapshot.phase === 'LOBBY' && snapshot.players.filter(p => p.agentControlled).length === 2) start();
    if (snapshot.lastResult && !hands.has(snapshot.lastResult.handId)) {
      hands.add(snapshot.lastResult.handId);
      console.log(`完成第 ${hands.size} 手：${snapshot.players.map(p => `${p.nickname} ${p.chips}`).join(' / ')}`);
      if (hands.size >= 20 && snapshot.phase !== 'ENDED') send(0, 'endGame').catch(() => {});
    }
    if (snapshot.phase === 'ENDED') console.log('本场已结束；座位授权已撤销。');
  }));
} catch (error) {
  console.error(`无法准备对战：${error.code || error.message}`);
  await stop(); process.exitCode = 1;
}
