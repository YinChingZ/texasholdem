const express = require('express');
const http = require('node:http');
const { Server } = require('socket.io');
const cors = require('cors');
const { RoomService } = require('./room-service');

const allowedOrigins = [
  'https://texasholdem-beige.vercel.app', 'https://texasholdem.top', 'https://www.texasholdem.top',
  'http://localhost:5173',
];
const commands = ['createAgentGrant', 'reclaimControl', 'createTraining', 'saveObservation', 'dismissObservation', 'fastForward', 'getTrainingReport', 'createRoom', 'joinRoom', 'startGame', 'playerAction', 'prepareNextHand', 'pauseGame',
  'resumeGame', 'endGame', 'resetGame', 'closeRoom', 'leaveRoom', 'switchToPlayer', 'switchToSpectator',
  'returnToTable', 'releaseSeat', 'updateRoomSettings', 'updateInitialChips', 'sendMessage', 'syncSession', 'commandStatus'];

function createServer({ config = {}, log = (event, fields) => console.info(JSON.stringify({ event, ...fields })) } = {}) {
  const app = express();
  app.use(cors({ origin: allowedOrigins, credentials: true }));
  app.get('/health', (_req, res) => res.json({ ok: true, protocolVersion: 2 }));
  const server = http.createServer(app);
  const io = new Server(server, { cors: { origin: allowedOrigins, credentials: true } });
  const transport = {
    emit: (socketId, event, payload) => io.to(socketId).emit(event, payload),
    isConnected: socketId => !!io.sockets.sockets.get(socketId)?.connected,
    probe: (socketId, timeout) => new Promise(resolve => {
      const socket = io.sockets.sockets.get(socketId);
      if (!socket?.connected) return resolve(false);
      socket.timeout(timeout).emit('sessionProbe', {}, (error, response) => resolve(!error && response?.alive === true));
    }),
  };
  const service = new RoomService({ transport, config, log });
  app.use('/api/agent/v1', require('./agent-http').agentRouter(service));
  io.on('connection', socket => {
    for (const command of commands) socket.on(command, (args, ack) => {
      const response = service.dispatch(socket.id, command, args || {});
      if (typeof ack === 'function') ack(response);
      else if (!response.ok) socket.emit('error', response);
    });
    socket.on('resumeSession', async (args, ack) => {
      const response = await service.resume(socket.id, args || {});
      if (typeof ack === 'function') ack(response);
    });
    socket.on('attemptReconnect', (_args, ack) => {
      const error = { ok: false, code: 'PROTOCOL_MISMATCH', message: '游戏已更新，请刷新页面' };
      if (typeof ack === 'function') ack(error);
      socket.emit('reconnectFailed', error);
    });
    socket.on('disconnect', () => service.disconnect(socket.id));
  });
  return { server, io, service, close: async () => { service.dispose(); await new Promise(resolve => io.close(resolve)); } };
}

if (require.main === module) {
  const envMs = (name, fallback) => {
    const value = Number(process.env[name]);
    return process.env[name] != null && Number.isFinite(value) && value >= 0 ? value : fallback;
  };
  const instance = createServer({ config: {
    agentEnabled: process.env.AGENT_ENABLED === 'true',
    turnMs: envMs('TURN_TIMEOUT_MS', 45000), nextHandMs: envMs('NEXT_HAND_MS', 8000),
    runoutMs: envMs('PACING_MS', 600), hostGraceMs: envMs('HOST_GRACE_MS', 30000),
    probeMs: envMs('SESSION_PROBE_MS', 3000), idleMs: envMs('ROOM_IDLE_MS', 1800000),
  } });
  process.on('SIGHUP', () => instance.service.setAgentEnabled(false));
  instance.server.listen(process.env.PORT || 3000, () => console.info(`Server listening on ${process.env.PORT || 3000}`));
}
module.exports = { createServer };
