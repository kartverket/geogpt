import { WMSLayer } from "./map";

export interface SearchResult {
  title?: string;
  wmsUrl?: string;
  downloadUrl?: string | null;
  restricted?: boolean;
  uuid?: string;
  downloadFormats?: {
    type: string;
    name: string;
    code: string;
    projections?: { name: string; code: string }[];
    formats?: { name: string }[];
  }[];
}

export interface TrackedDataset {
  id: string;
  title: string;
  wmsUrl: string;
  availableLayers: WMSLayer[];
  selectedLayers: string[];
}

export interface DownloadFormat {
  type: string;
  name: string;
  code: string;
  projections?: { name: string; code: string }[];
  formats?: { name: string }[];
}
