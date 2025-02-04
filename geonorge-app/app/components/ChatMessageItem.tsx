import React, { useEffect, useRef, useState } from "react";
import Image from "next/image";

// Utils
import formatDatasetLink from "../types/formatDatasetLink";

// Types
import { ChatMessage } from "../types/ChatMessage";

// Icons
import AddLocationIcon from "@mui/icons-material/AddLocation";
import CloudDownloadIcon from "@mui/icons-material/CloudDownload";
import { Button } from "@/components/ui/button";

interface ChatMessageItemProps {
  message: ChatMessage;
  onView: (wmsUrl: string) => void;
  onDownload: (downloadUrl: string) => void;
  onDatasetLinkGeneration: (formattedLink: string) => void;
  onDatasetGeneration: (datasetName: string) => void;
}

const formatMessageContent = (content: string) => {
  // Ensure content is a string
  const stringContent = String(content || "");
  return stringContent.replace(/\*\*(.*?)\*\*/g, (_, datasetName) =>
    formatDatasetLink(datasetName)
  );
};

const CustomButton: React.FC<{
  onClick: () => void;
  label: string;
  icon: React.ReactNode;
  bgColor: string;
}> = ({ onClick, label, icon, bgColor }) => (
  <Button
    onClick={onClick}
    className={`p-2 px-4 text-white rounded-md flex items-center gap-2 ${bgColor} hover:bg-opacity-80`}
    aria-label={label}
  >
    {icon}
    {label}
  </Button>
);

const hasTypedRef = new Map<string, boolean>(); // Track typing state per message

const ChatMessageItem: React.FC<ChatMessageItemProps> = ({
  message,
  onView,
  onDownload,
  onDatasetLinkGeneration,
  onDatasetGeneration,
}) => {
  const [displayedText, setDisplayedText] = useState("");

  useEffect(() => {
    const text = message.content || "";
    let index = 0;

    // Process links immediately to avoid issues with partial HTML
    const formattedContent = formatMessageContent(text);
    const match = formattedContent.match(/href="([^"]+)"/);
    if (match) {
      const formattedLink = match[1];
      onDatasetLinkGeneration(formattedLink);

      // Extract dataset name from the formatted link
      const nameMatch = formattedLink.match(/text=([^&]+)/);
      if (nameMatch) {
        const extractedName = decodeURIComponent(nameMatch[1]);
        onDatasetGeneration(extractedName);
      }
    }

    // For user messages or images, show content immediately
    if (message.type === "image" || message.align === "flex-end") {
      setDisplayedText(formattedContent);
      return;
    }

    // For system messages, type letter by letter only if not already typed
    if (!hasTypedRef.get(message.content || "")) {
      const typeNextLetter = () => {
        if (index <= text.length) {
          setDisplayedText(formatMessageContent(text.slice(0, index)));
          index++;
          requestAnimationFrame(typeNextLetter);
        }
      };

      requestAnimationFrame(typeNextLetter);
      hasTypedRef.set(message.content || "", true); // Set the ref to true after typing effect starts
    } else {
      // If already typed, just display the full text immediately
      setDisplayedText(formattedContent);
    }
  }, [
    message.content,
    message.type,
    message.align,
    onDatasetLinkGeneration,
    onDatasetGeneration,
  ]);

  return (
    <div
      className={`mb-2 p-2 px-4 text-sm text-color-gn-secondary rounded-3xl w-fit ${
        message.align === "flex-end"
          ? "bg-gray-100 self-end"
          : "bg-white self-start"
      }`}
    >
      {message.type === "image" ? (
        <div className="flex flex-col items-center">
          <div className="relative w-full h-auto mb-2">
            <Image
              src={message.imageUrl || ""}
              alt="Dataset"
              width={300}
              height={300}
              objectFit="cover"
            />
          </div>
          <div className="flex justify-between w-full gap-4">
            {message.wmsUrl && (
              <CustomButton
                onClick={() => onView(message.wmsUrl!)}
                label="Vis på temakart"
                icon={<AddLocationIcon />}
                bgColor="bg-color-gn-secondary hover:bg-gray-900"
              />
            )}
            {message.downloadUrl && (
              <CustomButton
                onClick={() => onDownload(message.downloadUrl!)}
                label="Last ned datasett"
                icon={<CloudDownloadIcon />}
                bgColor="bg-color-gn-primarylight hover:bg-color-gn-primary"
              />
            )}
          </div>
        </div>
      ) : (
        <p
          dangerouslySetInnerHTML={{
            __html: displayedText,
          }}
        />
      )}
    </div>
  );
};

export default ChatMessageItem;
