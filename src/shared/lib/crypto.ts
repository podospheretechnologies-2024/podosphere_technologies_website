import 'server-only';
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { getServerEnv } from './env';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const VERSION = 'v1';

function getKey(): Buffer {
  return createHash('sha256').update(getServerEnv().ENCRYPTION_KEY).digest();
}

// Output format: v1.<iv>.<authTag>.<ciphertext>, all base64url.
export function encrypt(plainText: string): string {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return [VERSION, iv, authTag, encrypted]
    .map((part) => (typeof part === 'string' ? part : part.toString('base64url')))
    .join('.');
}

export function decrypt(payload: string): string {
  const [version, iv, authTag, encrypted] = payload.split('.');
  if (version !== VERSION || !iv || !authTag || encrypted === undefined) {
    throw new Error('Invalid encrypted payload');
  }

  const decipher = createDecipheriv(ALGORITHM, getKey(), Buffer.from(iv, 'base64url'));
  decipher.setAuthTag(Buffer.from(authTag, 'base64url'));
  return Buffer.concat([
    decipher.update(Buffer.from(encrypted, 'base64url')),
    decipher.final(),
  ]).toString('utf8');
}

export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString('base64url');
}
