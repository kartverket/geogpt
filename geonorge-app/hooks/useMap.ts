import { useState, useEffect, useRef } from "react";
import L from "leaflet";
import { MapState } from "@/types/map";

export function useMap() {
  const [mapState, setMapState] = useState<MapState>({
    map: null,
    wmsLayer: {},
    userMarker: null,
    searchMarker: null,
    currentBaseLayer: null,
  });
  const mapRef = useRef<HTMLDivElement>(null);

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
    if (!mapRef.current || mapState.map) return;

    const mapInstance = L.map(mapRef.current, {
      zoomControl: false, // Disable default zoom controls
    }).setView([65.5, 13.5], 5);

    // GET POSITION BUTTON
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
            getUserLocation(mapInstance);
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
    const initialLayer = L.tileLayer(
      "https://cache.kartverket.no/v1/wmts/1.0.0/topo/default/webmercator/{z}/{y}/{x}.png",
      {
        maxZoom: 18,
        attribution:
          '&copy; <a href="http://www.kartverket.no/">Kartverket</a>',
      }
    );
    initialLayer.addTo(mapInstance);

    setMapState(prev => ({
      ...prev,
      map: mapInstance,
      currentBaseLayer: initialLayer
    }));

    return () => {
      mapInstance.remove();
    };
  }, []);

  const getUserLocation = (mapInstance: L.Map) => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        
        if (mapState.userMarker) {
          mapInstance.removeLayer(mapState.userMarker);
        }
        
        const newMarker = L.marker([latitude, longitude]);
        newMarker.addTo(mapInstance);
        
        setMapState(prev => ({
          ...prev,
          userMarker: newMarker
        }));
        
        mapInstance.setView([latitude, longitude], 14);
      },
      (error) => {
        console.error("Error getting location:", error);
        alert(
          "Kunne ikke hente din posisjon. Sjekk at du har gitt tillatelse til posisjonstjenester."
        );
      }
    );
  };

  const selectAddress = (address: {
    representasjonspunkt: { lat: number; lon: number };
  }) => {
    if (!mapState.map) return;

    const { lat, lon } = address.representasjonspunkt;

    if (mapState.searchMarker) {
      mapState.map.removeLayer(mapState.searchMarker);
    }

    const newMarker = L.marker([lat, lon]);
    newMarker.addTo(mapState.map);
    
    setMapState(prev => ({
      ...prev,
      searchMarker: newMarker
    }));

    mapState.map.setView([lat, lon], 14);
  };

  const setBaseLayer = (url: string, options?: L.TileLayerOptions) => {
    if (!mapState.map) return;

    // Remove current WMS layer when changing map layer
    if (mapState.currentBaseLayer) {
      mapState.map.removeLayer(mapState.currentBaseLayer);
    }

    // Sets a new map layer with low z-index
    const newLayer = L.tileLayer(url, {
      zIndex: 0, // Ensure map layer stays at bottom
      ...options,
    });

    // Add map layer first
    newLayer.addTo(mapState.map);
    setMapState(prev => ({
      ...prev,
      currentBaseLayer: newLayer
    }));

    // Re-add all WMS layers to ensure they stay on top
    Object.values(mapState.wmsLayer).forEach((layer) => {
      mapState.map!.removeLayer(layer);
      layer.setZIndex(10); // Set higher z-index for WMS layers
      layer.addTo(mapState.map!);
    });
  };

  const revertToBaseMap = () => {
    setBaseLayer(
      "https://cache.kartverket.no/v1/wmts/1.0.0/topo/default/webmercator/{z}/{y}/{x}.png"
    );
  };

  const changeToGraattKart = () => {
    setBaseLayer(
      "https://cache.kartverket.no/v1/wmts/1.0.0/topograatone/default/webmercator/{z}/{y}/{x}.png"
    );
  };

  const changeToRasterKart = () => {
    setBaseLayer(
      "https://cache.kartverket.no/v1/wmts/1.0.0/toporaster/default/webmercator/{z}/{y}/{x}.png"
    );
  };

  return {
    mapState,
    setMapState,
    mapRef,
    getUserLocation,
    selectAddress,
    baseLayerControls: {
      revertToBaseMap,
      changeToGraattKart,
      changeToRasterKart
    }
  };
}
