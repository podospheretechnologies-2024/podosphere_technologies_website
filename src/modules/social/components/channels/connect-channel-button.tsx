'use client';

export function ConnectChannelButton({
  provider,
  label,
  className,
}: {
  provider: 'facebook' | 'instagram';
  label: string;
  className?: string;
}) {
  async function connect() {
    const response = await fetch(`/api/social/integrations/connect/${provider}`);
    const payload = (await response.json()) as { url?: string; error?: string };
    if (payload.url) {
      window.location.href = payload.url;
      return;
    }
    window.alert(payload.error || 'Could not start the connection');
  }

  return (
    <button type="button" onClick={() => void connect()} className={className}>
      {label}
    </button>
  );
}
