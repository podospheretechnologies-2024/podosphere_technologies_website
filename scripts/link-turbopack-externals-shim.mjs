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
 * Node ESM `import('sharp-<hash>')` from `.next/server/chunks/*.js` only walks
 * node_modules from that folder upward. Put the shim in every hop.
 */
const shimRoots = [
  nm,
  join(root, '.next', 'node_modules'),
  join(root, '.next', 'server', 'node_modules'),
  join(root, '.next', 'server', 'chunks', 'node_modules'),
  join(root, '.next', 'server', 'chunks', 'ssr', 'node_modules'),
];

function writePrismaRuntimeShims(shimPath) {
  const realRuntime = join(nm, '@prisma', 'client', 'runtime');
  if (!existsSync(realRuntime)) return;
  const runtimeDir = join(shimPath, 'runtime');
  mkdirSync(runtimeDir, { recursive: true });
  for (const file of readdirSync(realRuntime)) {
    if (!/\.(js|mjs|cjs)$/i.test(file)) continue;
    // Keep the filename (including .mjs). ESM does not add extensions, so
    // `@prisma/client/runtime/query_compiler_fast_bg.mysql` 404s while
    // `@prisma/client/runtime/query_compiler_fast_bg.mysql.mjs` resolves.
    const target = `@prisma/client/runtime/${file}`;
    if (file.endsWith('.mjs')) {
      writeFileSync(
        join(runtimeDir, file),
        `export * from ${JSON.stringify(target)};\nimport * as __mod from ${JSON.stringify(target)};\nexport default __mod.default ?? __mod;\n`
      );
    } else {
      writeFileSync(
        join(runtimeDir, file),
        `'use strict';\nmodule.exports = require(${JSON.stringify(target)});\n`
      );
    }
  }
}

function writeShimPackage(destRoot, hashedName, realName) {
  const shimPath = join(destRoot, ...hashedName.split('/'));
  rmSync(shimPath, { recursive: true, force: true });
  mkdirSync(shimPath, { recursive: true });

  const isPrisma = realName === '@prisma/client';
  if (isPrisma) writePrismaRuntimeShims(shimPath);

  writeFileSync(
    join(shimPath, 'package.json'),
    JSON.stringify(
      {
        name: hashedName,
        version: '0.0.0-shim',
        private: true,
        main: './index.cjs',
        exports: {
          '.': {
            require: './index.cjs',
            import: './index.mjs',
            default: './index.cjs',
          },
          './package.json': './package.json',
          './runtime/client': {
            require: './runtime/client.js',
            import: './runtime/client.mjs',
            default: './runtime/client.js',
          },
          './runtime/query_compiler_fast_bg.mysql.mjs': './runtime/query_compiler_fast_bg.mysql.mjs',
          './runtime/query_compiler_fast_bg.mysql.wasm-base64.mjs':
            './runtime/query_compiler_fast_bg.mysql.wasm-base64.mjs',
          './*': './*',
        },
      },
      null,
      2
    )
  );
  writeFileSync(
    join(shimPath, 'index.cjs'),
    `'use strict';\nmodule.exports = require(${JSON.stringify(realName)});\n`
  );
  writeFileSync(
    join(shimPath, 'index.mjs'),
    `import { createRequire } from 'node:module';\nconst require = createRequire(import.meta.url);\nconst mod = require(${JSON.stringify(realName)});\nexport default mod;\n`
  );
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

  for (const destRoot of shimRoots) {
    mkdirSync(destRoot, { recursive: true });
    writeShimPackage(destRoot, hashedName, realName);
  }

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
