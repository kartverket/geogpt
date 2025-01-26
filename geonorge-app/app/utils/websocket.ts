export interface MessageType {
  action: string;
  payload?: any;
}

export const initializeWebSocket = (
  handleServerMessage: (data: MessageType) => void,
  url: string
): WebSocket => {
  const socket = new WebSocket(url);

  socket.onopen = () => {
    console.log("WebSocket connected!");
  };

  socket.onerror = (err) => {
    console.error("WebSocket error:", err);
    alert("Error connecting to chat service.");
  };

  socket.onmessage = (event) => {
    const data: MessageType = JSON.parse(event.data);
    handleServerMessage(data);
  };

  socket.onclose = () => {
    console.log("WebSocket closed.");
  };

  return socket;
};
