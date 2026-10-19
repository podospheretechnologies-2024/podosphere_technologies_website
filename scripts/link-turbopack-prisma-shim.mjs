/**
 * Next/Turbopack externalizes Prisma as `@prisma/client-<hash>/runtime/...`.
 * That virtual package exists only in the build machine's resolution graph.
 * On a 2GB Linux host we copy `.next` from a laptop pack and run `next start`
 * against the server's real `@prisma/client` — so we shim the hashed name.
 *
 * Usage (from repo root, after syncing .next):
 *   node scripts/link-turbopack-prisma-shim.mjs
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync, symlinkSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const nextServer = join(root, '.next', 'server');
const realClient = join(root, 'node_modules', '@prisma', 'client');
const realRuntime = join(realClient, 'runtime');

if (!existsSync(nextServer)) {
  console.error('Missing .next/server — sync deploy/standalone/.next first.');
  process.exit(1);
}
if (!existsSync(realRuntime)) {
  console.error('Missing node_modules/@prisma/client/runtime — run pnpm install.');
  process.exit(1);
}

const hashRe = /@prisma\/client-([a-f0-9]{8,})/g;
const hashes = new Set();

function walk(dir) {
  for (const name of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, name.name);
    if (name.isDirectory()) {
      walk(p);
      continue;
    }
    if (!name.name.endsWith('.js')) continue;
    const text = readFileSync(p, 'utf8');
    let m;
    while ((m = hashRe.exec(text))) hashes.add(m[1]);
  }
}

walk(nextServer);

if (hashes.size === 0) {
  console.log('No hashed @prisma/client-* references found — nothing to shim.');
  process.exit(0);
}

for (const hash of hashes) {
  const pkgName = `@prisma/client-${hash}`;
  const pkgDir = join(root, 'node_modules', '@prisma', `client-${hash}`);
  const runtimeLink = join(pkgDir, 'runtime');

  rmSync(pkgDir, { recursive: true, force: true });
  mkdirSync(pkgDir, { recursive: true });
  writeFileSync(
    join(pkgDir, 'package.json'),
    JSON.stringify(
      {
        name: pkgName,
        version: '0.0.0-shim',
        private: true,
        description: 'Turbopack prisma hash shim → @prisma/client',
      },
      null,
      2
    )
  );

  // Junction/symlink whole runtime folder to the real package.
  const rel = relative(pkgDir, realRuntime);
  symlinkSync(rel, runtimeLink, process.platform === 'win32' ? 'junction' : 'dir');
  console.log(`Linked ${pkgName}/runtime → ${rel}`);
}

console.log(`Done. Shims: ${[...hashes].map((h) => `@prisma/client-${h}`).join(', ')}`);
