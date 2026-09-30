'use client';

import { ChevronRight, Loader2 } from 'lucide-react';
import { Modal } from '@/shared/components/ui/modal';
import type { AvailableProvider } from '../../types/integration';
import { ProviderMark } from './provider-mark';

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
            className="group border-border hover:border-primary hover:bg-primary/5 disabled:hover:border-border flex items-center gap-3 rounded-xl border p-4 text-left transition disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:bg-transparent"
          >
            <ProviderMark identifier={provider.identifier} name={provider.name} />
            <span className="min-w-0 flex-1">
              <span className="block font-semibold">
                {connecting === provider.identifier ? 'Redirecting…' : provider.name}
              </span>
              <span className="text-muted-foreground block text-xs">
                {provider.configured
                  ? 'Connect your account'
                  : `Not configured: set ${provider.requiredEnv.join(', ')}`}
              </span>
            </span>
            {connecting === provider.identifier ? (
              <Loader2 className="text-primary size-4 shrink-0 animate-spin" />
            ) : (
              provider.configured && (
                <ChevronRight className="text-muted-foreground group-hover:text-primary size-4 shrink-0 transition" />
              )
            )}
          </button>
        ))}
      </div>
    </Modal>
  );
}
