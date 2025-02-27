// WebSocket message type definition
export interface MessageType {
    action: string;
    payload: any;
    status?: 'success' | 'error';
    error?: string;
    isNewMessage?: boolean;
    imageUrl?: string;
    downloadUrl?: string;
    wmsUrl?: string;
}

export interface ChatMessage {
    type: 'text' | 'image' | 'streaming';
    content?: string;
    imageUrl?: string;
    downloadUrl?: string;
    wmsUrl?: string;
}

// Search result type from the API
export interface SearchResult {
    id: string;
    title: string;
    description?: string;
    coordinates?: {
        lat: number;
        lon: number;
    };
}

// Form submission data type
export interface SearchFormData {
    query: string;
    filters?: {
        category?: string;
        area?: string;
    };
}

// WebSocket connection status
export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error';