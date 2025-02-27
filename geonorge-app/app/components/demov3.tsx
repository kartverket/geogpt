"use client";

import { useEffect, useState, useRef, FormEvent } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { KartkatalogTab } from "@/components/kartkatalog-tab";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Chat as FullScreenChat } from "@/components/ui/chat";
import { MapPin, Maximize, MessageSquare } from "lucide-react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { ChatWindow } from "./chat";
import { useWebSocket } from "./chat/useWebSocket";
import { ChatMessage, WMSLayer, MessageType, Address } from "./chat/types";

const INITIAL_MAP_URL = "https://norgeskart.no/geoportal/#!?zoom=4.6366666666666685&lon=168670.22&lat=6789452.95&wms=https:%2F%2Fnve.geodataonline.no%2Farcgis%2Fservices%2FSkredKvikkleire2%2FMapServer%2FWMSServer&project=geonorge&layers=1002";

const DemoV3 = () => {
  // Map related state
  const [map, setMap] = useState<L.Map | null>(null);
  const [wmsLayer, setWmsLayer] = useState<L.TileLayer.WMS | null>(null);
  const [searchResults2, setSearchResults2] = useState<Address[]>([]);
  const [userMarker, setUserMarker] = useState<L.Marker | null>(null);
  const [searchMarker, setSearchMarker] = useState<L.Marker | null>(null);
  const [addressInput, setAddressInput] = useState("");
  const mapRef = useRef<HTMLDivElement>(null);

  // WMS related state
  const [wmsUrl, setWmsUrl] = useState(
    "https://nve.geodataonline.no/arcgis/services/SkredKvikkleire2/MapServer/WMSServer?request=GetCapabilities&service=WMS"
  );
  const [availableLayers, setAvailableLayers] = useState<WMSLayer[]>([]);
  const [selectedLayer, setSelectedLayer] = useState<string>("");

  // Chat related state
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [iframeSrc, setIframeSrc] = useState(INITIAL_MAP_URL);
  const [searchInput, setSearchInput] = useState("");

  // Use the WebSocket hook
  const { messages, isStreaming, sendMessage, ws } = useWebSocket();

  // Add this near the top of the file, after the imports
  useEffect(() => {
    // Fix Leaflet's default icon path issues
    delete (L.Icon.Default.prototype as any)._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconRetinaUrl:
        "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
      iconUrl:
        "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
      shadowUrl:
        "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
    });
  }, []);
  useEffect(() => {
    if (!mapRef.current || map) return;

    const mapInstance = L.map(mapRef.current, {
      zoomControl: false, // Disable default zoom controls
    }).setView([65.5, 13.5], 5);

    // GET POSITION BUTTUON ----->>>>------<<<<<<--<<-<-<-
    const LocationControl = L.Control.extend({
      onAdd: function (map: L.Map) {
        const container = L.DomUtil.create(
          "div",
          "leaflet-bar leaflet-control"
        );
        const button = L.DomUtil.create("a", "location-button", container);
        button.href = "#";
        button.title = "Find my location";
        button.innerHTML =
          '<div class="flex items-center justify-center w-full h-full"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-locate"><line x1="2" x2="5" y1="12" y2="12"/><line x1="19" x2="22" y1="12" y2="12"/><line x1="12" x2="12" y1="2" y2="5"/><line x1="12" x2="12" y1="19" y2="22"/><circle cx="12" cy="12" r="7"/></svg></div>';

        L.DomEvent.disableClickPropagation(button)
          .disableScrollPropagation(button)
          .on(button, "click", function (e) {
            L.DomEvent.preventDefault(e);
            navigator.geolocation.getCurrentPosition(
              (position) => {
                const { latitude, longitude } = position.coords;
                if (userMarker) {
                  map.removeLayer(userMarker);
                }
                const newMarker = L.marker([latitude, longitude]);
                newMarker.addTo(map);
                setUserMarker(newMarker);
                map.setView([latitude, longitude], 14);
              },
              (error) => {
                console.error("Error getting location:", error);
                alert(
                  "Kunne ikke hente din posisjon. Sjekk at du har gitt tillatelse til posisjonstjenester."
                );
              }
            );
          });

        return container;
      },
    });

    // Add the custom control below zoom controls
    new LocationControl({ position: "topright" }).addTo(mapInstance);
    // Add zoom control in custom position
    L.control
      .zoom({
        position: "topright",
      })
      .addTo(mapInstance);

    // Replace the OpenStreetMap tile layer with Kartverket's
    L.tileLayer(
      "https://cache.kartverket.no/v1/wmts/1.0.0/topo/default/webmercator/{z}/{y}/{x}.png",
      {
        maxZoom: 18,
        attribution:
          '&copy; <a href="http://www.kartverket.no/">Kartverket</a>',
      }
    ).addTo(mapInstance);

    setMap(mapInstance);
    fetchWMSInfo();

    return () => {
      mapInstance.remove();
    };
  }, []);

  const fetchWMSInfo = async () => {
    try {
      const apiUrl = `http://127.0.0.1:5000/wms-info?url=${encodeURIComponent(
        wmsUrl
      )}`;
      const response = await fetch(apiUrl);
      const data = await response.json();
      setAvailableLayers(data.available_layers);
      if (data.available_layers.length > 0) {
        setSelectedLayer(data.available_layers[0].name);
      }
    } catch (error) {
      console.error("Error fetching WMS info:", error);
    }
  };

  const updateLayer = () => {
    if (!map || !selectedLayer) return;

    if (wmsLayer) {
      map.removeLayer(wmsLayer);
    }

    const baseWmsUrl = wmsUrl.split("?")[0];
    const newWmsLayer = L.tileLayer.wms(baseWmsUrl, {
      layers: selectedLayer,
      format: "image/png",
      transparent: true,
      version: "1.3.0",
    });

    newWmsLayer.addTo(map);
    setWmsLayer(newWmsLayer);
  };

  const searchAddress = async (query: string) => {
    // Clear results if query is empty or too short
    if (!query || query.length < 3) {
      setSearchResults2([]);
      return;
    }

    try {
      const response = await fetch(
        `https://ws.geonorge.no/adresser/v1/sok?sok=${query}&treffPerSide=5`
      );
      const data = await response.json();
      setSearchResults2(data.adresser);
    } catch (error) {
      console.error("Error searching address:", error);
    }
  };

  const selectAddress = (address: Address) => {
    if (!map) return;

    const { lat, lon } = address.representasjonspunkt;

    if (searchMarker) {
      map.removeLayer(searchMarker);
    }

    const newMarker = L.marker([lat, lon]);
    newMarker.addTo(map);
    setSearchMarker(newMarker);

    map.setView([lat, lon], 14);
    setSearchResults2([]);
  };

  const getUserLocation = () => {
    if (!map) return;

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;

        if (userMarker) {
          map.removeLayer(userMarker);
        }

        const newMarker = L.marker([latitude, longitude]);
        newMarker.addTo(map);
        setUserMarker(newMarker);

        map.setView([latitude, longitude], 14);
      },
      (error) => {
        console.error("Error getting location:", error);
        alert(
          "Kunne ikke hente din posisjon. Sjekk at du har gitt tillatelse til posisjonstjenester."
        );
      }
    );
  };

  useEffect(() => {
    updateLayer();
  }, [selectedLayer]);

  // Basic state
  const [searchResults, setSearchResults] = useState<any[]>([]);

  // Update the interface for WMS data
  interface WMSData {
    wms_url: string;
    available_layers: WMSLayer[];
    available_formats: string[];
  }

  // Update the replaceIframe function
  const replaceIframe = (wmsUrl: any) => {
    // Handle object type WMS URL
    if (typeof wmsUrl === "object" && wmsUrl.wms_url) {
      setWmsUrl(wmsUrl.wms_url);
      if (wmsUrl.available_layers) {
        setAvailableLayers(wmsUrl.available_layers);
        if (wmsUrl.available_layers.length > 0) {
          setSelectedLayer(wmsUrl.available_layers[0].name);
        }
      }
      return;
    }

    // Handle string type WMS URL
    if (
      !wmsUrl ||
      wmsUrl === "NONE" ||
      (typeof wmsUrl === "string" && wmsUrl.toLowerCase() === "none")
    ) {
      alert(`Invalid or missing WMS URL: ${wmsUrl || "none provided"}`);
      return;
    }

    try {
      const wmsData =
        typeof wmsUrl === "string" && wmsUrl.startsWith("{")
          ? JSON.parse(wmsUrl)
          : { wms_url: wmsUrl };

      if (wmsData.wms_url) {
        setWmsUrl(wmsData.wms_url);
        if (wmsData.available_layers) {
          setAvailableLayers(wmsData.available_layers);
          if (wmsData.available_layers.length > 0) {
            setSelectedLayer(wmsData.available_layers[0].name);
          }
        } else {
          // If no layers provided, fetch them
          fetchWMSInfo();
        }
      }
    } catch (error) {
      // If parsing fails, treat it as a simple WMS URL
      setWmsUrl(wmsUrl);
      fetchWMSInfo();
    }
  };

  // For the non-fullscreen chat submit handler
  const onChatSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const trimmedInput = chatInput.trim();
    if (!trimmedInput || isStreaming) {
      console.log('⚠️ Chat submission prevented:', { isEmpty: !trimmedInput, isStreaming });
      return;
    }
    console.log('💬 Submitting chat message:', trimmedInput);
    sendMessage(trimmedInput);
    setChatInput("");
  };

  const handleSendMessage = (message: string) => {
    console.log('📨 Handling message send:', message);
    sendMessage(message);
  };

  // Full screen chat handlers
  const fullScreenHandleSubmit = (
    e?: { preventDefault?: () => void }
  ) => {
    if (e?.preventDefault) e.preventDefault();
    if (!chatInput.trim() || isStreaming) return;
    sendMessage(chatInput);
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
    return messages.map((msg, idx) => {
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

  const handleLayerChangeFromSidebar = (layerName: string) => {
    setSelectedLayer(layerName);
  };

  return (
    <>
      <style>
        {`
    #map {
      background-color: #FAFAFA;
    }
    
    /* Zoom and location controls styling */
    .leaflet-control-zoom a,
    .location-button {
      background-color: #FE642F !important;
      color: white !important;
      border: none !important;
      margin-bottom: 4px !important;
      margin-right: 8px !important;
      text-decoration: none !important;
      width: 36px !important;
      height: 34px !important;
      line-height: 34px !important;
      font-size: 14px !important;
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      padding: 0 !important;
      border-radius: 2px !important;
    }
    
    .leaflet-control-zoom-in {
      margin-bottom: 1px !important;
    }
    .leaflet-bar {
      border: none !important;
      box-shadow: none !important;
    }
    
    .leaflet-control-zoom {
      border: none !important;
    }
  `}
      </style>

      <div className="flex flex-col h-screen w-full overflow-hidden">
        <div className="relative flex-1">
          <div className="absolute inset-x-0 top-4 z-[20] flex justify-center mx-auto max-w-min">
            <div className="w-96 flex ">
              {/* Sidebar button */}
              <SidebarTrigger className="bg-[#FE642F] hover:bg-[#f35430] shadow-lg h-[42px] w-[42px] rounded-sm flex-shrink-0 mr-2" />
              <input
                type="text"
                placeholder="Søk etter adresse..."
                onChange={(e) => searchAddress(e.target.value)}
                className="w-full p-2 border rounded-sm"
              />
              {searchResults2.length > 0 && (
                <div className="absolute top-full mt-1 w-full border bg-white rounded-lg shadow-lg max-h-60 overflow-y-auto">
                  {searchResults2.map((addr, index) => (
                    <div
                      key={index}
                      onClick={() => selectAddress(addr)}
                      className="p-2 hover:bg-gray-100 cursor-pointer"
                    >
                      {addr.adressetekst}
                      {addr.poststed && `, ${addr.poststed}`}
                    </div>
                  ))}
                </div>
              )}
              {/* Location button in top-right */}
              {/* <button
                onClick={getUserLocation}
                className="text-sm text-white fixed top-4 right-4 bg-[#FE642F] hover:bg-[#f35430] h-[42px] px-3 rounded-sm flex items-center gap-2 z-[1000]"
              >
                <MapPin className="h-4 w-4 text-white" />
                Min Posisjon
              </button> */}
            </div>
          </div>

          {/* Map container */}
          <div ref={mapRef} className="absolute inset-0 z-0" id="map">
            {/* KartkatalogTab */}
            <div className="fixed top-1/3 right-0 -translate-y-1/2 z-[401] rounded-lg shadow-lg">
              <KartkatalogTab
                onReplaceIframe={replaceIframe}
                onDatasetDownload={handleDatasetDownload}
                ws={ws}
              />
            </div>

            <Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
              <PopoverTrigger asChild>
                <Button
                  className="fixed bottom-6 right-10 bg-[#FE642F] hover:bg-[#f35a30] rounded-full p-0 h-16 w-16 flex items-center justify-center shadow-lg z-[1000]"
                  variant="default"
                >
                  <MessageSquare className="h-auto w-auto" />
                </Button>
              </PopoverTrigger>
              <PopoverContent
                side="top"
                align="end"
                className="w-96 h-[28rem] p-0 overflow-hidden shadow-lg rounded-lg"
              >
                <ChatWindow
                  messages={messages}
                  input={chatInput}
                  onInputChange={(value) => setChatInput(value)}
                  onSubmit={onChatSubmit}
                  isStreaming={isStreaming}
                  onWmsClick={replaceIframe}
                  onDownloadClick={handleDatasetDownload}
                  onEnterFullScreen={enterFullScreen}
                  onClose={() => setIsPopoverOpen(false)}
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>
      </div>

      {/* Full Screen Chat UI */}
      {isFullScreen && (
        <div className="fixed inset-0 z-[1001] bg-white">
          <div className="flex justify-between items-center p-4 border-b container mx-auto">
            <h2 className="text-xl font-semibold">GeoGPT Chat</h2>
            <Button variant="outline" onClick={exitFullScreen}>
              Exit Full Screen
            </Button>
          </div>
          <div className="p-4 h-full">
            <FullScreenChat
              messages={transformMessagesForChatKit()}
              handleSubmit={(e) => {
                e?.preventDefault?.();
                if (!chatInput.trim() || isStreaming) return;
                handleSendMessage(chatInput);
                setChatInput("");
              }}
              input={chatInput}
              handleInputChange={(e) => setChatInput(e.target.value)}
              isGenerating={isStreaming}
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
      <AppSidebar
        selectedLayer={selectedLayer}
        setSelectedLayer={setSelectedLayer}
        availableLayers={availableLayers ?? []}
      />
    </>
  );
};

export default DemoV3;
