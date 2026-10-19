export interface ShortLinkItem {
  id: string;
  code: string;
  shortUrl: string;
  targetUrl: string;
  destinationUrl: string;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  utmTerm: string | null;
  utmContent: string | null;
  clicks: number;
  customerId: string | null;
  createdAt: string;
}

export interface CreateShortLinkInput {
  targetUrl: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmTerm?: string;
  utmContent?: string;
}
