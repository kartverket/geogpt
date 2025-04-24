import { useState, useEffect } from "react";
import { SearchResult } from "@/app/components/chat_components/types";
import { usePopoverBlocker } from "./usePopoverBlocker";

// Define or import DownloadInfo
interface DownloadInfo {
  uuid: string;
  title: string;
  downloadUrl: string;
  downloadFormats: any[];
}

interface ChatManagementProps {
  messages: any[];
  isStreaming: boolean;
  sendMessage: (message: string) => void;
  executeDatasetDownload: (dataset: SearchResult) => void;
}

export const useChatManagement = ({
  messages,
  isStreaming,
  sendMessage,
  executeDatasetDownload,
}: ChatManagementProps) => {
  const [chatInput, setChatInput] = useState<string>("");
  const [isPopoverOpen, setIsPopoverOpen] = useState(true);
  const [isFullScreen, setIsFullScreen] = useState(false);

  const popoverBlocker = usePopoverBlocker(true);

  // Handle keyboard events for fullscreen mode
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isFullScreen) {
        exitFullScreen();
      }
    };

    if (isFullScreen) {
      document.addEventListener("keydown", handleKeyDown);
    }

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isFullScreen]);

  const onChatSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const trimmedInput = chatInput.trim();
    if (!trimmedInput || isStreaming) {
      return;
    }
    sendMessage(trimmedInput);
    setChatInput("");
  };

  const fullScreenHandleSubmit = (
    e?: { preventDefault?: () => void },
    options?: { experimental_attachments?: FileList }
  ) => {
    if (e && e.preventDefault) {
      e.preventDefault();
    }
    if (!chatInput.trim() || isStreaming) return;
    sendMessage(chatInput);
    setChatInput("");
  };

  const fullScreenHandleInputChange = (
    e: React.ChangeEvent<HTMLTextAreaElement>
  ) => {
    setChatInput(e.target.value);
  };

  const handleChatInputChange = (value: string) => {
    setChatInput(value);
  };

  const handleFullScreenDownload = (info: DownloadInfo) => {
    const datasetObject: SearchResult = {
      uuid: info.uuid,
      title: info.title,
      downloadFormats: info.downloadFormats,
      downloadUrl: info.downloadUrl,
    };

    // Execute the download
    executeDatasetDownload(datasetObject);
  };

  const handleAppend = (message: { role: "user"; content: string }) => {
    sendMessage(message.content);
  };

  const transformMessagesForChatKit = () => {
    return messages.map((msg, idx) => {
      if (msg.type === "image" && msg.imageUrl) {
        return {
          id: msg.uuid,
          type: "image" as const,
          role: "assistant" as const,
          imageUrl: msg.imageUrl,
          wmsUrl: msg.wmsUrl || undefined,
          downloadUrl: msg.downloadUrl || undefined,
          downloadFormats: msg.downloadFormats || undefined,
          content: "",
        };
      }

      let role: "user" | "assistant" = "assistant";
      let content = msg.content || "";

      if (content.startsWith("You: ")) {
        role = "user";
        content = content.slice("You: ".length);
      } else if (content.startsWith("System: ")) {
        content = content.slice("System: ".length);
      }

      return {
        id: msg.uuid,
        role,
        content,
        type: "text" as const,
      };
    });
  };

  const enterFullScreen = () => {
    setIsFullScreen(true);
    setIsPopoverOpen(false);
  };

  const exitFullScreen = () => {
    setIsFullScreen(false);
    setIsPopoverOpen(true);
  };

  const safeClosePopover = () => {
    popoverBlocker.safeClosePopover(() => setIsPopoverOpen(false));
  };

  // Suggestions for the full screen chat
  const suggestions = [
    "Hva er FKB?",
    "Hvilke datasett er nyttige for byggesaksbehandlere?",
    "Er det kvikkleire der jeg bor?",
  ];

  return {
    chatInput,
    isPopoverOpen,
    isFullScreen,
    blockPopoverClose: popoverBlocker.isBlocked,
    setBlockPopoverClose: popoverBlocker.setIsBlocked,
    setChatInput,
    setIsPopoverOpen,
    safeClosePopover,
    onChatSubmit,
    fullScreenHandleSubmit,
    fullScreenHandleInputChange,
    handleChatInputChange,
    handleFullScreenDownload,
    handleAppend,
    transformMessagesForChatKit,
    enterFullScreen,
    exitFullScreen,
    suggestions,
  };
};
