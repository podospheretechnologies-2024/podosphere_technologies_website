export interface WebhookItem {
  id: string;
  name: string;
  url: string;
  integrationIds: string[];
  createdAt: string;
}

export interface WebhookTestResult {
  status: number;
}

export interface AutopostItem {
  id: string;
  title: string;
  url: string;
  /** Link of the newest feed item already handled. */
  lastUrl: string | null;
  content: string | null;
  integrationIds: string[];
  onSlot: boolean;
  syncLast: boolean;
  addPicture: boolean;
  generateContent: boolean;
  active: boolean;
  createdAt: string;
}

export interface AutopostRunResult {
  created: number;
}

export interface SaveWebhookInput {
  name: string;
  url: string;
  integrationIds: string[];
}

export type SaveAutopostInput = Omit<AutopostItem, 'id' | 'lastUrl' | 'createdAt'>;
