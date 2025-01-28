export interface SearchResult {
  uuid: string;
  title?: string;
  wmsUrl?: string;
  downloadUrl?: string | null;
  restricted?: boolean;
}
