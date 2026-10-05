export interface GoogleSheetsConnectionSummary {
  connected: boolean;
  configured: boolean;
  email?: string;
  name?: string | null;
  picture?: string | null;
  lastSyncedAt?: string | null;
  spreadsheetCount: number;
  rowCount: number;
}

export interface GoogleSheetRow {
  sheetName: string;
  rowIndex: number;
  values: Record<string, string>;
  dateValue: string | null;
  content: string;
}

export interface GoogleSpreadsheetItem {
  id: string;
  spreadsheetId: string;
  name: string;
  url: string;
  modifiedTime: string | null;
  sheetNames: string[];
  headers: string[];
  rowCount: number;
  syncedAt: string;
  rows: GoogleSheetRow[];
}

export interface GoogleSheetsStatusResponse {
  connection: GoogleSheetsConnectionSummary;
  spreadsheets: GoogleSpreadsheetItem[];
}

export interface GoogleSheetsContentMatch {
  date: string;
  row: GoogleSheetRow | null;
  spreadsheet: Pick<GoogleSpreadsheetItem, 'id' | 'spreadsheetId' | 'name' | 'url'> | null;
  alternatives: Array<{
    spreadsheetId: string;
    spreadsheetName: string;
    row: GoogleSheetRow;
  }>;
}

export interface ConnectUrlResponse {
  url: string;
}
