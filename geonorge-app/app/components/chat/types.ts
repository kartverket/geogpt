export interface ChatMessage {
  type: "text" | "image" | "streaming";
  content?: string;
  imageUrl?: string;
  downloadUrl?: string | null;
  wmsUrl?: string | null;
}

export interface WebSocketMessage {
  action: string;
  payload?: any;
  isNewMessage?: boolean;
}