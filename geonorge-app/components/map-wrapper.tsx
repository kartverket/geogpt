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
import { SidebarTrigger } from "@/components/ui/sidebar";

// Icons
import { Compass, Loader2, Search, X, Plus, Minus } from "lucide-react";

interface Address {
  adressetekst: string;
  poststed?: string;
  representasjonspunkt: {
    lat: number;
    lon: number;
  };
}

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

function AddressSearch({
  setSearchMarker,
  onKartkatalogSearchRequest,
}: {
  setSearchMarker: (marker: { lat: number; lng: number } | null) => void;
  onKartkatalogSearchRequest: (query: string) => void;
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Address[]>([]);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchContainerRef = useLeafletEventPropagation<HTMLDivElement>();
  const map = useMap();

  // Address fetching
  useEffect(() => {
    const fetchAddresses = async () => {
      if (!searchQuery || searchQuery.length < 3) {
        setSearchResults([]);
        return;
      }

      try {
        const response = await fetch(
          `https://ws.geonorge.no/adresser/v1/sok?sok=${searchQuery}&treffPerSide=8`
        );
        if (!response.ok) throw new Error("Feil ved henting av adresser");
        const data = await response.json();
        setSearchResults(data.adresser || []);
      } catch (error) {
        console.error("Feil ved søk:", error);
        setSearchResults([]);
      }
    };

    const timeoutId = setTimeout(fetchAddresses, 300);
    return () => clearTimeout(timeoutId);
  }, [searchQuery]);

  // Focus search input on mount
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "/" && document.activeElement !== searchInputRef.current) {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  const selectAddress = (address: Address) => {
    const { lat, lon } = address.representasjonspunkt;
    setSearchMarker({ lat, lng: lon });
    map.setView([lat, lon], 14);
    setSearchQuery(address.adressetekst);
    setSearchResults([]);
  };

  const clearSearch = () => {
    setSearchQuery("");
    setSearchResults([]);
    searchInputRef.current?.focus();
  };

  // Handle Enter key press for Kartkatalog search redirection
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (
      e.key === "Enter" &&
      searchResults.length === 0 &&
      searchQuery.trim() !== ""
    ) {
      e.preventDefault(); // Prevent default form submission if any
      onKartkatalogSearchRequest(searchQuery);
      // Optionally clear the address search input after redirecting
      // setSearchQuery('');
    }
  };

  return (
    <div
      className="absolute inset-x-0 top-4 z-[1000] flex justify-center mx-auto"
      ref={searchContainerRef}
    >
      <div className="w-96 flex">
        {/* Sidebar trigger */}
        <SidebarTrigger
          className="bg-color-gn-primary hover:bg-color-gn-primarylight text-white 
            h-12 w-12 rounded-omar flex-shrink-0 
            flex items-center justify-center mr-2"
        />{" "}
        <div className="relative w-full ">
          {/* Search input */}
          <div className="flex items-center relative ">
            <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 pointer-events-none">
              <Search size={18} className="text-color-gn-primary" />
            </div>
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              placeholder="Søk etter adresse... (trykk / for å søke)"
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              aria-label="Address search"
              className="w-full h-12 pl-10 pr-10 py-2 text-sm bg-white border border-gray-300 rounded- placeholder:text-gray-400 text-gray-800 focus:outline-none focus:border-color-gn-primary"
            />

            {/* Clear button */}
            {searchQuery && (
              <button
                onClick={clearSearch}
                aria-label="Clear search"
                className="absolute right-2 text-gray-500"
              >
                <X size={16} />
              </button>
            )}
          </div>

          {/* Search results */}
          {searchResults.length > 0 && (
            <div
              className="absolute top-full mt-1 w-full border border-gray-200 bg-white rounded-md shadow-lg max-h-80 overflow-y-auto z-[9999]"
              onClick={(e) => e.stopPropagation()}
            >
              {searchResults.map((addr, index) => (
                <div
                  key={index}
                  onClick={() => selectAddress(addr)}
                  className="p-2 hover:bg-gray-50 cursor-pointer"
                  tabIndex={0}
                  role="option"
                  aria-selected="false"
                >
                  <div className="text-sm text-gray-800 truncate">
                    {addr.adressetekst}
                  </div>
                  {addr.poststed && (
                    <div className="text-xs text-gray-500 truncate">
                      {addr.poststed}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Map controller component to handle map references and state access
function MapController({
  onMapReady,
}: {
  onMapReady: (map: LeafletMap) => void;
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
  userMarker: any;
  searchMarker: any;
  searchMarkers?: Array<{ lat: number; lng: number; label?: string }>;
}) {
  return (
    <>
      {userMarker && <Marker position={[userMarker.lat, userMarker.lng]} />}
      {searchMarker && (
        <Marker position={[searchMarker.lat, searchMarker.lng]} />
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
  setSearchMarker: (marker: { lat: number; lng: number } | null) => void;
  onMapReady: (map: LeafletMap) => void;
  onKartkatalogSearchRequest: (query: string) => void;
  showAddressSearch?: boolean;
}

const MapWrapper: React.FC<MapWrapperProps> = ({
  center,
  zoom,
  currentBaseLayer,
  trackedDatasets,
  wmsLayer,
  userMarker,
  searchMarker,
  searchMarkers = [],
  setUserMarker,
  setSearchMarker,
  onMapReady,
  onKartkatalogSearchRequest,
  showAddressSearch = true,
}) => {
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

  return (
    <MapContainer
      center={center}
      zoom={zoom}
      style={{ height: "100%", width: "100%" }}
      zoomControl={false}
      attributionControl={true}
      className="z-0"
    >
      <MapController onMapReady={onMapReady} />

      {showAddressSearch && (
        <AddressSearch
          setSearchMarker={setSearchMarker}
          onKartkatalogSearchRequest={onKartkatalogSearchRequest}
        />
      )}

      {currentBaseLayer === "topo" && (
        <TileLayer
          url="https://cache.kartverket.no/v1/wmts/1.0.0/topo/default/webmercator/{z}/{y}/{x}.png"
          attribution='&copy; <a href="http://www.kartverket.no/">Kartverket</a>'
        />
      )}
      {currentBaseLayer === "graatone" && (
        <TileLayer
          url="https://cache.kartverket.no/v1/wmts/1.0.0/topograatone/default/webmercator/{z}/{y}/{x}.png"
          attribution='&copy; <a href="http://www.kartverket.no/">Kartverket</a>'
        />
      )}
      {currentBaseLayer === "raster" && (
        <TileLayer
          url="https://cache.kartverket.no/v1/wmts/1.0.0/toporaster/default/webmercator/{z}/{y}/{x}.png"
          attribution='&copy; <a href="http://www.kartverket.no/">Kartverket</a>'
        />
      )}
      {currentBaseLayer === "sjo" && (
        <TileLayer
          url="https://cache.kartverket.no/v1/wmts/1.0.0/sjokartraster/default/webmercator/{z}/{y}/{x}.png"
          attribution='&copy; <a href="http://www.kartverket.no/">Kartverket</a>'
        />
      )}

      <DynamicWMSLayers trackedDatasets={trackedDatasets} wmsLayer={wmsLayer} />

      {/* Markers */}
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
