import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HoldemClient, play } from './client.mjs';
import Ajv from 'ajv';
import { readFile } from 'node:fs/promises';
const schema = JSON.parse(await readFile(new URL('../server/agent-schema.json', import.meta.url), 'utf8'));
const openapi = JSON.parse(await readFile(new URL('../docs/AGENT_OPENAPI.json', import.meta.url), 'utf8'));

test('OpenAPI and shared tool schemas stay identical', () => {
  assert.deepEqual(openapi.components.schemas, schema.definitions);
  const validate = new Ajv().compile(schema.definitions.action);
  const args = { requestId: 'one', handId: 'h', turnId: 't', controlVersion: 1, action: 'raise_to', amount: 20 };
  assert(validate(args)); assert(!validate({ ...args, amount: 1.5 }));
  assert(!validate({ ...args, action: 'fold' })); assert(!validate({ ...args, playerId: 'other' }));
});
test('lost acknowledgement queries original ID and replays exact body only', async () => {
  const calls = [];
  const client = new HoldemClient({ url: 'http://localhost:3000', token: 'token', fetchImpl: async (url, options) => {
    calls.push([url.pathname, options.body]);
    if (calls.length === 1) throw new TypeError('connection lost');
    return { json: async () => ({ ok: true, receipt: calls.length === 2 ? null : { executed: true } }) };
  } });
  const args = { requestId: 'a', handId: 'h', turnId: 't', controlVersion: 1, action: 'fold' };
  assert((await client.act(args)).receipt.executed);
  assert.equal(calls[1][0], '/api/agent/v1/actions/a');
  assert.equal(calls[0][1], calls[2][1]);
});
test('receipt recovery never sends a second action', async () => {
  let count = 0;
  const client = new HoldemClient({ url: 'https://example.test', token: 'token', fetchImpl: async () => {
    if (++count === 1) throw new TypeError('connection lost');
    return { json: async () => ({ ok: true, receipt: { executed: true } }) };
  } });
  await client.act({ requestId: 'a' }); assert.equal(count, 2);
});
test('client refuses insecure remote targets and embedded credentials', () => {
  for (const url of ['http://example.test', 'https://user:pass@example.test', 'https://example.test/?token=x'])
    assert.throws(() => new HoldemClient({ url, token: 'test' }));
});
test('play stops at max completed hands and releases; sitting out also stops', async () => {
  for (const sittingOut of [true, false]) {
    let release = 0;
    const o = { self: { sittingOut }, phase: 'INTERMISSION', lastResult: { handId: 'h' } };
    const client = { connect: async () => ({ observation: o }), release: async () => { release++; }, stop() {} };
    await play(client, () => { throw new Error('must not decide'); }, { maxHands: 1 });
    assert.equal(release, 1);
  }
});
