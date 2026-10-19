export interface CsvImportRowPreview {
  rowIndex: number;
  date: string | null;
  time: string | null;
  channels: string[];
  channelIds: string[];
  channelNames: string[];
  text: string;
  mediaUrls: string[];
  publishAt: string | null;
  errors: string[];
  valid: boolean;
}

export interface CsvImportPreviewResponse {
  headers: string[];
  mapped: {
    date: string | null;
    time: string | null;
    channels: string | null;
    text: string | null;
    mediaUrl: string | null;
  };
  rows: CsvImportRowPreview[];
  validCount: number;
  errorCount: number;
  timeZone: string;
}

export interface CsvImportCreateRow {
  /** 1-based spreadsheet row for error messages (matches preview.rowIndex). */
  rowIndex: number;
  publishAt: string;
  channelIds: string[];
  text: string;
  mediaUrls: string[];
}

export interface CsvImportCreateResponse {
  created: number;
  groups: string[];
}
