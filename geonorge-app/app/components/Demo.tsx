"use client";

import { useState, useEffect, useRef, type FormEvent } from "react";
import { KartkatalogTab } from "@/components/kartkatalog-tab";
// ShadCN UI components
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
// Import the full screen Chat component from the kit
import { Chat as FullScreenChat } from "@/components/ui/chat";
import { Maximize } from "lucide-react";

type MessageType = {
  action: string;
  payload?: any;
  isNewMessage?: boolean;
};

interface ChatMessage {
  type: "text" | "image" | "streaming";
  content?: string;
  imageUrl?: string;
  downloadUrl?: string | null;
  wmsUrl?: string | null;
}

interface SearchResult {
  uuid: string;
  title?: string;
  wmsUrl?: string;
  downloadUrl?: string | null;
  restricted?: boolean;
}

const INITIAL_MAP_URL =
  "https://norgeskart.no/geoportal/#!?zoom=4.6366666666666685&lon=168670.22&lat=6789452.95&wms=https:%2F%2Fnve.geodataonline.no%2Farcgis%2Fservices%2FSkredKvikkleire2%2FMapServer%2FWMSServer&project=geonorge&layers=1002";

function DemoV2() {
  // Basic state
  const [iframeSrc, setIframeSrc] = useState(INITIAL_MAP_URL);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchInput, setSearchInput] = useState("");
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [forceUpdate, setForceUpdate] = useState(0);

  // State for full screen mode and popover open state
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);

  const chatEndRef = useRef<HTMLDivElement>(null);

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

  // Scroll to bottom when new chat messages arrive
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  const handleServerMessage = (data: MessageType) => {
    const { action, payload } = data;
    console.log("Incoming action:", action, "payload:", payload);
    switch (action) {
      case "chatStream":
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
        setChatMessages((prev) => {
          const lastMsg = prev[prev.length - 1];
          if (!lastMsg || lastMsg.type !== "streaming") return prev;
          const systemMsg = `System: ${lastMsg.content}`;
          const converted: ChatMessage = { type: "text", content: systemMsg };
          return [...prev.slice(0, -1), converted];
        });
        break;

      case "searchVdbResults":
        setSearchResults(payload);
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
          },
        ]);
        break;

      default:
        console.log("Unknown action:", data);
    }
  };

  const replaceIframe = (wmsUrl: string) => {
    if (!wmsUrl || wmsUrl === "NONE" || wmsUrl.toLowerCase() === "none") {
      alert(`Invalid or missing WMS URL: ${wmsUrl || "none provided"}`);
      return;
    }
    setIframeSrc(wmsUrl);
    setForceUpdate((prev) => prev + 1);
  };

  // const onSearchSubmit = (e: FormEvent<HTMLFormElement>) => {
  //   e.preventDefault();
  //   if (!ws || ws.readyState !== WebSocket.OPEN) return;
  //   ws.send(
  //     JSON.stringify({
  //       action: "searchFormSubmit",
  //       payload: searchInput,
  //     })
  //   );
  // };

  // For the non-fullscreen chat submit handler
  const onChatSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify({ action: "chatFormSubmit", payload: chatInput }));
    setChatMessages((prev) => [
      ...prev,
      { type: "text", content: `You: ${chatInput}` },
    ]);
    setChatInput("");
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
    if (!chatInput.trim()) return;
    handleSendMessage(chatInput);
    setChatInput("");
  };

  const fullScreenHandleInputChange = (
    e: React.ChangeEvent<HTMLTextAreaElement>
  ) => {
    setChatInput(e.target.value);
  };

  // Transform chatMessages to the shape expected by the FullScreenChat component.
  // If the message is an image, include extra properties and set type to "image"
  const transformMessagesForChatKit = () => {
    return chatMessages.map((msg, idx) => {
      if (msg.type === "image" && msg.imageUrl) {
        return {
          id: `msg-${idx}`,
          type: "image" as const,
          role: "assistant" as const,
          imageUrl: msg.imageUrl,
          wmsUrl: msg.wmsUrl || undefined, // Convert null to undefined
          downloadUrl: msg.downloadUrl || undefined, // Convert null to undefined
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

  // Suggestions for the full screen chat
  const suggestions = [
    "Hva er FKB?",
    "Hvilke datasett er nyttige for byggesaksbehandlere?",
    "Er det kvikkleire der jeg bor?",
  ];

  // Append function for suggestion prompts in full screen chat
  const handleAppend = (message: { role: "user"; content: string }) => {
    handleSendMessage(message.content);
  };

  const handleDatasetDownload = (downloadUrl: string) => {
    if (!downloadUrl) {
      console.error("No download URL provided.");
      return;
    }
    const link = document.createElement("a");
    link.href = downloadUrl;
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

  return (
    <div className="relative h-screen w-screen font-['Helvetica_Neue',_Arial,_sans-serif]">
      {/* Map Iframe */}
      <iframe
        key={forceUpdate}
        src={iframeSrc}
        className="absolute inset-0 w-full h-full border-0 z-0"
        title="Geo Map"
      />

      {/* KartkatalogTab Component */}
      <KartkatalogTab
        onReplaceIframe={replaceIframe}
        onDatasetDownload={handleDatasetDownload}
        ws={ws}
      />

      {/* Non-fullscreen Popover Chat UI (rendered only when not in full screen) */}
      {!isFullScreen && (
        <Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
          <PopoverTrigger asChild>
            <Button
              className="fixed bottom-6 right-6 rounded-full p-0 h-12 w-12 flex items-center justify-center shadow-lg"
              variant="default"
            >
              {/* Chat icon SVG */}
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-6 w-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 10h.01M12 10h.01M16 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </Button>
          </PopoverTrigger>
          <PopoverContent
            side="top"
            align="end"
            className="w-96 h-[28rem] p-0 overflow-hidden shadow-lg rounded-lg"
          >
            <div className="flex flex-col h-full bg-white">
              <div className="bg-gray-200 px-4 py-2 flex justify-between items-center">
                <span className="font-semibold">GeoGPT Chat</span>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={enterFullScreen}>
                    <Maximize />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="px-4"
                    onClick={() => setIsPopoverOpen(false)}
                  >
                    X
                  </Button>
                </div>
              </div>

              <div
                id="chatMessages"
                className="flex-1 p-4 overflow-y-auto space-y-2"
              >
                <div className="text-sm text-gray-600">
                  Hei! Jeg er GeoGPT. Spør meg om geodata!
                </div>
                {chatMessages.map((msg, idx) => {
                  // This is the non-fullscreen rendering logic (with left/right alignment)
                  if (msg.type === "image" && msg.imageUrl) {
                    return (
                      <div key={idx} className="flex flex-col space-y-2 my-2">
                        <img
                          src={msg.imageUrl || "/placeholder.svg"}
                          alt="Dataset"
                          className="max-w-full h-auto rounded"
                        />
                        <div className="flex gap-2">
                          {msg.wmsUrl && (
                            <Button
                              onClick={() =>
                                msg.wmsUrl && replaceIframe(msg.wmsUrl)
                              }
                              className="bg-green-500 text-white text-xs"
                            >
                              Vis
                            </Button>
                          )}
                          {msg.downloadUrl && (
                            <Button
                              onClick={() =>
                                handleDatasetDownload(msg.downloadUrl!)
                              }
                              className="bg-green-500 text-white text-xs"
                            >
                              Last ned datasett
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  } else {
                    // Determine alignment based on message content
                    let content = msg.content || "";
                    let isUser = false;
                    if (content.startsWith("You: ")) {
                      isUser = true;
                      content = content.slice("You: ".length);
                    } else if (content.startsWith("System: ")) {
                      content = content.slice("System: ".length);
                    }
                    // Replace markdown bold syntax
                    content = content.replace(
                      /\*\*(.*?)\*\*/g,
                      "<strong>$1</strong>"
                    );
                    return (
                      <div
                        key={idx}
                        className={`flex ${
                          isUser ? "justify-end" : "justify-start"
                        }`}
                      >
                        <div
                          className={`max-w-[80%] p-2 rounded shadow text-sm whitespace-pre-wrap ${
                            isUser ? "bg-blue-100" : "bg-gray-100"
                          }`}
                        >
                          {isUser ? (
                            <strong>You:</strong>
                          ) : (
                            <strong>System:</strong>
                          )}
                          <span
                            className="ml-1"
                            dangerouslySetInnerHTML={{ __html: content }}
                          />
                        </div>
                      </div>
                    );
                  }
                })}
                <div ref={chatEndRef} />
              </div>

              <form
                onSubmit={onChatSubmit}
                className="flex items-center border-t border-gray-300 p-2"
              >
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder="Spør GeoGPT..."
                  className="flex-1 border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <Button type="submit" className="ml-2 text-sm">
                  Send
                </Button>
              </form>
            </div>
          </PopoverContent>
        </Popover>
      )}

      {/* Full Screen Chat UI */}
      {isFullScreen && (
        <div className="fixed inset-0 z-50 bg-white ">
          <div className="flex justify-between items-center p-4 border-b container mx-auto">
            <h2 className="text-xl font-semibold">GeoGPT Chat</h2>
            <Button variant="outline" onClick={exitFullScreen}>
              Exit Full Screen
            </Button>
          </div>
          <div className="p-4 h-full">
            <FullScreenChat
              messages={transformMessagesForChatKit()}
              handleSubmit={fullScreenHandleSubmit}
              input={chatInput}
              handleInputChange={fullScreenHandleInputChange}
              isGenerating={false}
              stop={() => {}}
              append={handleAppend}
              suggestions={suggestions}
              onWmsClick={replaceIframe}
              onDownloadClick={handleDatasetDownload}
              onExitFullScreen={exitFullScreen}
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default DemoV2;
