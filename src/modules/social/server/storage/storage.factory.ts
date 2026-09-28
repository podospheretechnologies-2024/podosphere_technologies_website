import 'server-only';
import { getServerEnv } from '@/shared/lib/env';
import { LocalStorage } from './local.storage';
import type { StorageProvider } from './storage.interface';

let storage: StorageProvider | undefined;

export function getStorage(): StorageProvider {
  if (storage) {
    return storage;
  }

  const env = getServerEnv();
  switch (env.STORAGE_PROVIDER) {
    case 'local':
      storage = new LocalStorage(env.UPLOAD_DIRECTORY);
      break;
  }

  return storage;
}
