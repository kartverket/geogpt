import { useState, useEffect, useRef, FormEvent } from "react";
import { ChatMessage, MessageType, FullScreenChatMessage } from "@/types/chat";
import { SearchResult } from "@/types/datasets";
import { dedupeFormats, dedupeAreas, dedupeProjections } from "@/utils/datasetUtils";

export function useChat(onReplaceIframe: (wmsUrl: any, title?: string) => void) {
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [isChatStreaming, setIsChatStreaming] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  
  // State for file download modal
  const [isFileDownloadModalOpen, setFileDownloadModalOpen] = useState<boolean>(false);
  const [pendingDownloadUrl, setPendingDownloadUrl] = useState<string | null>(null);
  
  // Dataset info
  const [datasetName, setDatasetName] = useState<string>("");
  const [specificObject, setSpecificObject] = useState<SearchResult | null>(null);
  const [uuidToFind, setUuidToFind] = useState<string>("");
  
  // Download formats
  const [geographicalAreas, setGeographicalAreas] = useState<
    { type: string; name: string; code: string }[]
  >([]);
  const [projections, setProjections] = useState<
    { name: string; code: string }[]
  >([]);
  const [formats, setFormats] = useState<string[]>([]);
  
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Add these state variables to track modal and popover state
  const [modalOpen, setModalOpen] = useState(false);
  const [blockPopoverClose, setBlockPopoverClose] = useState(false);

  // Set up WebSocket and message handling
  useEffect(() => {
    const socket = new WebSocket("ws://localhost:8080");
    setWs(socket);

    socket.onmessage = (event) => {
      const data: MessageType = JSON.parse(event.data);
      handleServerMessage(data);
    };

    socket.onopen = () => {
      // Trigger an initial search on connection
      const initialSearchMessage = {
        action: "searchFormSubmit",
        payload: "",
      };
      socket.send(JSON.stringify(initialSearchMessage));
    };

    return () => {
      socket.close();
    };
  }, []);

  // Add this effect to manage interactions between modal and popover
  useEffect(() => {
    if (isFileDownloadModalOpen) {
      setModalOpen(true);
      setBlockPopoverClose(true);
    } else {
      // When modal closes, allow a small delay before popover can close
      const timer = setTimeout(() => {
        setModalOpen(false);
        setBlockPopoverClose(false);
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isFileDownloadModalOpen]);

  // ESC key can be used for quick exit from full screen
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

  // Scroll to bottom when new chat messages arrive
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  const handleServerMessage = (data: MessageType) => {
    const { action, payload } = data;
    console.log("Incoming action:", action, "payload:", payload);
    
    switch (action) {
      case "chatStream":
        setIsChatStreaming(true);
        if (payload.isNewMessage && !payload.payload) break;
        setChatMessages((prev) => {
          const lastMsg = prev[prev.length - 1];
          if (
            !lastMsg ||
            lastMsg.type !== "streaming" ||
            payload.isNewMessage
          ) {
            return [
              ...prev,
              { type: "streaming", content: payload.payload || "" },
            ];
          } else {
            const updated: ChatMessage = {
              ...lastMsg,
              content: lastMsg.content + (payload.payload || ""),
            };
            return [...prev.slice(0, -1), updated];
          }
        });
        break;

      case "streamComplete":
        setIsChatStreaming(false); // Re-enable send button after stream complete
        setChatMessages((prev) => {
          const lastMsg = prev[prev.length - 1];
          if (!lastMsg || lastMsg.type !== "streaming") return prev;
          const systemMsg = `System: ${lastMsg.content}`;
          const converted: ChatMessage = { type: "text", content: systemMsg, title: "" };
          return [...prev.slice(0, -1), converted];
        });
        break;

      case "insertImage":
        const { datasetImageUrl, datasetDownloadUrl, wmsUrl } = payload;
        setChatMessages((prev) => [
          ...prev,
          {
            type: "image",
            imageUrl: datasetImageUrl,
            downloadUrl: datasetDownloadUrl,
            wmsUrl: wmsUrl,
            title: datasetName,
          },
        ]);
        break;

      case "chatDatasets":
        if (payload && Array.isArray(payload)) {
          const firstUuid = payload[0].uuid;
          setUuidToFind(firstUuid);

          const datasetObject = payload.find(
            (item: SearchResult) => item.uuid === firstUuid
          );

          // Store the dataset info
          setSpecificObject(datasetObject || null);
          console.log("Specific object set to:", datasetObject);

          if (datasetObject) {
            // Update any pending image message with dataset details
            setChatMessages((prev) => {
              const lastIndex = prev.length - 1;
              for (let i = lastIndex; i >= 0; i--) {
                if (
                  prev[i].type === "image" &&
                  (!prev[i].downloadFormats ||
                    prev[i].downloadFormats?.length === 0)
                ) {
                  const updatedMessages = [...prev];
                  updatedMessages[i] = {
                    ...updatedMessages[i],
                    downloadFormats: datasetObject.downloadFormats || [],
                    title: datasetObject.title || "",
                    uuid: datasetObject.uuid,
                  };
                  return updatedMessages;
                }
              }
              return prev;
            });
            setDatasetName(datasetObject.title || "");
            // Using imported utility functions for deduplication
            // Reusing the functions imported at the top of the file
            
            const rawGeoAreas = datasetObject.downloadFormats.map((fmt: any) => ({
              type: fmt.type,
              name: fmt.name,
              code: fmt.code,
            }));
            setGeographicalAreas(dedupeAreas(rawGeoAreas));

            const rawProjections = datasetObject.downloadFormats.flatMap(
              (fmt: any) =>
                fmt.projections
                  ? fmt.projections.map((proj: any) => ({
                      name: proj.name,
                      code: proj.code,
                    }))
                  : []
            );
            setProjections(dedupeProjections(rawProjections));

            const rawFormats = datasetObject.downloadFormats.flatMap((fmt: any) =>
              fmt.formats ? fmt.formats.map((format: any) => format.name) : []
            );
            setFormats(dedupeFormats(rawFormats));
          }
        }
        break;

      default:
        console.log("Unknown action:", data);
    }
  };

  // For the non-fullscreen chat submit handler
  const onChatSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const trimmedInput = chatInput.trim();
    if (
      !ws ||
      ws.readyState !== WebSocket.OPEN ||
      !trimmedInput ||
      isChatStreaming
    )
      return;
    ws.send(
      JSON.stringify({ action: "chatFormSubmit", payload: trimmedInput })
    );
    setChatMessages((prev) => [
      ...prev,
      { type: "text", content: `You: ${trimmedInput}` },
    ]);
    setChatInput("");
    setIsChatStreaming(true);
  };

  // Shared function for sending a message
  const handleSendMessage = (message: string) => {
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify({ action: "chatFormSubmit", payload: message }));
    setChatMessages((prev) => [
      ...prev,
      { type: "text", content: `You: ${message}` },
    ]);
  };

  // Full screen chat handlers
  const fullScreenHandleSubmit = (
    e?: { preventDefault?: () => void },
    options?: { experimental_attachments?: FileList }
  ) => {
    if (e && e.preventDefault) {
      e.preventDefault();
    }
    if (!chatInput.trim() || isChatStreaming) return;
    handleSendMessage(chatInput);
    setChatInput("");
  };

  const fullScreenHandleInputChange = (
    e: React.ChangeEvent<HTMLTextAreaElement>
  ) => {
    setChatInput(e.target.value);
  };

  // Transform chatMessages to the shape expected by the FullScreenChat component.
  const transformMessagesForChatKit = () => {
    return chatMessages.map((msg, idx) => {
      if (msg.type === "image" && msg.imageUrl) {
        return {
          id: `msg-${idx}`,
          type: "image" as const,
          role: "assistant" as const,
          imageUrl: msg.imageUrl,
          wmsUrl: msg.wmsUrl || undefined,
          downloadUrl: msg.downloadUrl || undefined,
          content: "",
        };
      }
      let role: "user" | "assistant" = "assistant";
      let content = msg.content || "";
      if (content.startsWith("You: ")) {
        role = "user";
        content = content.slice("You: ".length);
      } else if (content.startsWith("System: ")) {
        role = "assistant";
        content = content.slice("System: ".length);
      }
      return {
        id: `msg-${idx}`,
        role,
        content,
        type: "text" as const,
      };
    });
  };

  // Handle append for chat suggestions in full screen mode
  const handleAppend = (message: { role: "user"; content: string }) => {
    handleSendMessage(message.content);
  };

  // Function to handle dataset download
  const handleDatasetDownload = (msg: ChatMessage) => {
    console.log("Handling dataset download with message:", msg);
    console.log("msg.downloadUrl", msg.downloadUrl);

    if (msg.downloadFormats && msg.downloadFormats.length > 0) {
      const formatsToUse =
        msg.downloadFormats && msg.downloadFormats.length > 0
          ? msg.downloadFormats
          : specificObject?.downloadFormats || [];

      // Extract and dedupe geographical areas
      // Using imported utility functions for deduplication
      // Reusing the functions imported at the top of the file
      
      const rawGeoAreas = formatsToUse.map((fmt) => ({
        type: fmt.type,
        name: fmt.name,
        code: fmt.code,
      }));
      const uniqueGeographicalAreas = dedupeAreas(rawGeoAreas);

      // Extract and dedupe projections
      const rawProjections = formatsToUse
        .flatMap((fmt) => (fmt.projections ? fmt.projections : []))
        .map((proj) => ({
          name: proj.name,
          code: proj.code,
        }));
      const uniqueProjections = dedupeProjections(rawProjections);

      // Extract and dedupe formats
      const rawFormats = formatsToUse.flatMap((fmt) =>
        fmt.formats ? fmt.formats.map((format) => format.name) : []
      );
      const uniqueFormats = dedupeFormats(rawFormats);

      setGeographicalAreas(uniqueGeographicalAreas);
      setProjections(uniqueProjections);
      setFormats(uniqueFormats);
      setDatasetName(msg.title || specificObject?.title || "");
      setPendingDownloadUrl(msg.downloadUrl || null); // Store the standard download URL
      setFileDownloadModalOpen(true);
    } else if (msg.downloadUrl) {
      // If no formats but URL exists, use standard download
      handleDirectDownload(msg.downloadUrl);
    } else {
      console.warn("No download URL or formats available");
    }
  };

  // Handle full screen download
  const handleFullScreenDownload = (url: string) => {
    const messageWithUrl = chatMessages.find((msg) => msg.downloadUrl === url);
    if (messageWithUrl) {
      handleDatasetDownload(messageWithUrl);
    } else {
      const minimalMsg: ChatMessage = {
        type: "image",
        downloadUrl: url,
        title: specificObject?.title || "",
        downloadFormats: specificObject?.downloadFormats || [],
      };
      handleDatasetDownload(minimalMsg);
    }
  };

  // Direct download without modal
  const handleDirectDownload = (url: string) => {
    if (!url) return;
    const link = document.createElement("a");
    link.href = url;
    link.target = "_blank";
    link.download = "";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // When entering full screen, close the popover
  const enterFullScreen = () => {
    setIsFullScreen(true);
    setIsPopoverOpen(false);
  };

  // When exiting full screen, reopen the popover
  const exitFullScreen = () => {
    setIsFullScreen(false);
    setIsPopoverOpen(true);
  };

  return {
    ws,
    chatMessages,
    chatInput,
    setChatInput,
    isChatStreaming,
    isFullScreen,
    setIsFullScreen,
    isPopoverOpen,
    setIsPopoverOpen,
    chatEndRef,
    isFileDownloadModalOpen,
    setFileDownloadModalOpen,
    pendingDownloadUrl,
    setPendingDownloadUrl,
    datasetName,
    specificObject,
    geographicalAreas,
    projections,
    formats,
    modalOpen,
    blockPopoverClose,
    onChatSubmit,
    fullScreenHandleSubmit,
    fullScreenHandleInputChange,
    transformMessagesForChatKit,
    handleAppend,
    handleDatasetDownload,
    handleFullScreenDownload,
    handleDirectDownload,
    enterFullScreen,
    exitFullScreen,
  };
}
