import { useState } from "react";
import { Map, TileLayer } from "leaflet";

export const useMapState = () => {
  const [map, setMap] = useState<Map | null>(null);
  const [wmsLayer, setWmsLayer] = useState<Record<string, TileLayer>>({});
  const [userMarker, setUserMarker] = useState<{
    lat: number;
    lng: number;
  } | null>(null);
  const [searchMarker, setSearchMarker] = useState<{
    lat: number;
    lng: number;
  } | null>(null);
  const [searchMarkers, setSearchMarkers] = useState<
    Array<{
      lat: number;
      lng: number;
      label?: string;
    }>
  >([]);

  const handleMapReady = (mapInstance: Map) => {
    setMap(mapInstance);
  };

  // Function to add a marker to the collection
  const addSearchMarker = (marker: {
    lat: number;
    lng: number;
    label?: string;
  }) => {
    setSearchMarkers((prev) => [...prev, marker]);
    // Also update the map center to focus on the marker
    if (marker && map) {
      map.setView([marker.lat, marker.lng], 14); // 14 zoom level
    }
  };

  // Function to clear all search markers
  const clearSearchMarkers = () => {
    setSearchMarkers([]);
  };

  // setSearchMarker that also centers the map
  const setSearchMarkerWithCenter = (
    marker: {
      lat: number;
      lng: number;
    } | null
  ) => {
    setSearchMarker(marker);
    // Center the map on the marker if it exists
    if (marker && map) {
      map.setView([marker.lat, marker.lng], 14); // 14 zoom level
    }
  };

  return {
    map,
    wmsLayer,
    userMarker,
    searchMarker,
    searchMarkers,
    setMap,
    setWmsLayer,
    setUserMarker,
    setSearchMarker: setSearchMarkerWithCenter,
    setSearchMarkers,
    addSearchMarker,
    clearSearchMarkers,
    handleMapReady,
  };
};
