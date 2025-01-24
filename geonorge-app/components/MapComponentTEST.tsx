"use client";

import React from "react";
import { MapContainer, TileLayer, GeoJSON, Rectangle } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import norwayGeoJson from "@/public/geojson/custom.geo.json";

const MapComponent = () => {
    const blackOverlayBounds = [
        [90, -180],
        [-90, 180]
    ];

    return (
        <MapContainer
            style={{ height: "100vh", width: "100vw" }}
            center={[64.5, 11.0]}
            zoom={5}
            maxBounds={[
                [57.985, 4.064],
                [71.185, 31.287]
            ]}
            maxBoundsViscosity={1.0}
        >
            <Rectangle
                bounds={blackOverlayBounds}
                pathOptions={{
                    color: 'black',
                    fillColor: 'black',
                    fillOpacity: 1
                }}
            />
            <TileLayer
                style={{ display: 'none' }}
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <GeoJSON
                data={norwayGeoJson}
                style={{
                    fillColor: "white",
                    color: "white",
                    weight: 1
                }}
            />
        </MapContainer>
    );
};

export default MapComponent;