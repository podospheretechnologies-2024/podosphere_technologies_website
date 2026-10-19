/**
 * Next/Turbopack externalizes some deps as `<name>-<hash>` (and
 * `@scope/<name>-<hash>`). Those virtual package names exist only in the
 * build machine's resolution graph. On a 2GB Linux host we copy `.next`
 * from a laptop pack and run `next start` against real packages — so we
 * shim every hashed id found in `.next` back to the real package.
 *
 * Usage (repo root, after syncing .next):
 *   node scripts/link-turbopack-externals-shim.mjs
 */
import {
  existsSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, relative } from 'node:path';
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
      const id = m[1];
      // Skip paths that look like file hashes / chunk names with extensions.
      if (id.includes('.') && !id.startsWith('@')) continue;
      hashed.add(id);
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

function ensureShim(hashedName, realName) {
  const shimPath = join(nm, ...hashedName.split('/'));
  const realPath = join(nm, ...realName.split('/'));

  if (!existsSync(realPath)) {
    console.warn(`Skip ${hashedName}: real package ${realName} not installed`);
    return false;
  }

  // Already a correct symlink?
  try {
    const st = lstatSync(shimPath);
    if (st.isSymbolicLink()) {
      console.log(`OK (symlink) ${hashedName}`);
      return true;
    }
  } catch {
    // missing
  }

  rmSync(shimPath, { recursive: true, force: true });
  mkdirSync(dirname(shimPath), { recursive: true });

  // Prefer directory symlink of the whole package (works for sharp, pg, …).
  // For scoped hashes like @prisma/client-HASH where we only need runtime,
  // full-package symlink still works if realName is @prisma/client.
  const rel = relative(dirname(shimPath), realPath);
  try {
    symlinkSync(rel, shimPath, process.platform === 'win32' ? 'junction' : 'dir');
    console.log(`Linked ${hashedName} → ${realName}`);
    return true;
  } catch (error) {
    // Fallback: tiny package that re-exports.
    mkdirSync(shimPath, { recursive: true });
    writeFileSync(
      join(shimPath, 'package.json'),
      JSON.stringify(
        {
          name: hashedName,
          version: '0.0.0-shim',
          private: true,
          main: 'index.js',
          type: 'commonjs',
        },
        null,
        2
      )
    );
    writeFileSync(
      join(shimPath, 'index.js'),
      `module.exports = require(${JSON.stringify(realName)});\n`
    );
    console.log(`Wrote re-export shim ${hashedName} → ${realName} (${error.message})`);
    return true;
  }
}

let linked = 0;
let skipped = 0;

for (const id of [...hashed].sort()) {
  const real = realPackageName(id);
  if (!real) {
    skipped++;
    continue;
  }
  // Only shim if the hashed name is not already a real install path.
  if (packageExists(id) && id === real) {
    skipped++;
    continue;
  }
  if (ensureShim(id, real)) linked++;
  else skipped++;
}

console.log(`Done. linked=${linked} skipped=${skipped} scanned=${hashed.size}`);
