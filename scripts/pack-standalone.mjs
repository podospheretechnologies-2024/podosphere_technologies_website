/**
 * After `next build` (output: 'standalone'), assemble a runnable folder at
 * deploy/standalone for hosts that cannot run `pnpm build`.
 */
import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const standaloneSrc = join(root, '.next', 'standalone');
const staticSrc = join(root, '.next', 'static');
const publicSrc = join(root, 'public');
const outDir = join(root, 'deploy', 'standalone');

if (!existsSync(standaloneSrc)) {
  console.error('Missing .next/standalone — run `pnpm build` with output: "standalone" first.');
  process.exit(1);
}
if (!existsSync(staticSrc)) {
  console.error('Missing .next/static — build did not produce static assets.');
  process.exit(1);
}

rmSync(outDir, { recursive: true, force: true });
mkdirSync(join(root, 'deploy'), { recursive: true });
cpSync(standaloneSrc, outDir, { recursive: true });

mkdirSync(join(outDir, '.next'), { recursive: true });
cpSync(staticSrc, join(outDir, '.next', 'static'), { recursive: true });

if (existsSync(publicSrc)) {
  cpSync(publicSrc, join(outDir, 'public'), { recursive: true });
}

console.log('Packed deploy/standalone — start with: node deploy/standalone/server.js');
console.log('Set PORT / HOSTNAME / APP_URL in the process environment as needed.');
