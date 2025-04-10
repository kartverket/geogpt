"use client";

import { useEffect, useRef, useState } from "react";

// Leaflet
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import type { Map as LeafletMap } from "leaflet";

// React Leaflet Components
import {
  MapContainer,
  Marker,
  Popup,
  TileLayer,
  useMap,
  WMSTileLayer,
} from "react-leaflet";

// UI Components import

// Icons
import { Compass, Loader2, Plus, Minus } from "lucide-react";

// Enhanced hook to handle all Leaflet event propagation
function useLeafletEventPropagation<T extends HTMLElement>() {
  const elementRef = useRef<T>(null);

  useEffect(() => {
    const currentRef = elementRef.current;
    if (typeof window === "undefined" || !currentRef) return;

    // Handle all necessary event propagations
    const handleEventPropagation = () => {
      if (L && L.DomEvent) {
        // Disable scroll propagation (zoom with mousewheel)
        L.DomEvent.disableScrollPropagation(currentRef);

        // Disable click propagation (prevents map clicks through controls)
        L.DomEvent.disableClickPropagation(currentRef);

        // Additional stopPropagation for specific events that might not be caught
        const stopEvents = (e: Event) => {
          e.stopPropagation();
        };

        // Add listeners for double click and drag events
        currentRef.addEventListener("dblclick", stopEvents);
        currentRef.addEventListener("mousedown", stopEvents);
        currentRef.addEventListener("touchstart", stopEvents);
      }
    };

    // Execute immediately if L is already available
    handleEventPropagation();

    return () => {
      // Clean up event listeners if component unmounts
      if (currentRef && L && L.DomEvent) {
        currentRef.removeEventListener("dblclick", (e: Event) =>
          e.stopPropagation()
        );
        currentRef.removeEventListener("mousedown", (e: Event) =>
          e.stopPropagation()
        );
        currentRef.removeEventListener("touchstart", (e: Event) =>
          e.stopPropagation()
        );
      }
    };
  }, []);

  return elementRef;
}

function LocationButton({
  setUserMarker,
}: {
  setUserMarker: (marker: { lat: number; lng: number } | null) => void;
}) {
  const map = useMap();
  const [isLocating, setIsLocating] = useState(false);
  const buttonRef = useLeafletEventPropagation<HTMLDivElement>();

  const handleClick = () => {
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setUserMarker({ lat: latitude, lng: longitude });
        map.setView([latitude, longitude], 14);
        setIsLocating(false);
      },
      (error) => {
        console.warn("Could not get location:", error);
        setIsLocating(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  };

  return (
    <div className="leaflet-top leaflet-right mr-2" ref={buttonRef}>
      <div className="leaflet-control">
        <button
          className="location-button"
          title="Find my location"
          onClick={handleClick}
          disabled={isLocating}
        >
          <div className="flex items-center justify-center w-full h-full">
            {isLocating ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <Compass size={18} />
            )}
          </div>
        </button>
      </div>
    </div>
  );
}

function ZoomControl() {
  const map = useMap();
  const controlRef = useLeafletEventPropagation<HTMLDivElement>();

  return (
    <div className="leaflet-top leaflet-right mr-2" ref={controlRef}>
      <div className="leaflet-control" style={{ marginTop: "64px" }}>
        <button
          className="zoom-button zoom-in"
          title="Zoom inn"
          onClick={() => map.zoomIn(1)}
          aria-label="Zoom inn"
        >
          <Plus size={18} />
        </button>
        <button
          className="zoom-button zoom-out"
          title="Zoom ut"
          onClick={() => map.zoomOut(1)}
          aria-label="Zoom ut"
        >
          <Minus size={18} />
        </button>
      </div>
    </div>
  );
}

// Map controller component to handle map references and state access
function MapController({
  onMapReady,
  searchMarker, // Pass searchMarker to MapController
}: {
  onMapReady: (map: LeafletMap) => void;
  searchMarker: { lat: number; lng: number } | null; // Add type
}) {
  const map = useMap();

  useEffect(() => {
    onMapReady(map);
    // Add a handler to prevent double-click zoom when interacting with controls
    map.doubleClickZoom.disable();
    const enableDoubleClickZoom = () => {
      map.doubleClickZoom.enable();
    };

    return () => {
      enableDoubleClickZoom();
    };
  }, [map, onMapReady]);

  // Effect to update map view when searchMarker changes
  useEffect(() => {
    if (searchMarker) {
      map.setView([searchMarker.lat, searchMarker.lng], 14); // Use map instance directly
    }
  }, [searchMarker, map]); // Add map dependency

  return null;
}

// Dynamic WMS Layer component to handle WMS layers
function DynamicWMSLayers({
  trackedDatasets,
  wmsLayer,
}: {
  trackedDatasets: any[];
  wmsLayer: Record<string, any>;
}) {
  return (
    <>
      {trackedDatasets.map((dataset) =>
        dataset.selectedLayers.map((layerName: string) => (
          <WMSTileLayer
            key={`${dataset.id}:${layerName}`}
            url={dataset.wmsUrl.split("?")[0]}
            layers={layerName}
            format="image/png"
            transparent={true}
            version="1.3.0"
            zIndex={10}
          />
        ))
      )}
    </>
  );
}

// Dynamic Markers component
function DynamicMarkers({
  userMarker,
  searchMarker,
  searchMarkers = [],
}: {
  userMarker: { lat: number; lng: number } | null; // Add specific types
  searchMarker: { lat: number; lng: number } | null; // Add specific types
  searchMarkers?: Array<{ lat: number; lng: number; label?: string }>;
}) {
  return (
    <>
      {userMarker && (
        <Marker position={[userMarker.lat, userMarker.lng]}>
          <Popup>User Location</Popup>
        </Marker>
      )}
      {/* Ensure Marker is rendered when searchMarker is not null */}
      {searchMarker && (
        <Marker position={[searchMarker.lat, searchMarker.lng]}>
          <Popup>
            Search Location: {searchMarker.lat.toFixed(4)},{" "}
            {searchMarker.lng.toFixed(4)}
          </Popup>
        </Marker>
      )}
      {searchMarkers &&
        searchMarkers.map((marker, index) => (
          <Marker
            key={`search-marker-${index}`}
            position={[marker.lat, marker.lng]}
          >
            {marker.label && <Popup>{marker.label}</Popup>}
          </Marker>
        ))}
    </>
  );
}

interface MapWrapperProps {
  center: [number, number];
  zoom: number;
  currentBaseLayer: string;
  trackedDatasets: any[];
  wmsLayer: Record<string, any>;
  userMarker: any;
  searchMarker: any;
  searchMarkers?: Array<{ lat: number; lng: number; label?: string }>;
  setUserMarker: (marker: { lat: number; lng: number } | null) => void;
  onMapReady: (map: LeafletMap) => void;
}

const MapWrapper: React.FC<MapWrapperProps> = ({
  center,
  zoom,
  currentBaseLayer,
  trackedDatasets,
  wmsLayer,
  userMarker,
  searchMarker, // This prop receives the state from the parent
  searchMarkers = [],
  setUserMarker,
  onMapReady,
}) => {
  const mapRef = useRef<LeafletMap | null>(null);

  // Move the Leaflet icon setup inside the component
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
    const styleElement = document.createElement("style");
    styleElement.textContent = `
    /* Zoom control positioning */
    .leaflet-control-zoom {
      display: none !important; 
    }
  
    /* Shared button styles for zoom and location */
    .zoom-button,
    .location-button {
      background-color: #fe642f !important;
      color: white !important;
      border: none !important;
      width: 44px !important;
      top: 8px !important;
      height: 44px !important; 
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      padding: 0 !important;
      border-radius: 2px !important;
      margin-bottom: 8px !important; 
      position: relative !important;
      font-size: 16px !important; 
      font-weight: bold !important;
      cursor: pointer !important;
      user-select: none !important;
      touch-action: none !important;
    }
  
    .location-button:disabled {
      cursor: not-allowed !important;
      background-color: rgba(254, 80, 0, 0.6) !important;
    }

    /* Add this to control map background color */
    .leaflet-container {
      background-color: #FAFAFA !important;
    }
      
    /* Hover effects - only apply to non-disabled buttons */
    .zoom-button:hover,
    .location-button:not(:disabled):hover {
      background-color: #ff7e4d !important;
    }

    /* Prevent drag interactions from controls propagating to map */
    .leaflet-control {
      pointer-events: auto !important;
    }
    `;
    document.head.appendChild(styleElement);

    return () => {
      document.head.removeChild(styleElement);
    };
  }, []);

  const handleMapReady = (map: LeafletMap) => {
    mapRef.current = map;
    if (onMapReady) {
      onMapReady(map);
    }
  };

  return (
    <MapContainer
      center={center}
      zoom={zoom}
      style={{ height: "100%", width: "100%" }}
      zoomControl={false}
      attributionControl={false}
      className="z-0"
    >
      {/* Pass searchMarker to MapController */}
      <MapController onMapReady={handleMapReady} searchMarker={searchMarker} />

      {/* Base Layers */}
      {currentBaseLayer === "topo" && (
        <TileLayer url="https://cache.kartverket.no/v1/wmts/1.0.0/topo/default/webmercator/{z}/{y}/{x}.png" />
      )}
      {currentBaseLayer === "graatone" && (
        <TileLayer url="https://cache.kartverket.no/v1/wmts/1.0.0/topograatone/default/webmercator/{z}/{y}/{x}.png" />
      )}
      {currentBaseLayer === "raster" && (
        <TileLayer url="https://cache.kartverket.no/v1/wmts/1.0.0/toporaster/default/webmercator/{z}/{y}/{x}.png" />
      )}
      {currentBaseLayer === "sjo" && (
        <TileLayer url="https://cache.kartverket.no/v1/wmts/1.0.0/sjokartraster/default/webmercator/{z}/{y}/{x}.png" />
      )}

      <DynamicWMSLayers trackedDatasets={trackedDatasets} wmsLayer={wmsLayer} />

      {/* Markers - Ensure this component receives the searchMarker prop */}
      <DynamicMarkers
        userMarker={userMarker}
        searchMarker={searchMarker}
        searchMarkers={searchMarkers}
      />

      <LocationButton setUserMarker={setUserMarker} />
      <ZoomControl />
    </MapContainer>
  );
};

export default MapWrapper;
