import { useState, useEffect, useCallback } from "react";
import { ChatMessage, WebSocketMessage, SearchResult, WMSLayer } from "./types";

export const useWebSocket = () => {
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [uuidToFind, setUuidToFind] = useState<string>("");
  const [specificObject, setSpecificObject] = useState<SearchResult | null>(
    null
  );
  const [datasetName, setDatasetName] = useState<string>("");
  const [geographicalAreas, setGeographicalAreas] = useState<
    Array<{ type: string; name: string; code: string }>
  >([]);
  const [projections, setProjections] = useState<
    Array<{ name: string; code: string }>
  >([]);
  const [formats, setFormats] = useState<string[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [reconnectAttempt, setReconnectAttempt] = useState(0);
  const [mapUpdates, setMapUpdates] = useState<{
    center?: [number, number];
    zoom?: number;
    layers?: string[];
    markers?: Array<{ lat: number; lng: number; label: string }>;
    findMyLocation?: boolean;
    addMarker?: boolean;
  }>({});

  const connectWebSocket = useCallback(() => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const host = window.location.hostname; // This will work in all environments
    const port = "8080"; // Your WebSocket port

    const wsUrl = `${protocol}//${host}:${port}`;
    const socket = new WebSocket(wsUrl);
    setWs(socket);

    socket.onopen = () => {
      setIsConnected(true);
      setReconnectAttempt(0);
      // Send an initial message when the connection opens
      socket.send(
        JSON.stringify({
          action: "searchFormSubmit",
          payload: "",
        })
      );
    };

    socket.onclose = () => {
      setIsConnected(false);
      // Attempt to reconnect after 2 seconds
      setTimeout(() => {
        if (reconnectAttempt < 5) {
          setReconnectAttempt((prev) => prev + 1);
          connectWebSocket();
        }
      }, 2000);
    };

    socket.onerror = (event) => {
      console.error("WebSocket error occurred:", event);
      setIsConnected(false);
      setMessages((prev) => [
        ...prev,
        {
          title: "Connection Error",
          type: "text",
          content:
            "System: Connection error. Please check your network connection.",
        },
      ]);
    };

    socket.onmessage = (event) => {
      try {
        const data: WebSocketMessage = JSON.parse(event.data);
        handleServerMessage(data);
      } catch (error) {
        console.error(error);
      }
    };

    setWs(socket);
  }, [reconnectAttempt]);

  useEffect(() => {
    connectWebSocket();
    return () => {
      if (ws) {
        ws.close();
      }
    };
  }, []);

  const dedupeAreas = (
    areas: Array<{ type: string; name: string; code: string }>
  ) => {
    return Array.from(new Map(areas.map((area) => [area.code, area])).values());
  };

  const dedupeProjections = (projs: Array<{ name: string; code: string }>) => {
    return Array.from(new Map(projs.map((proj) => [proj.code, proj])).values());
  };

  const dedupeFormats = (fmts: string[]) => {
    return Array.from(new Set(fmts));
  };

  const handleServerMessage = (data: WebSocketMessage) => {
    const { action, payload } = data;
    console.log("Received payload:", payload);
    console.log("Action:", action);
    switch (action) {
      case "chatStream":
        setIsStreaming(true);
        if (payload.isNewMessage && !payload.payload) break;
        setMessages((prev) => {
          const lastMsg = prev[prev.length - 1];
          if (
            !lastMsg ||
            lastMsg.type !== "streaming" ||
            payload.isNewMessage
          ) {
            return [
              ...prev,
              {
                title: "Streaming message",
                type: "streaming",
                content: payload.payload || "",
              },
            ];
          } else {
            return [
              ...prev.slice(0, -1),
              {
                ...lastMsg,
                content: lastMsg.content + (payload.payload || ""),
              },
            ];
          }
        });
        break;

      case "streamComplete":
        setIsStreaming(false);
        setMessages((prev) => {
          const lastMsg = prev[prev.length - 1];
          if (!lastMsg || lastMsg.type !== "streaming") return prev;
          return [
            ...prev.slice(0, -1),
            {
              title: "Stream Complete",
              type: "text",
              content: `System: ${lastMsg.content}`,
            },
          ];
        });
        break;

      case "searchVdbResults":
        setSearchResults(payload);
        break;

      case "insertImage":
        const {
          datasetImageUrl,
          datasetDownloadUrl,
          wmsUrl,
          datasetTitle,
          datasetUuid,
        } = payload;
        setMessages((prev) => [
          ...prev,
          {
            title: datasetTitle || "Bilde melding",
            type: "image",
            imageUrl: datasetImageUrl,
            downloadUrl: datasetDownloadUrl,
            wmsUrl: wmsUrl,
            uuid: datasetUuid,
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

          setSpecificObject(datasetObject || null);

          if (datasetObject) {
            setMessages((prev) => {
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

            const rawGeoAreas = datasetObject.downloadFormats.map(
              (fmt: any) => ({
                type: fmt.type,
                name: fmt.name,
                code: fmt.code,
              })
            );
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

            const rawFormats = datasetObject.downloadFormats.flatMap(
              (fmt: any) =>
                fmt.formats ? fmt.formats.map((format: any) => format.name) : []
            );
            setFormats(dedupeFormats(rawFormats));
          }
        }
        break;

      case "mapUpdate":
        console.log("Received map update:", payload);
        setMapUpdates(payload);
        break;
    }
  };

  const clearMapUpdates = useCallback(() => {
    setMapUpdates({});
  }, []);

  const sendMessage = (message: string) => {
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      // Attempt to reconnect if not connected
      if (!isConnected) {
        connectWebSocket();
      }
      return;
    }

    // Set isStreaming to true immediately when sending
    setIsStreaming(true);

    ws.send(JSON.stringify({ action: "chatFormSubmit", payload: message }));
    setMessages((prev) => [
      ...prev,
      {
        title: "Your message",
        type: "text",
        content: `You: ${message}`,
      },
    ]);
  };

  return {
    ws,
    setWs,
    messages,
    isStreaming,
    sendMessage,
    searchResults,
    uuidToFind,
    specificObject,
    datasetName,
    geographicalAreas,
    projections,
    formats,
    isConnected,
    mapUpdates,
    clearMapUpdates,
  };
};
