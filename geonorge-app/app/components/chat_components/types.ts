export interface ChatMessage {
  title: string;
  type: string;
  content?: string;
  imageUrl?: string;
  downloadUrl?: string;
  wmsUrl?: SearchResult["wmsUrl"] | "None";
  downloadFormats?: Array<{
    type: string;
    name: string;
    code: string;
    projections?: Array<{ name: string; code: string }>;
    formats?: Array<{ name: string }>;
  }>;
  uuid?: string;
}

// New payload type for the 'chatStream' action
export interface ChatStreamPayload {
  payload: string;
  isNewMessage: boolean;
}

export interface InsertImagePayload {
  datasetImageUrl?: string;
  datasetDownloadUrl?: string | null;
  wmsUrl?: SearchResult["wmsUrl"];
  datasetTitle?: string;
  datasetUuid: string;
  downloadFormats?: SearchResult["downloadFormats"];
}

// New payload type for the 'updateDatasetWms' action
export interface UpdateWmsPayload {
  uuid: string;
  wmsUrl: SearchResult["wmsUrl"];
}

// New payload type for the (potential) 'downloadDataset' action
export interface DownloadDatasetPayload {
  uuid: string;
  selectedFormats: string[];
}

// Union type for all possible WebSocket payloads
export type WebSocketPayload =
  | string
  | SearchResult[]
  | MapUpdate
  | InsertImagePayload
  | UpdateWmsPayload
  | DownloadDatasetPayload
  | ChatStreamPayload
  | object;

export interface WebSocketMessage {
  action: string;
  payload: WebSocketPayload;
}

export interface WMSLayer {
  name: string;
  title: string;
}

export interface Address {
  adressetekst: string;
  poststed?: string;
  representasjonspunkt: {
    lat: number;
    lon: number;
  };
}

export interface SearchResult {
  uuid: string;
  title?: string;
  restricted?: boolean;
  downloadUrl?: string | null;
  downloadFormats?: Array<{
    type: string;
    name: string;
    code: string;
    projections?: Array<{ name: string; code: string }>;
    formats?: Array<{ name: string }>;
  }>;
  getcapabilitiesurl?: string;
  wmsUrl?:
    | null
    | { loading: true }
    | { error: string }
    | {
        wms_url: string;
        available_layers: WMSLayer[];
        available_formats?: string[];
        title?: string;
      };
}

export interface ActiveLayerInfo {
  id: string; // Unique ID: `${sourceUuid}-${layer.name}`
  name: string;
  title: string;
  sourceUrl: string;
  sourceTitle: string;
  sourceUuid: string;
}

export interface MapUpdate {
  center?: [number, number];
  zoom?: number;
  layers?: string[];
  markers?: Array<{ lat: number; lng: number; label: string }>;
  findMyLocation?: boolean;
  addMarker?: boolean;
}
