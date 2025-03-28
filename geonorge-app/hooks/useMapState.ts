import { useState } from "react";

export const useMapState = () => {
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
  const [searchMarkers, setSearchMarkers] = useState<
    Array<{
      lat: number;
      lng: number;
      label?: string;
    }>
  >([]);

  const handleMapReady = (mapInstance: any) => {
    setMap(mapInstance);
  };

  // Function to add a marker to the collection
  const addSearchMarker = (marker: {
    lat: number;
    lng: number;
    label?: string;
  }) => {
    setSearchMarkers((prev) => [...prev, marker]);
  };

  // Function to clear all search markers
  const clearSearchMarkers = () => {
    setSearchMarkers([]);
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
    setSearchMarker,
    setSearchMarkers,
    addSearchMarker,
    clearSearchMarkers,
    handleMapReady,
  };
};
