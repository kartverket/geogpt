import React, { useState, useEffect, useRef, useCallback } from "react";
import Image from "next/image";

// Utils
import { initializeWebSocket, MessageType } from "../utils/websocket";

// Components
import TypingIndicator from "./TypingIndicator";
import ChatMessageItem from "./ChatMessageItem";

// Types
import { ChatMessage } from "../types/ChatMessage";

// Material-UI Icons
import {
  Box,
  Button,
  IconButton,
  TextField,
  Typography,
  Fab,
} from "@mui/material";
import { ExpandLess, ExpandMore, Send, Chat } from "@mui/icons-material";

interface ChatUIProps {
  webSocketUrl: string;
}

const ChatUI: React.FC<ChatUIProps> = ({ webSocketUrl }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [message, setMessage] = useState("");
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const toggleExpand = () => setIsExpanded((prev) => !prev);

  const handleServerMessage = useCallback((data: MessageType) => {
    const { action, payload } = data;
    console.log("Incoming action:", action, "payload:", payload);

    switch (action) {
      case "chatStream":
        setIsLoading(true);
        setChatHistory((prev) => {
          const lastMsg = prev[prev.length - 1];
          if (!lastMsg || lastMsg.type !== "streaming") {
            return [...prev, { type: "streaming", content: payload }];
          } else {
            const updated: ChatMessage = {
              ...lastMsg,
              content: lastMsg.content + payload,
            };
            return [...prev.slice(0, -1), updated];
          }
        });
        break;

      case "streamComplete":
        setIsLoading(false);
        setChatHistory((prev) => {
          const lastMsg = prev[prev.length - 1];
          if (!lastMsg || lastMsg.type !== "streaming") return prev;
          const converted: ChatMessage = {
            type: "text",
            content: lastMsg.content,
          };
          return [...prev.slice(0, -1), converted];
        });
        break;

      case "userMessage":
        setChatHistory((prev) => [
          ...prev,
          { type: "text", content: payload, align: "flex-end" },
        ]);
        break;

      case "systemMessage":
        setChatHistory((prev) => [
          ...prev,
          { type: "text", content: payload, align: "flex-start" },
        ]);
        break;

      case "insertImage":
        setChatHistory((prev) => [
          ...prev,
          {
            type: "image",
            imageUrl: payload.datasetImageUrl,
            align: "flex-start",
          },
        ]);
        break;

      default:
        console.log("Unknown action:", data);
    }
  }, []);

  useEffect(() => {
    const socket = initializeWebSocket(handleServerMessage, webSocketUrl);
    setWs(socket);

    return () => {
      socket.close();
    };
  }, [webSocketUrl, handleServerMessage]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatHistory]);

  const handleSend = () => {
    if (!ws || ws.readyState !== WebSocket.OPEN || message.trim() === "")
      return;

    ws.send(JSON.stringify({ action: "chatFormSubmit", payload: message }));
    setMessage("");
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSend();
  };

  return (
    <>
      <Box
        sx={{
          position: "fixed",
          bottom: 25,
          right: 12,
          width: isExpanded ? { xs: 370, sm: 450, md: 500, lg: 600 } : 0,
          height: isExpanded ? { xs: 500, sm: 600, md: 700, lg: 600 } : 0,
          transition: "all 0.3s ease",
          overflow: "hidden",
          borderRadius: 2,
          border: "1px solid #E0E0E0",
          backgroundColor: "#fff",
          zIndex: 400,
        }}
      >
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            paddingX: "8px",
            paddingTop: "8px",
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center" }}>
            <Image
              src="/geonorge-logo.png"
              alt="GeoGPT"
              width={64}
              height={64}
            />
            <Typography
              variant="h5"
              sx={{ color: "#333", fontWeight: "500", marginLeft: "8px" }}
            >
              GeoGPT
            </Typography>
          </Box>
          <IconButton onClick={toggleExpand} sx={{ color: "#333" }}>
            {isExpanded ? <ExpandMore /> : <ExpandLess />}
          </IconButton>
        </Box>

        {isExpanded && (
          <Box
            sx={{
              display: "flex",
              flexDirection: "column",
              height: "calc(100% - 50px)",
            }}
          >
            <Box
              sx={{
                flex: 1,
                overflowY: "auto",
                padding: "8px",
                display: "flex",
                flexDirection: "column",
                alignItems: "flex-start",
              }}
            >
              {chatHistory.map((msg, index) => (
                <ChatMessageItem key={index} message={msg} />
              ))}
              {isLoading && (
                <Box
                  sx={{
                    marginBottom: "8px",
                    padding: "8px",
                    paddingX: "16px",
                    fontSize: "14px",
                    backgroundColor: "#f3f3f3",
                    borderRadius: "24px",
                    width: "fit-content",
                    alignSelf: "flex-start",
                  }}
                >
                  <TypingIndicator />
                </Box>
              )}
              <div ref={chatEndRef} />
            </Box>
            {chatHistory.length === 0 && (
              <Box
                sx={{
                  textAlign: "center",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                }}
              >
                <Image
                  src="/geonorge-logo.png"
                  alt="GeoGPT"
                  width={150}
                  height={150}
                />
                <Typography
                  variant="h6"
                  sx={{
                    color: "#333",
                    marginBottom: "12px",
                    fontWeight: "600",
                  }}
                >
                  Hva kan jeg hjelpe deg med?
                </Typography>
              </Box>
            )}
            <Box sx={{ display: "flex", alignItems: "center", padding: "8px" }}>
              <TextField
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Skriv en melding..."
                variant="outlined"
                size="small"
                fullWidth
                sx={{
                  marginRight: "8px",
                  marginBottom: "8px",
                  "& .MuiOutlinedInput-root": {
                    "& fieldset": { borderColor: "#E0E0E0" },
                    "&:hover fieldset": { borderColor: "#4F4F4F" },
                    "&.Mui-focused fieldset": { borderColor: "#4F4F4F" },
                    "& input": { fontSize: "14px" },
                  },
                }}
                onKeyDown={handleKeyPress}
              />
              <Button
                variant="contained"
                onClick={handleSend}
                sx={{
                  marginBottom: "8px",
                  minWidth: "70px",
                  minHeight: "37px",
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "center",
                  backgroundColor: "#333",
                  "&:hover": { backgroundColor: "#444" },
                }}
              >
                <Send sx={{ color: "#fff" }} />
              </Button>
            </Box>
          </Box>
        )}
      </Box>

      {!isExpanded && (
        <Fab
          sx={{
            position: "fixed",
            bottom: 35,
            right: 35,
            width: 64,
            height: 64,
            borderRadius: 12,
            backgroundColor: "#333",
            "&:hover": { backgroundColor: "#444" },
          }}
          onClick={toggleExpand}
        >
          <Chat sx={{ color: "#fff", fontSize: 28 }} />
        </Fab>
      )}
    </>
  );
};

export default ChatUI;
