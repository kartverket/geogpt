import { useState } from 'react';

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

  const handleMapReady = (mapInstance: any) => {
    setMap(mapInstance);
  };

  return {
    map,
    wmsLayer,
    userMarker,
    searchMarker,
    setMap,
    setWmsLayer,
    setUserMarker,
    setSearchMarker,
    handleMapReady,
  };
};
