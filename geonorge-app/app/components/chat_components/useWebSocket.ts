import { useState, useEffect, useCallback } from "react";
import { ChatMessage, WebSocketMessage, SearchResult } from "./types";

export const useWebSocket = () => {
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [uuidToFind, setUuidToFind] = useState<string>("");
  const [specificObject, setSpecificObject] = useState<SearchResult | null>(null);
  const [datasetName, setDatasetName] = useState<string>("");
  const [geographicalAreas, setGeographicalAreas] = useState<Array<{ type: string; name: string; code: string }>>([]);
  const [projections, setProjections] = useState<Array<{ name: string; code: string }>>([]);
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
    const host = window.location.hostname;
    const port = "8080";
    const wsUrl = `${protocol}//${host}:${port}`;
    const socket = new WebSocket(wsUrl);
    setWs(socket);

    socket.onopen = () => {
      setIsConnected(true);
      setReconnectAttempt(0);
      socket.send(JSON.stringify({ action: "searchFormSubmit", payload: "" }));
    };

    socket.onclose = () => {
      setIsConnected(false);
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
          content: "System: Connection error. Please check your network connection.",
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

  const dedupeAreas = (areas: Array<{ type: string; name: string; code: string }>) => {
    return Array.from(new Map(areas.map((area) => [area.code, area])).values());
  };

  const dedupeProjections = (projs: Array<{ name: string; code: string }>) => {
    return Array.from(new Map(projs.map((proj) => [proj.code, proj])).values());
  };

  const dedupeFormats = (fmts: string[]) => {
    return Array.from(new Set(fmts));
  };

  const fetchLegendUrls = async (wmsUrl: string, layers: any[]) => {
    const getCapabilitiesUrl = wmsUrl.includes("?")
        ? `${wmsUrl}&request=GetCapabilities&service=WMS`
        : `${wmsUrl}?request=GetCapabilities&service=WMS`;

    console.log("🌐 Fetching GetCapabilities from:", getCapabilitiesUrl);

    try {
      const response = await fetch(getCapabilitiesUrl);
      const text = await response.text();
      const parser = new DOMParser();
      const xml = parser.parseFromString(text, "text/xml");

      return layers.map((layer) => {
        console.log(`🔎 Looking for legend for layer: ${layer.name}`);
        const layerNode = Array.from(xml.getElementsByTagName("Layer")).find((el) => {
          const nameNode = el.getElementsByTagName("Name")[0];
          return nameNode && nameNode.textContent === layer.name;
        });

        let legendUrl: string | undefined = undefined;
        if (layerNode) {
          const legendNode = layerNode.querySelector("LegendURL > OnlineResource");
          if (legendNode) {
            legendUrl = legendNode.getAttribute("xlink:href") || undefined;
            console.log(`🖼️ Found legend URL for ${layer.name}: ${legendUrl}`);
          } else {
            console.warn(`⚠️ No legend found for layer: ${layer.name}`);
          }
        } else {
          console.warn(`❌ Layer node not found in XML for: ${layer.name}`);
        }

        return {
          ...layer,
          legendUrl,
        };
      });
    } catch (err) {
      console.error("Failed to fetch legend URLs:", err);
      return layers;
    }
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
          if (!lastMsg || lastMsg.type !== "streaming" || payload.isNewMessage) {
            return [
              ...prev,
              { title: "Streaming message", type: "streaming", content: payload.payload || "" },
            ];
          } else {
            return [
              ...prev.slice(0, -1),
              { ...lastMsg, content: lastMsg.content + (payload.payload || "") },
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
            { title: "Stream Complete", type: "text", content: `System: ${lastMsg.content}` },
          ];
        });
        break;

      case "searchVdbResults":
        console.log("[WebSocket] Received searchVdbResults:", payload);

        Promise.all(
            payload.map(async (dataset: any, index: number) => {
              const wmsUrl = dataset.wms_url || dataset.wmsUrl?.wms_url;
              const layers = dataset.available_layers || dataset.wmsUrl?.available_layers;

              console.log(`📦 Dataset #${index + 1}: ${dataset.title}`);
              console.log("🔍 Extracted wmsUrl:", wmsUrl);
              console.log("📊 Layers:", layers);

              if (wmsUrl && layers && layers.length > 0) {
                const enrichedLayers = await fetchLegendUrls(wmsUrl, layers);
                console.log("✅ Enriched layers with legendUrls:", enrichedLayers);

                return {
                  ...dataset,
                  available_layers: enrichedLayers,
                };
              } else {
                console.warn("⚠️ Missing wmsUrl or layers for dataset:", dataset.title);
              }

              return dataset;
            })
        ).then((enriched) => {
          console.log("🎉 Final enriched dataset list:", enriched);
          setSearchResults(enriched);
        });
        break;

      case "insertImage":
        const { datasetImageUrl, datasetDownloadUrl, wmsUrl } = payload;
        setMessages((prev) => [
          ...prev,
          {
            title: "Image message",
            type: "image",
            imageUrl: datasetImageUrl,
            downloadUrl: datasetDownloadUrl,
            wmsUrl,
          },
        ]);
        break;

      case "chatDatasets":
        if (payload && Array.isArray(payload)) {
          const firstUuid = payload[0].uuid;
          setUuidToFind(firstUuid);
          const datasetObject = payload.find((item: SearchResult) => item.uuid === firstUuid);
          setSpecificObject(datasetObject || null);

          if (datasetObject) {
            setMessages((prev) => {
              const lastIndex = prev.length - 1;
              for (let i = lastIndex; i >= 0; i--) {
                if (
                    prev[i].type === "image" &&
                    (!prev[i].downloadFormats || prev[i].downloadFormats?.length === 0)
                ) {
                  const updatedMessages = [...prev];
                  updatedMessages[i] = {
                    ...prev[i],
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
            const rawGeoAreas = datasetObject.downloadFormats.map((fmt) => ({
              type: fmt.type,
              name: fmt.name,
              code: fmt.code,
            }));
            setGeographicalAreas(dedupeAreas(rawGeoAreas));

            const rawProjections = datasetObject.downloadFormats.flatMap((fmt) =>
                fmt.projections ? fmt.projections.map((proj) => ({ name: proj.name, code: proj.code })) : []
            );
            setProjections(dedupeProjections(rawProjections));

            const rawFormats = datasetObject.downloadFormats.flatMap((fmt) =>
                fmt.formats ? fmt.formats.map((format) => format.name) : []
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

  const sendMessage = (message: string) => {
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      if (!isConnected) {
        connectWebSocket();
      }
      return;
    }

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
  };
};
