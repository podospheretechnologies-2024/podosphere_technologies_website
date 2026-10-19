'use client';

import { useState } from 'react';
import { apiFetch } from '@/shared/lib/fetcher';
import type { MediaVariantResponse, PlatformImageSizeKey } from '../types/media';
import { MEDIA_API_ROUTE } from './use-media-library';

export function useMediaVariant() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function ensureVariant(
    mediaId: string,
    key: PlatformImageSizeKey,
    store = false
  ): Promise<MediaVariantResponse | null> {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ key });
      if (store) params.set('store', 'true');
      const result = await apiFetch<MediaVariantResponse>(
        `${MEDIA_API_ROUTE}/${mediaId}/variant?${params}`,
        { method: 'POST' }
      );
      return result;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create platform variant');
      return null;
    } finally {
      setLoading(false);
    }
  }

  return { ensureVariant, loading, error };
}
