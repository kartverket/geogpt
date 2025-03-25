"use client";

import { useEffect, useState, useRef, FormEvent } from "react";
import { LogOut, MessageSquare } from "lucide-react";
import dynamic from "next/dynamic";

// Chat imports
import { useWebSocket } from "./chat/useWebSocket";
import { ChatWindow } from "./chat";
import { WMSLayer, SearchResult } from "./chat/types";

// Components
import { AppSidebar } from "@/components/app-sidebar";
import { KartkatalogTab } from "@/components/kartkatalog-tab";
import FileDownloadModal from "@/app/components/FileDownloadModal/FileDownloadModal";
import GeoNorgeIcon from "@/app/components/GeoNorgeIcon";

// UI Components
import { Button } from "@/components/ui/button";
import { Chat as FullScreenChat } from "@/components/ui/chat";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";

// Utils
import {
  dedupeFormats,
  dedupeAreas,
  dedupeProjections,
  getAreaFormatsAndProjections,
} from "@/utils/datasetUtils";

// Dynamically import MapContainer to avoid SSR issues
const MapWithNoSSR = dynamic(() => import("@/components/map-wrapper"), {
  ssr: false,
});

interface TrackedDataset {
  id: string;
  title: string;
  wmsUrl: string;
  availableLayers: WMSLayer[];
  selectedLayers: string[];
}

const DemoV3 = () => {
  // Map state
  const [map, setMap] = useState<any>(null);
  const [wmsLayer, setWmsLayer] = useState<Record<string, any>>({});
  const [userMarker, setUserMarker] = useState<{
    lat: number;
    lng: number;
  } | null>(null);
  const [searchMarker, setSearchMarker] = useState<{
    lat: number;
    lng: number;
  } | null>(null);

  // WMS and layer state
  const [wmsUrl, setWmsUrl] = useState<string>("");
  const [availableLayers, setAvailableLayers] = useState<WMSLayer[]>([]);
  const [selectedLayers, setSelectedLayers] = useState<string[]>([]);
  const [currentBaseLayer, setCurrentBaseLayer] = useState<string>("topo");

  // Download-related state
  const [isFileDownloadModalOpen, setFileDownloadModalOpen] =
    useState<boolean>(false);
  const [pendingDownloadUrl, setPendingDownloadUrl] = useState<string | null>(
    null
  );
  const [geographicalAreas, setGeographicalAreas] = useState<
    { type: string; name: string; code: string }[]
  >([]);
  const [projections, setProjections] = useState<
    { name: string; code: string }[]
  >([]);
  const [formats, setFormats] = useState<string[]>([]);
  const [datasetName, setDatasetName] = useState<string>("");

  const [specificObject, setSpecificObject] = useState<SearchResult | null>(
    null
  );
  const [trackedDatasets, setTrackedDatasets] = useState<TrackedDataset[]>([]);

  // Alert state
  const [isDuplicateAlertOpen, setIsDuplicateAlertOpen] = useState(false);
  const [duplicateDatasetTitle, setDuplicateDatasetTitle] = useState("");

  // Chat state
  const [chatInput, setChatInput] = useState<string>("");
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [blockPopoverClose, setBlockPopoverClose] = useState(false);
  const [ws, setWs] = useState<WebSocket | null>(null);

  // Use the WebSocket hook
  const { messages, isStreaming, sendMessage } = useWebSocket();

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

  // Manage interactions between modal and popover
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

  // Set up WebSocket connection
  useEffect(() => {
    // Dynamically determine the WebSocket URL based on current window location
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const host = window.location.hostname;
    const port = "8080";

    const wsUrl = `${protocol}//${host}:${port}`;
    const socket = new WebSocket(wsUrl);
    setWs(socket);

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

  // Map initialization and layer handling functions
  const handleMapReady = (mapInstance: any) => {
    setMap(mapInstance);
  };

  const fetchWMSInfo = async (
    urlToFetch?: string,
    datasetId?: string,
    datasetTitle?: string
  ) => {
    if (!urlToFetch && !wmsUrl) {
      return { available_layers: [] };
    }

    try {
      const apiUrl = `http://127.0.0.1:5000/wms-info?url=${encodeURIComponent(
        urlToFetch || wmsUrl
      )}`;
      const response = await fetch(apiUrl);
      const data = await response.json();

      if (datasetId) {
        setTrackedDatasets((prevDatasets) =>
          prevDatasets.map((dataset) =>
            dataset.id === datasetId
              ? {
                  ...dataset,
                  availableLayers: data.available_layers,
                  selectedLayers:
                    dataset.selectedLayers.length > 0
                      ? dataset.selectedLayers
                      : data.available_layers.length > 0
                      ? [data.available_layers[0].name]
                      : [],
                }
              : dataset
          )
        );
      } else {
        setAvailableLayers(data.available_layers);
        if (data.available_layers.length > 0 && selectedLayers.length === 0) {
          setSelectedLayers([data.available_layers[0].name]);
        }
      }

      return data;
    } catch (error) {
      console.error("Error fetching WMS info:", error);
      return { available_layers: [] };
    }
  };

  const replaceIframe = async (wmsUrl: any, datasetTitle?: string) => {
    if (
      !wmsUrl ||
      wmsUrl === "NONE" ||
      (typeof wmsUrl === "string" && wmsUrl.toLowerCase() === "none")
    ) {
      alert(`Invalid or missing WMS URL: ${wmsUrl || "none provided"}`);
      return;
    }

    let processedWmsUrl: string;
    let extractedLayers: WMSLayer[] = [];
    let extractedTitle: string | undefined = datasetTitle;

    if (typeof wmsUrl === "object" && wmsUrl.wms_url) {
      processedWmsUrl = wmsUrl.wms_url;
      extractedLayers = wmsUrl.available_layers || [];
      extractedTitle = wmsUrl.title || datasetTitle;
    } else {
      try {
        const wmsData =
          typeof wmsUrl === "string" && wmsUrl.startsWith("{")
            ? JSON.parse(wmsUrl)
            : { wms_url: wmsUrl };

        if (wmsData.wms_url) {
          processedWmsUrl = wmsData.wms_url;
          extractedLayers = wmsData.available_layers || [];
          extractedTitle = wmsData.title || datasetTitle;
        } else {
          processedWmsUrl = wmsUrl;
        }
      } catch (error) {
        processedWmsUrl = wmsUrl;
      }
    }

    const baseWmsUrl = processedWmsUrl.split("?")[0];
    const isDuplicate = trackedDatasets.some((dataset) => {
      const existingBaseUrl = dataset.wmsUrl.split("?")[0];
      return existingBaseUrl === baseWmsUrl;
    });

    if (isDuplicate) {
      setDuplicateDatasetTitle(extractedTitle || "Dette datasettet");
      setIsDuplicateAlertOpen(true);
      return;
    }

    const datasetId = `dataset-${Date.now()}`;
    const title = extractedTitle || `Dataset ${trackedDatasets.length + 1}`;

    if (extractedLayers.length === 0) {
      const layerData = await fetchWMSInfo(processedWmsUrl);
      extractedLayers = layerData.available_layers || [];
    }

    const newDataset: TrackedDataset = {
      id: datasetId,
      title: title,
      wmsUrl: processedWmsUrl,
      availableLayers: extractedLayers,
      selectedLayers:
        extractedLayers.length > 0 ? [extractedLayers[0].name] : [],
    };

    setTrackedDatasets((prev) => [...prev, newDataset]);
  };

  const removeTrackedDataset = (datasetId: string) => {
    setTrackedDatasets((prev) =>
      prev.filter((dataset) => dataset.id !== datasetId)
    );
  };

  const handleLayerChangeWithDataset = (
    datasetId: string,
    layerName: string,
    isChecked: boolean
  ) => {
    setTrackedDatasets((prevDatasets) =>
      prevDatasets.map((dataset) =>
        dataset.id === datasetId
          ? {
              ...dataset,
              selectedLayers: isChecked
                ? [...dataset.selectedLayers, layerName]
                : dataset.selectedLayers.filter(
                    (name: string) => name !== layerName
                  ),
            }
          : dataset
      )
    );
  };

  // Base layer management
  function setBaseLayer(layerType: string) {
    setCurrentBaseLayer(layerType);
  }

  function revertToBaseMap() {
    setBaseLayer("topo");
  }

  function changeToGraattKart() {
    setBaseLayer("graatone");
  }

  function changeToRasterKart() {
    setBaseLayer("raster");
  }

  function changeToSjoKart() {
    setBaseLayer("sjo");
  }

  // Download handling
  const handleAreaChange = (selectedAreaCode: string) => {
    if (!specificObject) return;

    const { projections: updatedProjections, formats: updatedFormats } =
      getAreaFormatsAndProjections(
        selectedAreaCode,
        specificObject.downloadFormats || []
      );

    setProjections(updatedProjections);
    setFormats(updatedFormats);
  };

  const executeDatasetDownload = (dataset: SearchResult) => {
    if (!dataset) {
      console.error("No dataset provided.");
      return;
    }

    setSpecificObject(dataset);

    const downloadFormats = dataset.downloadFormats || [];
    if (downloadFormats.length > 0) {
      // Extract and dedupe geographical areas
      const rawGeoAreas = downloadFormats.map(
        (fmt: { type: any; name: any; code: any }) => ({
          type: fmt.type,
          name: fmt.name,
          code: fmt.code,
        })
      );
      setGeographicalAreas(dedupeAreas(rawGeoAreas));

      // Extract projections and formats
      const rawProjections = downloadFormats
        .flatMap(
          (fmt: { projections?: { name: string; code: string }[] }) =>
            fmt.projections || []
        )
        .map((proj: { name: any; code: any }) => ({
          name: proj.name,
          code: proj.code,
        }));
      setProjections(dedupeProjections(rawProjections));

      const rawFormats = downloadFormats
        .flatMap((fmt: { formats?: { name: string }[] }) => fmt.formats || [])
        .map((format: { name: any }) => format.name);
      setFormats(dedupeFormats(rawFormats));

      setDatasetName(dataset.title || "");
      setPendingDownloadUrl(dataset.downloadUrl || null); // Store the standard download URL
      setFileDownloadModalOpen(true);
    } else if (dataset.downloadUrl) {
      // If no formats but URL exists, use standard download
      handleDirectDownload(dataset.downloadUrl);
    } else {
      console.warn("No download URL or formats available for this dataset");
    }
  };

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

  const confirmDownload = () => {
    if (!pendingDownloadUrl) return;
    handleDirectDownload(pendingDownloadUrl);
    setFileDownloadModalOpen(false);
    setPendingDownloadUrl(null);
  };

  const handleStandardDownload = () => {
    if (pendingDownloadUrl) {
      handleDirectDownload(pendingDownloadUrl);
    }
  };

  const handleModalClose = () => {
    setFileDownloadModalOpen(false);
  };

  // Chat handling
  const chatPopoverProps = {
    open: isPopoverOpen,
    onOpenChange: setIsPopoverOpen,
  };

  const handleSendMessage = (message: string) => {
    sendMessage(message);
  };

  const onChatSubmit = (e: FormEvent<HTMLFormElement>) => {
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
    handleSendMessage(chatInput);
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

  const handleFullScreenDownload = (url: string) => {
    // Find message with matching URL from messages array
    const messageWithUrl = messages.find((msg) => msg.downloadUrl === url);
    if (messageWithUrl) {
      // Create a SearchResult object from the message data
      const datasetObject: SearchResult = {
        uuid: messageWithUrl.uuid || "",
        title: messageWithUrl.title || "",
        downloadFormats: messageWithUrl.downloadFormats || [],
        downloadUrl: messageWithUrl.downloadUrl,
      };

      // Set the specific object for the modal
      setSpecificObject(datasetObject);

      // Process the download formats
      const downloadFormats = messageWithUrl.downloadFormats || [];
      if (downloadFormats.length > 0) {
        // Extract and dedupe geographical areas
        const rawGeoAreas = downloadFormats.map((fmt) => ({
          type: fmt.type,
          name: fmt.name,
          code: fmt.code,
        }));
        setGeographicalAreas(dedupeAreas(rawGeoAreas));

        // Extract and dedupe projections
        const rawProjections = downloadFormats
          .flatMap((fmt) => fmt.projections || [])
          .map((proj) => ({
            name: proj.name,
            code: proj.code,
          }));
        setProjections(dedupeProjections(rawProjections));

        // Extract and dedupe formats
        const rawFormats = downloadFormats.flatMap((fmt) =>
          fmt.formats ? fmt.formats.map((format) => format.name) : []
        );
        setFormats(dedupeFormats(rawFormats));

        // Set dataset name and URL
        setDatasetName(messageWithUrl.title || "");
        setPendingDownloadUrl(messageWithUrl.downloadUrl || null);

        // Open the modal
        setFileDownloadModalOpen(true);
      } else if (messageWithUrl.downloadUrl) {
        // If no formats but direct URL exists, handle standard download
        handleDirectDownload(messageWithUrl.downloadUrl);
      }
    } else {
      console.warn("No message found with the provided download URL");
    }
  };

  const handleAppend = (message: { role: "user"; content: string }) => {
    handleSendMessage(message.content);
  };

  const transformMessagesForChatKit = () => {
    return messages.map((msg, idx) => {
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

  const enterFullScreen = () => {
    setIsFullScreen(true);
    setIsPopoverOpen(false);
  };

  const exitFullScreen = () => {
    setIsFullScreen(false);
    setIsPopoverOpen(true);
  };

  // Suggestions for the full screen chat
  const suggestions = [
    "Hva er FKB?",
    "Hvilke datasett er nyttige for byggesaksbehandlere?",
    "Er det kvikkleire der jeg bor?",
  ];

  return (
    <>
      <div className="flex flex-col h-screen w-full overflow-hidden">
        <div className="relative flex-1">
          {/* Map container */}
          <div className="absolute inset-0 z-0" id="map">
            <MapWithNoSSR
              center={[65.5, 13.5]}
              zoom={5}
              currentBaseLayer={currentBaseLayer}
              trackedDatasets={trackedDatasets}
              wmsLayer={wmsLayer}
              userMarker={userMarker}
              searchMarker={searchMarker}
              setUserMarker={setUserMarker}
              setSearchMarker={setSearchMarker}
              onMapReady={handleMapReady}
              showAddressSearch={true}
            />

            {/* KartkatalogTab */}
            <div className="fixed top-[25%] right-0 -translate-y-0 z-[401] max-h-[450px]">
              <KartkatalogTab
                onReplaceIframe={replaceIframe}
                onDatasetDownload={executeDatasetDownload}
                ws={ws}
              />
            </div>

            {/* Chat popover */}
            <Popover {...chatPopoverProps}>
              <PopoverTrigger asChild>
                <Button
                  className="fixed bottom-6 right-10 bg-color-gn-primary hover:bg-color-gn-primarylight rounded-full p-0 h-16 w-16 flex items-center justify-center shadow-lg z-[1000]"
                  variant="default"
                >
                  <MessageSquare className="h-auto w-auto" />
                </Button>
              </PopoverTrigger>
              <PopoverContent
                side="top"
                align="end"
                className="w-[450px] h-[30rem] p-0 overflow-hidden shadow-lg rounded-lg"
              >
                <ChatWindow
                  messages={messages}
                  input={chatInput}
                  onInputChange={handleChatInputChange}
                  onSubmit={onChatSubmit}
                  isGenerating={isStreaming}
                  onWmsClick={replaceIframe}
                  onDownloadClick={handleFullScreenDownload}
                  onEnterFullScreen={enterFullScreen}
                  onClose={() => setIsPopoverOpen(false)}
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>

        {/* Full Screen Chat UI */}
        {isFullScreen && (
          <div className="fixed inset-0 z-[50] bg-white flex flex-col">
            <div className="flex justify-between items-center p-4 border-b container mx-auto">
              <div className="flex items-center">
                <GeoNorgeIcon />
                <h2 className="text-xl font-bold ml-2">GeoGPT</h2>
              </div>
              <Button
                variant="outline"
                onClick={exitFullScreen}
                className="group flex items-center justify-between hover:bg-gray-100 transition-colors duration-200 rounded-md px-3 py-2"
                aria-label="Forlat fullskjerm"
              >
                <div className="flex items-center gap-3">
                  <LogOut
                    size={16}
                    className="text-gray-500 group-hover:text-gray-700 transition-colors"
                  />
                  <span className="font-medium">Forlat fullskjerm</span>
                </div>
              </Button>
            </div>
            <div className="flex-1 flex flex-col overflow-hidden">
              <FullScreenChat
                messages={transformMessagesForChatKit()}
                handleSubmit={fullScreenHandleSubmit}
                input={chatInput}
                handleInputChange={fullScreenHandleInputChange}
                isGenerating={isStreaming}
                stop={() => {}}
                append={handleAppend}
                suggestions={suggestions}
                onWmsClick={replaceIframe}
                onDownloadClick={handleFullScreenDownload}
                onExitFullScreen={exitFullScreen}
                className="max-w-4xl mx-auto w-full flex-1 flex flex-col justify-end mb-10"
              />
            </div>
          </div>
        )}
        <div className="z-40">
          <AppSidebar
            availableLayers={availableLayers ?? []}
            trackedDatasets={trackedDatasets}
            onLayerChangeWithDataset={handleLayerChangeWithDataset}
            onRemoveDataset={removeTrackedDataset}
            onChangeBaseLayer={{
              revertToBaseMap,
              changeToGraattKart,
              changeToRasterKart,
              changeToSjoKart,
            }}
          />
        </div>

        <FileDownloadModal
          isOpen={isFileDownloadModalOpen}
          handleClose={handleModalClose}
          handleConfirmSelection={confirmDownload}
          handleStandardDownload={handleStandardDownload}
          geographicalAreas={geographicalAreas}
          projections={projections}
          formats={formats}
          datasetName={specificObject?.title || ""}
          onAreaChange={handleAreaChange}
          metadataUuid={specificObject?.uuid || ""}
        />

        {/*AlertDialog for duplicate datasets */}
        <AlertDialog
          open={isDuplicateAlertOpen}
          onOpenChange={setIsDuplicateAlertOpen}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Datasett finnes allerede</AlertDialogTitle>
              <AlertDialogDescription>
                <span className="font-medium">{duplicateDatasetTitle}</span> er
                allerede lagt til i kartet. Det er ikke mulig å legge til samme
                datasett flere ganger.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogAction
                onClick={() => setIsDuplicateAlertOpen(false)}
                className="text-white"
              >
                OK
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </>
  );
};

export default DemoV3;
