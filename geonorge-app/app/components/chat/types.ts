export interface ChatMessage {
  title: string;
  type: "text" | "image" | "streaming";
  content?: string;
  imageUrl?: string;
  downloadUrl?: string | null;
  wmsUrl?: string | null;
  uuid?: string;
  downloadFormats?: {
    type: string;
    name: string;
    code: string;
    projections?: { name: string; code: string }[];
    formats?: { name: string }[];
  }[];
}

export interface WebSocketMessage {
  action: string;
  payload?: any;
  isNewMessage?: boolean;
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
  wmsUrl?: string;
  restricted?: boolean;
  downloadUrl?: string | null;
  downloadFormats?: Array<{
    type: string;
    name: string;
    code: string;
    projections?: Array<{ name: string; code: string }>;
    formats?: Array<{ name: string }>;
  }>;
}
