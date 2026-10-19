/**
 * Start the packed Next standalone server while keeping repo-root `.env` loaded.
 * `deploy/standalone/server.js` chdirs into its own folder; without this preload,
 * PM2 would lose DATABASE_URL / secrets that live next to ecosystem.config.cjs.
 *
 * Usage: node scripts/run-standalone-web.cjs
 *        (or via ecosystem.config.cjs → podo-social-web)
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const envPath = path.join(root, '.env');
const serverPath = path.join(root, 'deploy', 'standalone', 'server.js');

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  const text = fs.readFileSync(filePath, 'utf8');
  for (const rawLine of text.split(/\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

loadEnvFile(envPath);

if (!process.env.PORT) process.env.PORT = '3100';
if (!process.env.HOSTNAME) process.env.HOSTNAME = '0.0.0.0';
process.env.NODE_ENV = 'production';

if (!fs.existsSync(serverPath)) {
  console.error(
    'Missing deploy/standalone/server.js — run `pnpm build:deploy` before starting the web process.'
  );
  process.exit(1);
}

require(serverPath);
