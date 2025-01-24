import React from "react";
import Image from "next/image";
// Material-UI
import { Box, Typography } from "@mui/material";
import { ChatMessage } from "../types/ChatMessage";

interface ChatMessageItemProps {
  message: ChatMessage;
}

const ChatMessageItem: React.FC<ChatMessageItemProps> = ({ message }) => {
  return (
    <Box
      sx={{
        marginBottom: "8px",
        padding: "8px",
        paddingX: "16px",
        fontSize: "14px",
        backgroundColor: message.align === "flex-end" ? "#f4f4f4" : "#fff",
        borderRadius: "24px",
        width: "fit-content",
        alignSelf: message.align,
      }}
    >
      {message.type === "image" ? (
        <Image
          src={message.imageUrl || ""}
          alt="Dataset"
          width={300}
          height={300}
          style={{ objectFit: "cover", borderRadius: "8px" }}
        />
      ) : (
        <Typography variant="body1" sx={{ fontSize: "14px" }}>
          {message.content}
        </Typography>
      )}
    </Box>
  );
};

export default ChatMessageItem;
