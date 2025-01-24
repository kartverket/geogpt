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
}

interface SearchResult {
    uuid: string;
    title?: string;
    [key: string]: any;
}

function Bostaclat() {
    const [ws, setWs] = useState<WebSocket | null>(null);

    // Chat messages can be text, image, or streaming
    const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
    const [chatInput, setChatInput] = useState("");
    const chatEndRef = useRef<HTMLDivElement>(null);

    // For layering the two Rnd windows
    const [chatDraggingZ, setChatDraggingZ] = useState(2);
    const [searchDraggingZ, setSearchDraggingZ] = useState(1);

    // For search
    const [searchInput, setSearchInput] = useState("");
    const [searchResults, setSearchResults] = useState<SearchResult[]>([]);

    // Iframe for the map
    const [iframeSrc, setIframeSrc] = useState(
        "https://norgeskart.no/geoportal/#!?zoom=4.6366666666666685&lon=168670.22&lat=6789452.95&wms=https:%2F%2Fnve.geodataonline.no%2Farcgis%2Fservices%2FSkredKvikkleire2%2FMapServer%2FWMSServer&project=geonorge&layers=1002"
    );

    // Download format menu
    const [showDownloadDropdown, setShowDownloadDropdown] = useState(false);

    // --- SETUP WEBSOCKET ---
    useEffect(() => {
        const socket = new WebSocket("ws://localhost:8080");
        setWs(socket);

        socket.onopen = () => {
            console.log("WebSocket connected!");
        };
        socket.onerror = (err) => {
            console.error("WebSocket error:", err);
        };
        socket.onmessage = (event) => {
            const data: MessageType = JSON.parse(event.data);
            handleServerMessage(data);
        };
        socket.onclose = () => {
            console.log("WebSocket closed.");
        };

        return () => {
            socket.close();
        };
    }, []);

    // Scroll chat to bottom whenever chatMessages change
    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [chatMessages]);

    // --- HANDLE INCOMING SERVER MESSAGES ---
    const handleServerMessage = (data: MessageType) => {
        const { action, payload } = data;
        console.log("Incoming action:", action, "payload:", payload);

        switch (action) {
            case "chatStream":
                // GPT partial chunk
                // 1) If there's no "streaming" message yet, create one
                // 2) Otherwise, append to the existing streaming message content
                setChatMessages((prev) => {
                    const lastMsg = prev[prev.length - 1];
                    if (!lastMsg || lastMsg.type !== "streaming") {
                        // Create a new "streaming" message
                        return [...prev, { type: "streaming", content: payload }];
                    } else {
                        // Append to the existing streaming message
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
                    // Prepend "System: " to the final text
                    const systemMsg = `System: ${lastMsg.content}`;
                    const converted: ChatMessage = { type: "text", content: systemMsg };
                    return [...prev.slice(0, -1), converted];
                });
                break;

            case "userMessage":
                // The server might echo user input
                setChatMessages((prev) => [
                    ...prev,
                    { type: "text", content: `You: ${payload}` },
                ]);
                break;

            case "systemMessage":
                // Some final system response
                setChatMessages((prev) => [
                    ...prev,
                    { type: "text", content: `System: ${payload}` },
                ]);
                break;

            case "searchVdbResults":
                // Vector DB search results
                setSearchResults(payload);
                break;

            case "insertImage":
                // Show an image from the server
                const { datasetImageUrl } = payload;
                setChatMessages((prev) => [
                    ...prev,
                    { type: "image", imageUrl: datasetImageUrl },
                ]);
                break;

            case "downloadDatasetOrder":
                // The server returned a direct download link
                setChatMessages((prev) => [
                    ...prev,
                    { type: "text", content: `Download link: ${payload}` },
                ]);
                break;

            default:
                console.log("Unknown action:", data);
        }
    };

    // --- SEND MESSAGES / FORMS ---
    const onChatSubmit = (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!ws || ws.readyState !== WebSocket.OPEN) return;

        ws.send(
            JSON.stringify({
                action: "chatFormSubmit",
                payload: chatInput,
            })
        );
        setChatInput("");
    };

    const onSearchSubmit = (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!ws || ws.readyState !== WebSocket.OPEN) return;
        setSearchResults([]);
        ws.send(
            JSON.stringify({
                action: "searchFormSubmit",
                payload: searchInput,
            })
        );
    };

    // For the IFrame
    const replaceIframe = (newUrl: string) => {
        const baseUrl =
            "https://norgeskart.no/geoportal/#!?zoom=4.6366666666666685&lon=168670.22&lat=6789452.95&wms=";
        const wmsIndex = newUrl.indexOf("wms=");
        if (wmsIndex !== -1) {
            const wmsValue = newUrl.substring(wmsIndex + 4);
            setIframeSrc(baseUrl + wmsValue);
        }
    };

    // --- DRAG / RESIZE HANDLERS ---
    const onChatDragStart = () => {
        setChatDraggingZ(2);
        setSearchDraggingZ(1);
    };
    const onSearchDragStart = () => {
        setSearchDraggingZ(2);
        setChatDraggingZ(1);
    };

    // For the dropdown menu
    const toggleDownloadFormatsMenu = () => {
        setShowDownloadDropdown((prev) => !prev);
    };
    const onDownloadFormatChange = () => {
        console.log("Download format changed...");
    };

    // --- RENDER ---
    return (
        <div className="App" style={{ height: "100vh", width: "100vw" }}>
            <iframe
                id="iframe-map"
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

            {/* DRAGGABLE/RESIZABLE CHAT */}
            <Rnd
                bounds="window"
                default={{ x: 100, y: 100, width: 300, height: 400 }}
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
                {/* Chat header (drag handle) */}
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

                {/* Chat messages */}
                <div
                    id="chatMessages"
                    style={{ flex: 1, padding: "8px", overflowY: "auto" }}
                >
                    <div className="system-message">
                        Hei! Jeg er GeoGPT. Spør meg om geodata!
                    </div>

                    {chatMessages.map((msg, idx) => {
                        if (msg.type === "image" && msg.imageUrl) {
                            // Render an image
                            return (
                                <div key={idx} style={{ margin: "4px 0" }}>
                                    <img
                                        src={msg.imageUrl}
                                        alt="Dataset"
                                        style={{ maxWidth: "100%", height: "auto" }}
                                    />
                                </div>
                            );
                        } else {
                            // For text/streaming
                            let content = msg.content || "";

                            // If it starts with "You: " or "System: "
                            // we can split the prefix from the rest
                            let prefix = "";
                            let rest = content;

                            // Check if it starts with "You: "
                            if (content.startsWith("You: ")) {
                                prefix = "You: ";
                                rest = content.slice("You: ".length);
                            } else if (content.startsWith("System: ")) {
                                prefix = "System: ";
                                rest = content.slice("System: ".length);
                            }

                            return (
                                <div key={idx} style={{ margin: "4px 0" }}>
                                    {/* If prefix is non-empty, render it in bold */}
                                    {prefix && <strong>{prefix}</strong>}
                                    {rest}
                                </div>
                            );
                        }
                    })}

                    <div ref={chatEndRef} />
                </div>

                {/* Chat form */}
                <form
                    onSubmit={onChatSubmit}
                    style={{ display: "flex", borderTop: "1px solid #ccc" }}
                >
                    <input
                        type="text"
                        value={chatInput}
                        onChange={(e) => setChatInput(e.target.value)}
                        placeholder="Spør GeoGPT..."
                        style={{ flex: 1, border: "none", padding: "8px" }}
                    />
                    <button
                        type="submit"
                        style={{ border: "none", padding: "0 16px", cursor: "pointer" }}
                    >
                        Send
                    </button>
                </form>
            </Rnd>

            {/* DRAGGABLE/RESIZABLE SEARCH */}
            <Rnd
                bounds="window"
                default={{ x: 420, y: 100, width: 300, height: 400 }}
                style={{
                    zIndex: searchDraggingZ,
                    backgroundColor: "#ffffffee",
                    border: "1px solid #ccc",
                    borderRadius: "6px",
                    display: "flex",
                    flexDirection: "column",
                }}
                onDragStart={onSearchDragStart}
            >
                <div
                    style={{
                        backgroundColor: "#ddd",
                        padding: "4px",
                        cursor: "move",
                        textAlign: "center",
                    }}
                >
                    <strong>Kartkatalogen</strong>
                </div>

                <form
                    onSubmit={onSearchSubmit}
                    style={{ padding: "8px", borderBottom: "1px solid #ccc" }}
                >
                    <input
                        type="text"
                        value={searchInput}
                        onChange={(e) => setSearchInput(e.target.value)}
                        placeholder="Søk etter datasett..."
                        style={{ width: "70%", marginRight: "8px" }}
                    />
                    <button type="submit">Søk</button>
                </form>

                <div
                    style={{
                        display: "flex",
                        justifyContent: "space-between",
                        padding: "8px",
                        borderBottom: "1px solid #ccc",
                    }}
                >
                    <div style={{ position: "relative" }}>
                        <input
                            type="text"
                            placeholder="Filter"
                            style={{ width: "100px", marginRight: "4px" }}
                        />
                    </div>

                    <div style={{ position: "relative" }}>
                        <button
                            type="button"
                            onClick={toggleDownloadFormatsMenu}
                            style={{ cursor: "pointer" }}
                        >
                            Nedlastning Formater
                        </button>
                        {showDownloadDropdown && (
                            <div
                                style={{
                                    position: "absolute",
                                    top: "30px",
                                    right: 0,
                                    border: "1px solid #ccc",
                                    backgroundColor: "#fff",
                                    padding: "8px",
                                    zIndex: 99,
                                }}
                            >
                                <form onChange={onDownloadFormatChange}>
                                    <div>
                                        <label>Geografisk område:</label>
                                        <select name="searchDownloadArea">
                                            <option value="Hele landet">Hele landet</option>
                                            <option value="Agder">Agder</option>
                                            <option value="Akershus">Akershus</option>
                                            <option value="Buskerud">Buskerud</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label>Projeksjon:</label>
                                        <select name="searchDownloadProjection">
                                            <option value="EUREF89 UTM sone 33, 2d">
                                                EUREF89 UTM sone 33, 2d
                                            </option>
                                            <option value="EUREF89 UTM sone 32, 2d">
                                                EUREF89 UTM sone 32, 2d
                                            </option>
                                        </select>
                                    </div>
                                    <div>
                                        <label>Format:</label>
                                        <select name="searchDownloadFormat">
                                            <option value="GML">GML</option>
                                            <option value="PostGIS">PostGIS</option>
                                            <option value="FGDB">FGDB</option>
                                            <option value="SOSI">SOSI</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label>Brukergruppe:</label>
                                        <select name="searchDownloadUserGroup">
                                            <option value="GeoGPT">GeoGPT</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label>Formål:</label>
                                        <select name="searchDownloadUsagePurpose">
                                            <option value="Beredskap">Beredskap</option>
                                            <option value="Forskning">Forskning</option>
                                        </select>
                                    </div>
                                </form>
                            </div>
                        )}
                    </div>
                </div>

                <div style={{ flex: 1, overflowY: "auto", padding: "8px" }}>
                    {searchResults.map((res, idx) => (
                        <div
                            key={res.uuid || idx}
                            style={{
                                marginBottom: "8px",
                                border: "1px solid #ddd",
                                padding: "4px",
                            }}
                        >
                            <strong>{res.title || `Dataset #${idx + 1}`}</strong>
                            <br />
                            <button
                                onClick={() => {
                                    if (res.wmsUrl) {
                                        replaceIframe(`someBase?wms=${res.wmsUrl}`);
                                    }
                                }}
                            >
                                Show
                            </button>
                            <button
                                onClick={() => {
                                    if (ws && ws.readyState === WebSocket.OPEN) {
                                        ws.send(
                                            JSON.stringify({
                                                action: "downloadDataset",
                                                payload: {
                                                    uuid: res.uuid,
                                                    selectedFormats: {
                                                        areaName: "Hele landet",
                                                        areaCode: "0000",
                                                    },
                                                },
                                            })
                                        );
                                    }
                                }}
                            >
                                Download
                            </button>
                        </div>
                    ))}
                </div>
            </Rnd>
        </div>
    );
}

export default Bostaclat;