export interface ChatMessage {
    type: "text" | "image" | "streaming";
    content?: string;
    imageUrl?: string;
    align?: "flex-start" | "flex-end";
  }
