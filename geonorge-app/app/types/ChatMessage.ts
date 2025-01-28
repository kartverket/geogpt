export interface ChatMessage {
  wmsUrl: string;
  downloadUrl: string;
  type: "text" | "image" | "streaming";
  content?: string;
  imageUrl?: string;
  align?: "flex-start" | "flex-end";
}
