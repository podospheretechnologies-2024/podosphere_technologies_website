/**
 * @deprecated Use link-turbopack-externals-shim.mjs (covers prisma + sharp + …).
 */
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const next = join(dirname(fileURLToPath(import.meta.url)), 'link-turbopack-externals-shim.mjs');
const r = spawnSync(process.execPath, [next], { stdio: 'inherit' });
process.exit(r.status ?? 1);
