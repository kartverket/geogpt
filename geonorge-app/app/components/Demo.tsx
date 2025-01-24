"use client";
import React, { useState, useEffect, useRef, FormEvent } from "react";
import { Rnd } from "react-rnd";

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

function Demo() {
  const [iframeSrc, setIframeSrc] = useState(INITIAL_MAP_URL);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchInput, setSearchInput] = useState("");
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [forceUpdate, setForceUpdate] = useState(0);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Drag and z-index states
  const [chatDraggingZ, setChatDraggingZ] = useState(2);
  const [searchDraggingZ, setSearchDraggingZ] = useState(1);

  useEffect(() => {
    const socket = new WebSocket("ws://localhost:8080");
    setWs(socket);

    socket.onmessage = (event) => {
      const data: MessageType = JSON.parse(event.data);
      handleServerMessage(data);
    };

    socket.onopen = () => {
      // Automatically trigger the search on socket connection
      const initialSearchMessage = {
        action: "searchFormSubmit",
        payload: "", // You can set a default payload or leave it empty
      };
      socket.send(JSON.stringify(initialSearchMessage));
    };

    return () => {
      socket.close();
    };
  }, []);

  // Scroll chat to bottom whenever chatMessages change
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  const handleServerMessage = (data: MessageType) => {
    const { action, payload } = data;
    console.log("Incoming action:", action, "payload:", payload);

    switch (action) {
      case "chatStream":
        setChatMessages((prev) => {
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
        setChatMessages((prev) => {
          const lastMsg = prev[prev.length - 1];
          if (!lastMsg || lastMsg.type !== "streaming") {
            return prev;
          }
          const systemMsg = `System: ${lastMsg.content}`;
          const converted: ChatMessage = { type: "text", content: systemMsg };
          return [...prev.slice(0, -1), converted];
        });
        break;

      case "searchVdbResults":
        setSearchResults(payload);
        break;

      case "insertImage":
        const { datasetImageUrl, datasetDownloadUrl } = payload;
        setChatMessages((prev) => [
          ...prev,
          {
            type: "image",
            imageUrl: datasetImageUrl,
            downloadUrl: datasetDownloadUrl,
          },
        ]);
        break;

      default:
        console.log("Unknown action:", data);
    }
  };

  const replaceIframe = (wmsUrl: string) => {
    // Validation checks
    if (!wmsUrl || wmsUrl === "NONE" || wmsUrl.toLowerCase() === "none") {
      alert(`Invalid or missing WMS URL: ${wmsUrl || "none provided"}`);
      return;
    }

    // Valid URL - update iframe
    setIframeSrc(wmsUrl);
    setForceUpdate((prev) => prev + 1);
  };

  const onSearchSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!ws || ws.readyState !== WebSocket.OPEN) return;

    ws.send(
      JSON.stringify({
        action: "searchFormSubmit",
        payload: searchInput,
      })
    );
  };

  const onChatSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!ws || ws.readyState !== WebSocket.OPEN) return;

    ws.send(
      JSON.stringify({
        action: "chatFormSubmit",
        payload: chatInput,
      })
    );

    // Add user message immediately
    setChatMessages((prev) => [
      ...prev,
      { type: "text", content: `You: ${chatInput}` },
    ]);
    setChatInput("");
  };

  const onChatDragStart = () => {
    setChatDraggingZ(2);
    setSearchDraggingZ(1);
  };

  const onSearchDragStart = () => {
    setSearchDraggingZ(2);
    setChatDraggingZ(1);
  };

  const handleDatasetDownload = (downloadUrl: string) => {
    if (!downloadUrl) {
      console.error("No download URL provided.");
      return;
    }

    const link = document.createElement("a");
    link.href = downloadUrl;
    link.target = "_blank";
    link.download = ""; // You can specify a file name if needed
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div style={{ height: "100vh", width: "100vw", position: "relative" }}>
      {/* Map Iframe */}
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

      {/* Chat */}
      <Rnd
        bounds="window"
        default={{ x: 20, y: 20, width: 300, height: 400 }}
        style={{
          zIndex: chatDraggingZ,
          backgroundColor: "#ffffffee",
          display: "flex",
          flexDirection: "column",
          border: "1px solid #ccc",
          borderRadius: "6px",
        }}
        onDragStart={onChatDragStart}
      >
        <div
          style={{
            backgroundColor: "#eee",
            cursor: "move",
            padding: "4px",
            textAlign: "center",
          }}
        >
          <strong>GeoGPT Chat</strong>
        </div>

        <div
          id="chatMessages"
          style={{ flex: 1, padding: "8px", overflowY: "auto" }}
        >
          <div className="system-message">
            Hei! Jeg er GeoGPT. Spør meg om geodata!
          </div>

          {chatMessages.map((msg, idx) => {
            if (msg.type === "image" && msg.imageUrl) {
              return (
                <div
                  key={idx}
                  style={{
                    margin: "4px 0",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                  }}
                >
                  <img
                    src={msg.imageUrl}
                    alt="Dataset"
                    style={{
                      maxWidth: "100%",
                      height: "auto",
                      marginBottom: "8px",
                    }}
                  />
                  {msg.downloadUrl && (
                    <button
                      onClick={() => handleDatasetDownload(msg.downloadUrl!)}
                      style={{
                        padding: "4px 8px",
                        backgroundColor: "#28a745",
                        color: "#fff",
                        border: "none",
                        borderRadius: "4px",
                        cursor: "pointer",
                      }}
                    >
                      Last ned datasett
                    </button>
                  )}
                </div>
              );
            } else {
              let content = msg.content || "";
              let prefix = "";
              let rest = content;

              if (content.startsWith("You: ")) {
                prefix = "You: ";
                rest = content.slice("You: ".length);
              } else if (content.startsWith("System: ")) {
                prefix = "System: ";
                rest = content.slice("System: ".length);
              }

              return (
                <div
                  key={idx}
                  style={{
                    margin: "4px 0",
                    padding: "8px",
                    backgroundColor: "#f8f9fa",
                    borderRadius: "6px",
                    boxShadow: "0px 1px 3px rgba(0, 0, 0, 0.2)",
                  }}
                >
                  {prefix && <strong>{prefix}</strong>}
                  {rest}
                </div>
              );
            }
          })}
          <div ref={chatEndRef} />
        </div>

        <form
          onSubmit={onChatSubmit}
          style={{
            display: "flex",
            borderTop: "1px solid #ddd",
            padding: "8px",
          }}
        >
          <input
            type="text"
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            placeholder="Spør GeoGPT..."
            style={{
              flex: 1,
              padding: "8px",
              border: "1px solid #ccc",
              borderRadius: "4px",
              marginRight: "8px",
            }}
          />
          <button
            type="submit"
            style={{
              padding: "8px 16px",
              backgroundColor: "#007bff",
              color: "#fff",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
            }}
          >
            Send
          </button>
        </form>
      </Rnd>

      {/* Kartkatalog */}
      <Rnd
        bounds="window"
        default={{ x: 350, y: 20, width: 300, height: 400 }}
        style={{
          zIndex: searchDraggingZ,
          background: "#fff",
          border: "1px solid #ddd",
          borderRadius: "6px",
          display: "flex",
          flexDirection: "column",
        }}
        onDragStart={onSearchDragStart}
      >
        <div
          style={{
            padding: "8px",
            backgroundColor: "#eee",
            textAlign: "center",
            fontWeight: "bold",
          }}
        >
          Kartkatalogen
        </div>
        <form
          onSubmit={onSearchSubmit}
          style={{
            padding: "8px",
            borderBottom: "1px solid #ddd",
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Søk etter datasett..."
            style={{
              flex: 1,
              padding: "8px",
              border: "1px solid #ccc",
              borderRadius: "4px",
              outline: "none",
            }}
          />
          <button
            type="submit"
            style={{
              padding: "8px 16px",
              backgroundColor: "#007bff",
              color: "#fff",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >
            Søk
          </button>
        </form>
        <div style={{ flex: 1, overflowY: "auto", padding: "8px" }}>
          {searchResults.map((result) => (
            <div
              key={result.uuid}
              style={{
                marginBottom: "8px",
                border: "1px solid #ddd",
                borderRadius: "6px",
                padding: "8px",
                boxShadow: "0px 1px 3px rgba(0, 0, 0, 0.1)",
              }}
            >
              <a
                href={`https://kartkatalog.geonorge.no/metadata/${encodeURIComponent(
                  result.title || "Dataset"
                )}/${result.uuid}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  color: "#2563eb",
                  textDecoration: "none",
                  cursor: "pointer",
                  display: "inline-block",
                  marginBottom: "4px",
                  fontSize: "1.1em",
                  transition: "color 0.2s ease",
                }}
                className="hover:text-blue-800 hover:underline"
              >
                <strong>{result.title || "Dataset"}</strong>
              </a>
              <br />
              <div style={{ display: "flex", gap: "8px", marginTop: "8px" }}>
                {result.wmsUrl && result.wmsUrl !== "None" ? (
                  <button
                    onClick={() =>
                      result.wmsUrl && replaceIframe(result.wmsUrl)
                    }
                    style={{
                      padding: "4px 16px 4px 16px",
                      backgroundColor: "#28a745",
                      color: "#fff",
                      border: "none",
                      borderRadius: "4px",
                      cursor: "pointer",
                    }}
                  >
                    Vis
                  </button>
                ) : (
                  <button
                    style={{
                      padding: "4px 8px",
                      backgroundColor: "#dc3545",
                      color: "#fff",
                      border: "none",
                      borderRadius: "4px",
                      cursor: "not-allowed",
                      opacity: 0.65,
                    }}
                    disabled
                  >
                    Utilgjengelig (Prøv annet format)
                  </button>
                )}
                {result.restricted && (
                  <button
                    style={{
                      padding: "4px 8px",
                      backgroundColor: "red",
                      color: "#fff",
                      border: "none",
                      borderRadius: "4px",
                      cursor: "pointer",
                    }}
                  >
                    Låst (krever innlogging)
                  </button>
                )}
                {result.downloadUrl && (
                  <button
                    onClick={() => handleDatasetDownload(result.downloadUrl!)}
                    style={{
                      padding: "4px 8px",
                      backgroundColor: "#007bff",
                      color: "#fff",
                      border: "none",
                      borderRadius: "4px",
                      cursor: "pointer",
                    }}
                  >
                    Last ned
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </Rnd>
    </div>
  );
}

export default Demo;
