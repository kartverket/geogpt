export interface ChatMessage {
  title: string;
  type: string;
  content?: string;
  imageUrl?: string;
  downloadUrl?: string;
  wmsUrl?: SearchResult["wmsUrl"] | "None";
  downloadFormats?: Array<any>;
  uuid?: string;
}

export interface WebSocketMessage {
  action: string;
  payload: any;
}

export interface WMSLayer {
  name: string;
  title: string;
}

export type MessageType = {
  action: string;
  payload?: any;
  isNewMessage?: boolean;
};

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
  wmsUrl?: {
    wms_url: string;
    available_layers: WMSLayer[];
    available_formats?: string[];
    title?: string;
  };
}

export interface MapUpdate {
  center?: [number, number];
  zoom?: number;
  layers?: string[];
  markers?: Array<{ lat: number; lng: number; label: string }>;
  findMyLocation?: boolean;
  addMarker?: boolean;
}
