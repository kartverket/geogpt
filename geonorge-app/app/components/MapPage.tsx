import { useState, useEffect } from "react";
import { MapContainer, TileLayer } from "react-leaflet";
import { LatLngExpression } from "leaflet";
import "leaflet/dist/leaflet.css";

const defaultCenter: LatLngExpression = [60.14, 10.25];
const defaultZoom = 5;

const MapPage = () => {
  const [center, setCenter] = useState<LatLngExpression>(defaultCenter);
  const [mapType, setMapType] = useState("topo"); // Standard karttype

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          setCenter([latitude, longitude]);
        },
        (error) => {
          console.error("Error getting location:", error);
        }
      );
    }
  }, []);

  // Funksjon for å hente riktig kartlayer-URL basert på karttype
  const getTileLayerUrl = () => {
    switch (mapType) {
      case "topo":
        return "https://cache.kartverket.no/v1/wmts/1.0.0/topo/default/webmercator/{z}/{y}/{x}.png";
      case "gray":
        return "https://cache.kartverket.no/v1/wmts/1.0.0/topograatone/default/webmercator/{z}/{y}/{x}.png";
      case "sjokart":
        return "https://cache.kartverket.no/v1/wmts/1.0.0/sjokartraster/default/webmercator/{z}/{y}/{x}.png";
      default:
        return "https://cache.kartverket.no/v1/wmts/1.0.0/topo/default/webmercator/{z}/{y}/{x}.png"; 
    }
  };

  return (
    <>
      <div className="flex justify-center gap-2 p-2 ">
        <button onClick={() => setMapType("topo")}>Topografisk</button>
        <button onClick={() => setMapType("gray")}>Grått</button>
        <button onClick={() => setMapType("sjokart")}>Sjøkart</button>
      </div>
      <MapContainer
        center={center}
        zoom={defaultZoom}
        minZoom={defaultZoom}
        style={{ width: "100%", height: "calc(100vh - 50px)" }} 
      >
        <TileLayer
          url={getTileLayerUrl()}
          attribution='&copy; <a href="http://www.kartverket.no/">Kartverket</a>'
        />
      </MapContainer>
    </>
  );
};

export default MapPage;
