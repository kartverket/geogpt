import L from "leaflet";

export interface WMSLayer {
  name: string;
  title: string;
}

export interface Address {
  adressetekst: string;
  poststed?: string;
  representasjonspunkt: {
    lat: number;
    lon: number;
  };
}

export interface BaseLayerOptions {
  revertToBaseMap: () => void;
  changeToGraattKart: () => void;
  changeToRasterKart: () => void;
}

export interface MapState {
  map: L.Map | null;
  wmsLayer: Record<string, L.TileLayer.WMS>;
  userMarker: L.Marker | null;
  searchMarker: L.Marker | null;
  currentBaseLayer: L.TileLayer | null;
}

export interface WMSData {
  wms_url: string;
  available_layers: WMSLayer[];
  available_formats: string[];
  title?: string;
}
