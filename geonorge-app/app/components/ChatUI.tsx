import React, { useState, useEffect, useRef, useCallback } from "react";
import Image from "next/image";

// Utils
import { initializeWebSocket, MessageType } from "../utils/websocket";

// Components
import TypingIndicator from "./TypingIndicator";
import ChatMessageItem from "./ChatMessageItem";
import DatasetDownloadModal from "./DatasetDownloadModal";

// Types
import { ChatMessage } from "../types/ChatMessage";

// Icons
import { ExpandLess, ExpandMore, Send, Chat } from "@mui/icons-material";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import CloseIcon from "@mui/icons-material/Close";
import { Button } from "@/components/ui/button";

interface ChatUIProps {
  webSocketUrl: string;
}

const INITIAL_MAP_URL =
  "https://norgeskart.no/geoportal/#!?zoom=4.6366666666666685&lon=168670.22&lat=6789452.95&wms=https:%2F%2Fnve.geodataonline.no%2Farcgis%2Fservices%2FSkredKvikkleire2%2FMapServer%2FWMSServer&project=geonorge&layers=1002";

const ChatUI: React.FC<ChatUIProps> = ({ webSocketUrl }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [message, setMessage] = useState("");
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const [showAlert, setShowAlert] = useState(true);

  const [iframeSrc, setIframeSrc] = useState(INITIAL_MAP_URL);
  const [forceUpdate, setForceUpdate] = useState(0);

  //Modal states for dataset download
  const [modalOpen, setModalOpen] = useState(false);
  const [downloadUrl, setDownloadUrl] = useState("");
  const [datasetName, setDatasetName] = useState("");
  const [datasetLink, setDatasetLink] = useState("");
  const [fileSize, setFileSize] = useState("");

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
            return [
              ...prev,
              {
                type: "streaming",
                content: payload,
                wmsUrl: "",
                downloadUrl: "",
              },
            ];
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
            wmsUrl: lastMsg.wmsUrl || "",
            downloadUrl: lastMsg.downloadUrl || "",
          };
          return [...prev.slice(0, -1), converted];
        });
        break;

      case "userMessage":
        setChatHistory((prev) => [
          ...prev,
          {
            type: "text",
            content: payload,
            align: "flex-end",
            wmsUrl: "",
            downloadUrl: "",
          },
        ]);
        break;

      case "systemMessage":
        setChatHistory((prev) => [
          ...prev,
          {
            type: "text",
            content: payload,
            align: "flex-start",
            wmsUrl: "",
            downloadUrl: "",
          },
        ]);
        break;

      case "insertImage":
        setChatHistory((prev) => [
          ...prev,
          {
            type: "image",
            imageUrl: payload.datasetImageUrl,
            align: "flex-start",
            downloadUrl: payload.datasetDownloadUrl,
            wmsUrl: payload.wmsUrl,
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

  const replaceIframe = (wmsUrl: string) => {
    if (!wmsUrl || wmsUrl === "NONE" || wmsUrl.toLowerCase() === "none") {
      alert(`Invalid or missing WMS URL: ${wmsUrl || "none provided"}`);
      return;
    }
    setIframeSrc(wmsUrl);
    setForceUpdate((prev) => prev + 1);
  };

  const handleConfirmDownload = () => {
    if (!downloadUrl) return;
    const link = document.createElement("a");
    link.href = downloadUrl;
    link.target = "_blank";
    link.download = "";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setModalOpen(false);
  };

  const handleView = (wmsUrl: string) => {
    replaceIframe(wmsUrl);
  };

  const handleDownload = (downloadUrl: string, datasetName: string) => {
    setDownloadUrl(downloadUrl);
    setDatasetName(datasetName);
    setFileSize(fileSize);
    setModalOpen(true);
  };

  return (
    <>
      <div style={{ height: "100vh", width: "100vw", position: "relative" }}>
        <iframe
          key={forceUpdate}
          src={iframeSrc}
          style={{
            width: "100%",
            height: "100%",
            border: "none",
            position: "absolute",
            zIndex: 0,
          }}
          title="Geo Map"
        />
        <div
          className={`fixed bottom-6 right-3 transition-all duration-300 overflow-hidden rounded-lg border border-gray-300 bg-white z-50 ${
            isExpanded
              ? "w-[370px] sm:w-[450px] md:w-[400px] lg:w-[550px] h-[500px] sm:h-[600px] md:h-[700px] lg:h-[570px]"
              : "w-0 h-0"
          }`}
        >
          <div className="flex items-center justify-between px-2 pt-2">
            <div className="flex items-center">
              <Image
                src="../public/geonorge-logo.png"
                alt="GeoGPT"
                width={78}
                height={78}
              />
              <h5 className="ml-2 text-2xl  text-color-gn-secondary">GeoGPT</h5>
            </div>
            <button onClick={toggleExpand} className="text-color-gn-secondary">
              {isExpanded ? <ExpandMore /> : <ExpandLess />}
            </button>
          </div>

          {isExpanded && (
            <div className="flex flex-col h-[calc(100%-50px)]">
              <div className="flex-1 overflow-y-auto p-2 flex flex-col items-start">
                {chatHistory.map((msg, index) => (
                  <ChatMessageItem
                    key={index}
                    onDatasetGeneration={(extractedName: string) =>
                      setDatasetName(extractedName)
                    }
                    onDatasetLinkGeneration={(formattedLink: string) =>
                      setDatasetLink(formattedLink)
                    }
                    message={msg}
                    onView={handleView}
                    onDownload={(downloadUrl: string) =>
                      handleDownload(downloadUrl, "Datasett")
                    }
                  />
                ))}
                {isLoading && (
                  <div className="mb-2 p-2 px-4 text-sm bg-white rounded-full self-start">
                    <TypingIndicator />
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>
              {chatHistory.length === 0 && (
                <div className="text-center flex flex-col items-center">
                  <Image
                    src="/geonorge-logo.png"
                    alt="GeoGPT"
                    width={150}
                    height={150}
                  />
                  <h6 className="mb-3 text-xl font-semibold text-color-gn-secondary">
                    Hva kan jeg hjelpe deg med?
                  </h6>
                </div>
              )}
              <div className="flex items-center p-2">
                <input
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Skriv en melding..."
                  className="flex-1 p-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-gray-500"
                  onKeyDown={handleKeyPress}
                />
                <Button
                  onClick={handleSend}
                  className="ml-2 m-2 flex min-h-[37px] min-w-[70px] items-center justify-center rounded-lg bg-color-gn-secondary p-2 text-white "
                >
                  <Send />
                </Button>
              </div>
            </div>
          )}
        </div>

        {!isExpanded && (
          <div className="fixed bottom-40 right-6 flex flex-col items-end space-y-0">
            {showAlert && (
              <Alert className="relative p-4 bg-white border border-gray-300 rounded-lg shadow-md">
                <button
                  className="absolute top-2 right-2 text-gray-600 hover:text-gray-800"
                  onClick={() => setShowAlert(false)}
                >
                  <CloseIcon fontSize="small" />
                </button>
                <AlertTitle className="text-gray-800 font-semibold">
                  Prøv ut vår Chatbot
                </AlertTitle>
                <AlertDescription className="text-gray-600">
                  Klikk på ikonet for å starte en samtale.
                </AlertDescription>
              </Alert>
            )}
            <div className="relative">
              <button
                className="absolute right-0 -top-4 w-16 h-16 rounded-full bg-color-gn-primarylight hover:bg-color-gn-primary flex justify-center items-center shadow-lg transition-transform transform hover:scale-105"
                onClick={toggleExpand}
              >
                <Chat className="text-white text-2xl" />
              </button>
            </div>
          </div>
        )}
        <DatasetDownloadModal
          isOpen={modalOpen}
          handleClose={() => setModalOpen(false)}
          handleDownload={handleConfirmDownload}
          title="Bekreft nedlasting"
          datasetName={datasetName}
          datasetLink={datasetLink}
          datasetDownloadLink={downloadUrl}
          fileSize={fileSize}
        />
      </div>
    </>
  );
};

export default ChatUI;
