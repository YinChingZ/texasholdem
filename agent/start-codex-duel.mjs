#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
const args = [
  '-c', `mcp_servers.holdem.command=${JSON.stringify(process.execPath)}`,
  '-c', `mcp_servers.holdem.args=${JSON.stringify([new URL('mcp.mjs', import.meta.url).pathname])}`,
  '-c', `mcp_servers.holdem.env.HOLDEM_API_URL=${JSON.stringify(process.env.HOLDEM_API_URL || 'https://texasholdem-elub.onrender.com')}`,
  '-c', `mcp_servers.holdem.env.HOLDEM_AGENT_TOKEN_FILE=${JSON.stringify(join(process.env.HOLDEM_SEAT_DIR || join(homedir(), '.config', 'holdem'), 'codex.token'))}`,
  '-c', 'mcp_servers.holdem.tool_timeout_sec=45',
  readFileSync(new URL('prompts/duel.zh.md', import.meta.url), 'utf8'),
];
const child = spawn(process.env.CODEX_BIN || 'codex', args, { stdio: 'inherit' });
child.on('exit', code => { process.exitCode = code ?? 1; });
