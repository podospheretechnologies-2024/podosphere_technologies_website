'use client';

import { Modal } from '@/shared/components/ui/modal';
import type { AvailableProvider } from '../../types/integration';

interface AddChannelDialogProps {
  open: boolean;
  providers: AvailableProvider[];
  connecting: string | null;
  onClose: () => void;
  onSelect: (provider: AvailableProvider) => void;
}

export function AddChannelDialog({
  open,
  providers,
  connecting,
  onClose,
  onSelect,
}: AddChannelDialogProps) {
  return (
    <Modal
      open={open}
      title="Add a channel"
      description="Pick a platform and approve access. You will come back here once it is connected."
      onClose={onClose}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        {providers.map((provider) => (
          <button
            key={provider.identifier}
            type="button"
            disabled={!provider.configured || connecting !== null}
            onClick={() => onSelect(provider)}
            className="border-border hover:border-primary hover:bg-surface-muted disabled:hover:border-border flex flex-col items-start gap-1 rounded-lg border p-4 text-left transition disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:bg-transparent"
          >
            <span className="font-medium">
              {connecting === provider.identifier ? 'Redirecting…' : provider.name}
            </span>
            <span className="text-muted-foreground text-xs">
              {provider.configured
                ? 'Connect your account'
                : `Not configured: set ${provider.requiredEnv.join(', ')}`}
            </span>
          </button>
        ))}
      </div>
    </Modal>
  );
}
