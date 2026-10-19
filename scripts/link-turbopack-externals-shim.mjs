/**
 * Next/Turbopack externalizes some deps as `<name>-<hash>` (and
 * `@scope/<name>-<hash>`). On a 2GB Linux host we copy `.next` from a laptop
 * pack and run `next start` — those virtual names are missing, so we create
 * tiny re-export packages that point at the real installs.
 *
 * Usage (repo root, after syncing .next):
 *   node scripts/link-turbopack-externals-shim.mjs
 */
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const nextServer = join(root, '.next', 'server');
const nm = join(root, 'node_modules');

if (!existsSync(nextServer)) {
  console.error('Missing .next/server — sync deploy/standalone/.next first.');
  process.exit(1);
}
if (!existsSync(nm)) {
  console.error('Missing node_modules — run pnpm install.');
  process.exit(1);
}

/**
 * Match Turbopack externals: `sharp-<16hex>` and `@prisma/client-<16hex>`.
 * Require the name to start with a letter (skip UUID-looking noise).
 */
const hashedPkgRe =
  /(?:^|["'`( ])(@?[a-zA-Z][a-zA-Z0-9._-]*(?:\/[a-zA-Z][a-zA-Z0-9._-]*)?-[a-f0-9]{12,16})(?:["'`)/]|$)/g;

const hashed = new Set();

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
    while ((m = hashedPkgRe.exec(text))) {
      hashed.add(m[1]);
    }
  }
}

walk(nextServer);

/** Strip trailing -<hex> from the last segment → real package name. */
function realPackageName(hashedName) {
  const parts = hashedName.split('/');
  const last = parts[parts.length - 1];
  const stripped = last.replace(/-[a-f0-9]{8,}$/i, '');
  if (stripped === last) return null;
  parts[parts.length - 1] = stripped;
  return parts.join('/');
}

function packageExists(pkg) {
  return existsSync(join(nm, ...pkg.split('/')));
}

/**
 * Write a real mini-package (not a symlink). Symlinks break under pnpm + ESM
 * (`import('sharp-hash')` → ERR_MODULE_NOT_FOUND even when the link exists).
 */
function writeShim(hashedName, realName) {
  if (!packageExists(realName)) {
    console.warn(`Skip ${hashedName}: real package ${realName} not installed`);
    return false;
  }

  const shimPath = join(nm, ...hashedName.split('/'));
  rmSync(shimPath, { recursive: true, force: true });
  mkdirSync(shimPath, { recursive: true });

  // Scoped deep paths like @prisma/client-HASH must re-export the parent package
  // and also expose ./runtime/* — mirror by pointing package.json exports at real.
  const isScopedDeep = hashedName.includes('/');

  writeFileSync(
    join(shimPath, 'package.json'),
    JSON.stringify(
      {
        name: hashedName,
        version: '0.0.0-shim',
        private: true,
        type: 'commonjs',
        main: 'index.js',
        exports: {
          '.': './index.js',
          './package.json': './package.json',
          './*': './*',
        },
      },
      null,
      2
    )
  );

  writeFileSync(
    join(shimPath, 'index.js'),
    `'use strict';\nmodule.exports = require(${JSON.stringify(realName)});\n`
  );

  // For @prisma/client-HASH/runtime/client — create runtime re-exports.
  if (isScopedDeep || realName === '@prisma/client' || realName === 'sharp') {
    const realRuntime = join(nm, ...realName.split('/'), 'runtime');
    if (existsSync(realRuntime)) {
      const runtimeDir = join(shimPath, 'runtime');
      mkdirSync(runtimeDir, { recursive: true });
      // Proxy files commonly requested by Turbopack.
      for (const file of readdirSync(realRuntime)) {
        if (!/\.(js|mjs|cjs|json|wasm)$/i.test(file) && !file.endsWith('.node')) {
          continue;
        }
        const target = join(realName, 'runtime', file).replace(/\\/g, '/');
        // require/import path from shim runtime file → real package runtime file
        if (file.endsWith('.mjs')) {
          writeFileSync(
            join(runtimeDir, file),
            `export * from ${JSON.stringify(target)};\nexport { default } from ${JSON.stringify(target)};\n`
          );
        } else if (file.endsWith('.js') || file.endsWith('.cjs')) {
          writeFileSync(
            join(runtimeDir, file),
            `'use strict';\nmodule.exports = require(${JSON.stringify(target)});\n`
          );
        }
      }
    }
  }

  // Also drop a copy under .next/node_modules for resolvers that start from chunks/.
  const nextNm = join(root, '.next', 'node_modules', ...hashedName.split('/'));
  rmSync(nextNm, { recursive: true, force: true });
  mkdirSync(dirname(nextNm), { recursive: true });
  // Cheap: duplicate the shim package.json + index (runtime optional).
  mkdirSync(nextNm, { recursive: true });
  writeFileSync(
    join(nextNm, 'package.json'),
    JSON.stringify(
      {
        name: hashedName,
        version: '0.0.0-shim',
        private: true,
        type: 'commonjs',
        main: 'index.js',
        exports: { '.': './index.js', './package.json': './package.json' },
      },
      null,
      2
    )
  );
  writeFileSync(
    join(nextNm, 'index.js'),
    `'use strict';\nmodule.exports = require(${JSON.stringify(realName)});\n`
  );

  console.log(`Shimmed ${hashedName} → ${realName}`);
  return true;
}

let linked = 0;
let skipped = 0;

for (const id of [...hashed].sort()) {
  const real = realPackageName(id);
  if (!real) {
    skipped++;
    continue;
  }
  if (writeShim(id, real)) linked++;
  else skipped++;
}

// Always ensure known hashes from the current Windows pack (scan can miss ESM import forms).
for (const [hash, real] of Object.entries({
  'sharp-9b5cd53f6851c3b7': 'sharp',
  '@prisma/client-24e0c89f9a65f861': '@prisma/client',
})) {
  if (writeShim(hash, real)) linked++;
}

console.log(`Done. shimmed≈${linked} skipped=${skipped} scanned=${hashed.size}`);
