import { useState, useEffect } from 'react';
import { ChatMessage, WebSocketMessage } from './types';

export const useWebSocket = () => {
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);

  useEffect(() => {
    console.log('🌐 Initializing WebSocket connection...');
    const socket = new WebSocket("ws://localhost:8080");
    setWs(socket);

    socket.onopen = () => {
      console.log('✅ WebSocket connection established');
      socket.send(JSON.stringify({
        action: "searchFormSubmit",
        payload: "",
      }));
    };

    socket.onclose = () => {
      console.log('❌ WebSocket connection closed');
    };

    socket.onerror = (error) => {
      console.error('🚨 WebSocket error:', error);
    };

    socket.onmessage = (event) => {
      console.log('📩 Received WebSocket message:', event.data);
      try {
        const data: WebSocketMessage = JSON.parse(event.data);
        handleServerMessage(data);
      } catch (error) {
        console.error('🚨 Error parsing WebSocket message:', error);
      }
    };

    return () => {
      console.log('🔄 Cleaning up WebSocket connection...');
      socket.close();
    };
  }, []);

  const handleServerMessage = (data: WebSocketMessage) => {
    console.log('🎯 Handling server message:', data.action);
    const { action, payload } = data;
    
    switch (action) {
      case "chatStream":
        setIsStreaming(true);
        console.log('📝 Chat stream received:', payload);
        if (payload.isNewMessage && !payload.payload) break;
        setMessages((prev) => {
          const lastMsg = prev[prev.length - 1];
          if (!lastMsg || lastMsg.type !== "streaming" || payload.isNewMessage) {
            return [...prev, { type: "streaming", content: payload.payload || "" }];
          } else {
            return [
              ...prev.slice(0, -1),
              { ...lastMsg, content: lastMsg.content + (payload.payload || "") }
            ];
          }
        });
        break;

      case "streamComplete":
        console.log('✅ Stream complete');
        setIsStreaming(false);
        setMessages((prev) => {
          const lastMsg = prev[prev.length - 1];
          if (!lastMsg || lastMsg.type !== "streaming") return prev;
          return [
            ...prev.slice(0, -1),
            { type: "text", content: `System: ${lastMsg.content}` }
          ];
        });
        break;

      case "insertImage":
        console.log('🖼️ Inserting image:', payload);
        const { datasetImageUrl, datasetDownloadUrl, wmsUrl } = payload;
        setMessages((prev) => [
          ...prev,
          {
            type: "image",
            imageUrl: datasetImageUrl,
            downloadUrl: datasetDownloadUrl,
            wmsUrl: wmsUrl,
          },
        ]);
        break;

      default:
        console.log('⚠️ Unhandled action type:', action);
    }
  };

  const sendMessage = (message: string) => {
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      console.error('🚨 WebSocket not connected');
      return;
    }
    console.log('📤 Sending message:', message);
    ws.send(JSON.stringify({ action: "chatFormSubmit", payload: message }));
    setMessages((prev) => [...prev, { type: "text", content: `You: ${message}` }]);
  };

  return {
    messages,
    isStreaming,
    sendMessage,
    ws,
  };
};