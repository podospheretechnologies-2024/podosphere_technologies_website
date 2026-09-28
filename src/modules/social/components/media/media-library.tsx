'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/shared/components/ui/button';
import { EmptyState } from '@/shared/components/ui/empty-state';
import { Input } from '@/shared/components/ui/input';
import { useMediaLibrary } from '../../hooks/use-media-library';
import { deleteMediaItem } from '../../lib/media.client';
import type { MediaItem } from '../../types/media';
import { MediaCard } from './media-card';
import { MediaUploadButton } from './media-upload-button';

const SEARCH_DEBOUNCE_MS = 300;

export function MediaLibrary() {
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [errors, setErrors] = useState<string[]>([]);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const { data, error, isLoading, mutate } = useMediaLibrary(page, search);

  useEffect(() => {
    const timeout = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timeout);
  }, [searchInput]);

  async function handleDelete(media: MediaItem) {
    if (!window.confirm(`Delete "${media.name}" from the media library?`)) {
      return;
    }

    setDeletingId(media.id);
    try {
      await deleteMediaItem(media.id);
      const isLastItemOnPage = data?.results.length === 1 && page > 1;
      if (isLastItemOnPage) {
        setPage(page - 1);
      } else {
        await mutate();
      }
    } catch (deleteError) {
      setErrors([deleteError instanceof Error ? deleteError.message : 'Delete failed']);
    } finally {
      setDeletingId(null);
    }
  }

  function handleUploaded() {
    if (page === 1) {
      void mutate();
    } else {
      setPage(1);
    }
  }

  const pages = data?.pages ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Input
          type="search"
          placeholder="Search by file name"
          value={searchInput}
          onChange={(event) => setSearchInput(event.target.value)}
          className="max-w-xs"
          aria-label="Search media"
        />
        <div className="ml-auto">
          <MediaUploadButton onUploaded={handleUploaded} onErrors={setErrors} />
        </div>
      </div>

      {errors.length > 0 && (
        <div
          role="alert"
          className="border-danger/40 bg-danger/10 text-danger rounded-lg border p-4 text-sm"
        >
          <ul className="list-inside list-disc space-y-1">
            {errors.map((message) => (
              <li key={message}>{message}</li>
            ))}
          </ul>
        </div>
      )}

      {error && !data ? (
        <EmptyState
          title="Could not load media"
          description={error instanceof Error ? error.message : undefined}
          action={<Button onClick={() => mutate()}>Try again</Button>}
        />
      ) : isLoading && !data ? (
        <p className="text-muted-foreground text-sm">Loading media…</p>
      ) : data && data.results.length === 0 ? (
        <EmptyState
          title={search ? 'No media matches your search' : 'Your media library is empty'}
          description={
            search
              ? 'Try a different file name.'
              : 'Upload images (up to 10 MB) or MP4 videos (up to 1 GB) to use them in your posts.'
          }
        />
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-6">
          {data?.results.map((media) => (
            <MediaCard
              key={media.id}
              media={media}
              deleting={deletingId === media.id}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      {pages > 1 && (
        <div className="flex items-center justify-center gap-3">
          <Button
            variant="secondary"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage(page - 1)}
          >
            Previous
          </Button>
          <span className="text-muted-foreground text-sm">
            Page {page} of {pages}
          </span>
          <Button
            variant="secondary"
            size="sm"
            disabled={page >= pages}
            onClick={() => setPage(page + 1)}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
