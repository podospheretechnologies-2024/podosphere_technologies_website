export interface PodoCrmWhatsAppSyncStatus {
  linked: boolean;
  phoneNumberId: string | null;
  podocrmCompanyId: string | null;
  podocrmBaseUrl: string | null;
  linkedAt: string | null;
  lastPingAt: string | null;
}

export interface PodoCrmWhatsAppLinkResult extends PodoCrmWhatsAppSyncStatus {
  /** Shown once after a successful link — never stored in client caches long-term. */
  syncSecretPreview?: string;
}

export interface PodoCrmWhatsAppHistorySyncResult {
  attempted: number;
  synced: number;
  mode: 'batch' | 'echo-fallback';
  skipped: number;
}
