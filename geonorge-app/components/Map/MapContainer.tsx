import React from "react";
import { useMap } from "@/hooks/useMap";
import { useWmsLayers } from "@/hooks/useWmsLayers";
import { useChat } from "@/hooks/useChat"; 
import { BaseLayerOptions } from "@/types/map";
import { KartkatalogTab } from "@/components/kartkatalog-tab";
import { AppSidebar } from "@/components/app-sidebar";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogAction } from "@/components/ui/alert-dialog";

interface MapContainerProps {
  children?: React.ReactNode;
  ws: WebSocket | null;
}

export function MapContainer({ children, ws }: MapContainerProps) {
  const { mapState, mapRef, baseLayerControls } = useMap();
  const {
    availableLayers,
    trackedDatasets,
    handleLayerChangeWithDataset,
    removeTrackedDataset,
    replaceIframe,
    isDuplicateAlertOpen,
    setIsDuplicateAlertOpen,
    duplicateDatasetTitle
  } = useWmsLayers(mapState.map);
  
  const { handleDatasetDownload } = useChat(replaceIframe);

  // Create the base layer options object for AppSidebar
  const baseLayerOptions: BaseLayerOptions = {
    revertToBaseMap: baseLayerControls.revertToBaseMap,
    changeToGraattKart: baseLayerControls.changeToGraattKart,
    changeToRasterKart: baseLayerControls.changeToRasterKart,
  };

  return (
    <>
      <style jsx global>{`
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
          transition: background-color 0.2s ease !important;
        }

        .location-button:hover,
        .leaflet-control-zoom-in:hover,
        .leaflet-control-zoom-out:hover {
          background-color: #f35430 !important;
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
      `}</style>

      <div className="relative h-full w-full">
        <div ref={mapRef} className="absolute inset-0 z-0" id="map">
          {children}
        </div>
        
        {/* KartkatalogTab*/}
        <div className="fixed top-1/3 right-0 -translate-y-1/2 z-[401] rounded-lg shadow-lg">
          <KartkatalogTab
            onReplaceIframe={replaceIframe}
            onDatasetDownload={handleDatasetDownload}
            ws={ws}
          />
        </div>

        {/* AppSidebar*/}
        <div className="fixed left-0 top-0 z-[401] h-full">
          <AppSidebar
            availableLayers={availableLayers ?? []}
            trackedDatasets={trackedDatasets}
            onLayerChangeWithDataset={handleLayerChangeWithDataset}
            onRemoveDataset={removeTrackedDataset}
            onChangeBaseLayer={baseLayerOptions}
          />
        </div>
      </div>

      {/* AlertDialog for duplicate datasets */}
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
    </>
  );
}
