#!/usr/bin/env node
/**
 * Runs the Prisma CLI with DATABASE_URL / DIRECT_URL taken from apps/web/.env.local
 * when they are not already set (local use). Deploy environments that set real
 * env vars are unaffected. Usage: node scripts/prisma-with-app-env.mjs migrate deploy
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const envFiles = [resolve(here, '../../../.env'), resolve(here, '../../../apps/web/.env.local')];
const KEYS = new Set(['DATABASE_URL', 'DIRECT_URL']);

for (const file of envFiles) {
  if (!existsSync(file)) continue;
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const match = /^\s*(?:export\s+)?([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (!match || !KEYS.has(match[1]) || process.env[match[1]]) continue;
    let value = match[2];
    if (/^(['"]).*\1$/.test(value)) value = value.slice(1, -1);
    if (value) process.env[match[1]] = value;
  }
}

for (const key of KEYS) {
  if (!process.env[key]) {
    console.error(`${key} is not set. Add it to apps/web/.env.local (or export it) and retry.`);
    process.exit(1);
  }
}

const localBin = resolve(here, '../node_modules/.bin', process.platform === 'win32' ? 'prisma.cmd' : 'prisma');
const command = existsSync(localBin) ? localBin : 'prisma';
const result = spawnSync(command, process.argv.slice(2), { stdio: 'inherit', env: process.env, shell: process.platform === 'win32' });
if (result.error) {
  console.error(`Could not run Prisma: ${result.error.message}`);
}
process.exit(result.status ?? 1);
