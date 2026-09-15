const express = require('express');
const Ajv = require('ajv');
const schema = require('./agent-schema.json');
const ajv = new Ajv();
const validators = Object.fromEntries(Object.entries(schema.definitions).map(([key, value]) => [key, ajv.compile(value)]));
const statusFor = code => ['INVALID_GRANT', 'AGENT_DISABLED'].includes(code) ? 401 : code === 'ROOM_GONE' ? 410 : code === 'RATE_LIMIT' ? 429 : ['INVALID_REQUEST', 'INVALID_ACTION', 'REQUEST_REQUIRED'].includes(code) ? 400 : 409;

function agentRouter(service) {
  const router = express.Router();
  // A bounded IP bucket also limits unauthenticated traffic. Deployment proxy policy is configured separately.
  const buckets = new Map();
  router.use((req, res, next) => {
    res.set('Cache-Control', 'no-store');
    const now = Date.now(), key = req.ip;
    let bucket = buckets.get(key);
    if (!bucket || now - bucket.at >= 60000) { bucket = { at: now, n: 0 }; buckets.set(key, bucket); }
    if (buckets.size > 4096) buckets.delete(buckets.keys().next().value);
    if (++bucket.n > 600) return res.status(429).json({ ok: false, code: 'RATE_LIMIT', message: '请求过于频繁' });
    next();
  });
  router.use(express.json({ limit: '8kb', strict: true }));
  const route = (method, path, command, input = 'empty') => router[method](path, async (req, res) => {
    const args = command === 'wait' ? { revision: /^\d+$/.test(req.query.revision || '') ? Number(req.query.revision) : null }
      : command === 'status' ? { requestId: req.params.requestId } : req.body || {};
    if (!validators[input](args) || (method === 'get' && Object.keys(req.query).some(k => command !== 'wait' || k !== 'revision'))) {
      return res.status(400).json({ ok: false, code: 'INVALID_REQUEST', message: '参数不符合 Agent API v1' });
    }
    const token = /^Bearer ([A-Za-z0-9_-]+)$/.exec(req.get('authorization') || '')?.[1];
    const controller = new AbortController();
    const cancel = () => controller.abort();
    res.on('close', cancel);
    const result = command === 'wait' ? await service.waitAgent(token, args.revision, controller.signal) : service.agentCommand(token, command, args);
    res.off('close', cancel);
    if (!res.destroyed) res.status(result.ok ? 200 : statusFor(result.code)).json(result);
  });
  route('post', '/connect', 'connect'); route('get', '/observation', 'observation');
  route('get', '/wait', 'wait', 'wait'); route('post', '/heartbeat', 'heartbeat');
  route('post', '/actions', 'action', 'action'); route('get', '/actions/:requestId', 'status', 'status');
  route('post', '/release', 'release');
  router.use((error, _req, res, _next) => res.status(error.status === 413 ? 413 : 400).json({ ok: false, code: 'INVALID_REQUEST', message: '请求格式或大小无效' }));
  return router;
}
module.exports = { agentRouter };
