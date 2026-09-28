export interface ChannelItem {
  id: string;
  providerIdentifier: string;
  providerName: string;
  name: string;
  username: string | null;
  picture: string | null;
  disabled: boolean;
  refreshNeeded: boolean;
  inBetweenSteps: boolean;
  customer: { id: string; name: string } | null;
  createdAt: string;
}

export interface AvailableProvider {
  identifier: string;
  name: string;
  configured: boolean;
  requiredEnv: string[];
  maxLength: number;
}

export interface ChannelsResponse {
  channels: ChannelItem[];
  providers: AvailableProvider[];
}

export interface ConnectUrlResponse {
  url: string;
}
