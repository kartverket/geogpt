export interface ChatMessage {
  title: string;
  type: "text" | "image" | "streaming" | "download";
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

export type MessageType = {
  action: string;
  payload?: any;
  isNewMessage?: boolean;
};

export interface FullScreenChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  type: "text" | "image";
  imageUrl?: string;
  wmsUrl?: string;
  downloadUrl?: string;
}
