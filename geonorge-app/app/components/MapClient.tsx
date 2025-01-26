import { useState, useEffect } from "react";

// Components from Leaflet
import { MapContainer, TileLayer } from "react-leaflet";
import { LatLngBoundsExpression, LatLngExpression } from "leaflet";
import "leaflet/dist/leaflet.css";

const defaultCenter: LatLngExpression = [63.774, 12.9382];
const defaultZoom = 5;
const norwayBounds: LatLngBoundsExpression = [
  [57.958, 4.087],
  [71.185, 31.293],
];

const MapClient = () => {
  const [center, setCenter] = useState<LatLngExpression>(defaultCenter);

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

  return (
    <MapContainer
      center={center}
      zoom={defaultZoom}
      minZoom={defaultZoom}
      style={{ width: "100%", height: "100vh" }}
      maxBounds={norwayBounds}
      maxBoundsViscosity={1}
    >
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      />
    </MapContainer>
  );
};

export default MapClient;
