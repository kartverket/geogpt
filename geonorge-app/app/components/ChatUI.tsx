import React, { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { initializeWebSocket, MessageType } from "../utils/websocket";

// Custom Components
import TypingIndicator from "./TypingIndicator";

// Components from Material-UI
import {
  Box,
  Button,
  IconButton,
  TextField,
  Typography,
  Paper,
  Fab,
} from "@mui/material";

// Icons from Material-UI
import { ExpandLess, ExpandMore, Send, Chat } from "@mui/icons-material";

interface ChatUIProps {
  webSocketUrl: string;
}

interface ChatMessage {
  type: "text" | "image" | "streaming";
  content?: string;
  imageUrl?: string;
  align?: "flex-start" | "flex-end";
}

const ChatUI: React.FC<ChatUIProps> = ({ webSocketUrl }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [message, setMessage] = useState("");
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const toggleExpand = () => {
    setIsExpanded((prev) => !prev);
  };

  useEffect(() => {
    const handleServerMessage = (data: MessageType) => {
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
            if (!lastMsg || lastMsg.type !== "streaming") {
              return prev;
            }
            const systemMsg = ` ${lastMsg.content}`;
            const converted: ChatMessage = { type: "text", content: systemMsg };
            return [...prev.slice(0, -1), converted];
          });
          break;

        case "userMessage":
          setChatHistory((prev) => [
            ...prev,
            { type: "text", content: ` ${payload}`, align: "flex-end" },
          ]);
          break;

        case "systemMessage":
          setChatHistory((prev) => [
            ...prev,
            { type: "text", content: ` ${payload}`, align: "flex-start" },
          ]);
          break;

        case "insertImage":
          const { datasetImageUrl } = payload;
          setChatHistory((prev) => [
            ...prev,
            { type: "image", imageUrl: datasetImageUrl, align: "flex-start" },
          ]);
          break;

        default:
          console.log("Unknown action:", data);
      }
    };

    const socket = initializeWebSocket(handleServerMessage, webSocketUrl);
    setWs(socket);

    return () => {
      socket.close();
    };
  }, [webSocketUrl]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatHistory]);

  const handleSend = () => {
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    if (message.trim() === "") return;

    ws.send(
      JSON.stringify({
        action: "chatFormSubmit",
        payload: message,
      })
    );
    setMessage("");
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSend();
    }
  };

  return (
    <>
      <Box
        sx={{
          position: "fixed",
          bottom: 25,
          right: 12,
          width: {
            xs: isExpanded ? 370 : 0,
            sm: isExpanded ? 450 : 0,
            md: isExpanded ? 500 : 0,
            lg: isExpanded ? 600 : 0,
          },
          height: {
            xs: isExpanded ? 500 : 0,
            sm: isExpanded ? 600 : 0,
            md: isExpanded ? 700 : 0,
            lg: isExpanded ? 550 : 0,
          },
          transition: "all 0.3s ease",
          overflow: "hidden",
          borderRadius: 2,
          backgroundColor: "#ffffff",
          zIndex: 400,
        }}
      >
        <Paper
          elevation={3}
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "8px",
            backgroundColor: "rgba(254, 80, 0, 0.85)",
          }}
        >
          <Typography
            variant="subtitle1"
            sx={{ color: "#fff", fontWeight: "500" }}
          >
            🤖 GeoGPT
          </Typography>
          <IconButton onClick={toggleExpand} sx={{ color: "#fff" }}>
            {isExpanded ? <ExpandMore /> : <ExpandLess />}
          </IconButton>
        </Paper>

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
                backgroundColor: "#ffffff",
                display: "flex",
                flexDirection: "column",
                alignItems: "flex-start",
              }}
            >
              {chatHistory.map((msg, index) => (
                <Typography
                  key={index}
                  sx={{
                    marginBottom: "8px",
                    padding: "8px",
                    paddingX: "16px",
                    fontSize: "14px",
                    backgroundColor:
                      msg.align === "flex-end" ? "#f4f4f4" : "#fff",
                    borderRadius: "24px",
                    width: "fit-content",
                    alignSelf: msg.align,
                  }}
                >
                  {msg.type === "image" ? (
                    <Image
                      src={msg.imageUrl || ""}
                      alt="Dataset"
                      width={300}
                      height={300}
                      style={{ objectFit: "cover", borderRadius: "8px" }}
                    />
                  ) : (
                    msg.content
                  )}
                </Typography>
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

            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                padding: "8px",
              }}
            >
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
                    "& fieldset": {
                      borderColor: "#E0E0E0",
                    },
                    "&:hover fieldset": {
                      borderColor: "#4F4F4F",
                    },
                    "&.Mui-focused fieldset": {
                      borderColor: "#4F4F4F",
                    },
                    "& input": {
                      fontSize: "14px",
                    },
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
                  backgroundColor: "#007BFF",
                  "&:hover": { backgroundColor: "#0056b3" },
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
            bottom: 25,
            right: 12,
            width: 64,
            height: 48,
            borderRadius: 12,
            backgroundColor: "#fe7c40",
            "&:hover": { backgroundColor: "#ff5722" },
          }}
          onClick={toggleExpand}
        >
          <Chat sx={{ color: "#fff" }} />
        </Fab>
      )}
    </>
  );
};

export default ChatUI;
