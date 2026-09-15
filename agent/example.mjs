import { HoldemClient, play } from './client.mjs';
const controller = new AbortController();
process.on('SIGINT', () => controller.abort());
try {
  await play(new HoldemClient(), async observation => {
    // Replace this function with your own Agent. No model credentials go to the game server.
    return { action: observation.legalActions.check ? 'check' : 'fold' };
  }, { maxHands: Number(process.env.HOLDEM_MAX_HANDS || 20), signal: controller.signal });
} catch (error) { console.error(error.code || 'CLIENT_ERROR'); process.exitCode = 1; }
