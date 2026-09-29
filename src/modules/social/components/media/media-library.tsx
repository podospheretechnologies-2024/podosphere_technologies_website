'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/shared/components/ui/button';
import { EmptyState } from '@/shared/components/ui/empty-state';
import { Input } from '@/shared/components/ui/input';
import { Modal } from '@/shared/components/ui/modal';
import { SegmentedControl } from '@/shared/components/ui/segmented-control';
import {
  DEFAULT_MEDIA_FORMAT,
  MEDIA_FILTER_OPTIONS,
  MEDIA_FORMAT_OPTIONS,
} from '../../config/media';
import { useMediaLibrary } from '../../hooks/use-media-library';
import { deleteMediaItem } from '../../lib/media.client';
import type { MediaFormat, MediaItem } from '../../types/media';
import { InstagramFrame } from './instagram-frames';
import { MediaCard } from './media-card';
import { MediaUploadButton } from './media-upload-button';

const SEARCH_DEBOUNCE_MS = 300;

type MediaFilter = MediaFormat | 'all';

const emptyDescriptions: Record<MediaFilter, string> = {
  all: 'Upload images (up to 10 MB) or MP4 videos (up to 1 GB) as a post, reel or story.',
  post: 'Feed posts show as a 4:5 Instagram post. Upload an image or MP4 video.',
  reel: 'Reels are vertical 9:16 MP4 videos, shown like the Instagram Reels player.',
  story: 'Stories show full screen at 9:16 with the progress bar, like on Instagram.',
};

interface MediaLibraryProps {
  accountName: string;
}

export function MediaLibrary({ accountName }: MediaLibraryProps) {
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<MediaFilter>('all');
  const [uploadFormat, setUploadFormat] = useState<MediaFormat>(DEFAULT_MEDIA_FORMAT);
  const [errors, setErrors] = useState<string[]>([]);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [previewing, setPreviewing] = useState<MediaItem | null>(null);

  const { data, error, isLoading, mutate } = useMediaLibrary(
    page,
    search,
    filter === 'all' ? undefined : filter
  );

  useEffect(() => {
    const timeout = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timeout);
  }, [searchInput]);

  function handleFilterChange(value: MediaFilter) {
    setFilter(value);
    setPage(1);
    if (value !== 'all') {
      setUploadFormat(value);
    }
  }

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

  // Switches to the tab of the uploaded format so the new files are visible.
  function handleUploaded(format: MediaFormat) {
    if (filter !== 'all' && filter !== format) {
      setFilter(format);
      setPage(1);
    } else if (page === 1) {
      void mutate();
    } else {
      setPage(1);
    }
  }

  const pages = data?.pages ?? 0;
  const previewLabel = MEDIA_FORMAT_OPTIONS.find(
    (option) => option.value === previewing?.format
  )?.label;

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
        <div className="ml-auto flex flex-wrap items-center gap-3">
          <span className="text-muted-foreground text-sm">Upload as</span>
          <SegmentedControl
            label="Upload as"
            options={MEDIA_FORMAT_OPTIONS}
            value={uploadFormat}
            onChange={setUploadFormat}
          />
          <MediaUploadButton
            format={uploadFormat}
            onUploaded={handleUploaded}
            onErrors={setErrors}
          />
        </div>
      </div>

      <SegmentedControl
        label="Show"
        options={MEDIA_FILTER_OPTIONS}
        value={filter}
        onChange={handleFilterChange}
      />

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
          title={search ? 'No media matches your search' : 'Nothing here yet'}
          description={search ? 'Try a different file name.' : emptyDescriptions[filter]}
        />
      ) : (
        <div className="grid grid-cols-2 items-start gap-5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {data?.results.map((media) => (
            <MediaCard
              key={media.id}
              media={media}
              accountName={accountName}
              deleting={deletingId === media.id}
              onPreview={setPreviewing}
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

      <Modal
        open={previewing !== null}
        title={`${previewLabel ?? 'Media'} preview`}
        description={previewing?.name}
        onClose={() => setPreviewing(null)}
      >
        {previewing && (
          <div className="mx-auto w-full max-w-[300px]">
            <InstagramFrame media={previewing} accountName={accountName} active controls />
          </div>
        )}
      </Modal>
    </div>
  );
}
