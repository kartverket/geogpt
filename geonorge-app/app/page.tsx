"use client";
import ChatUI from "./components/ChatUI";
import dynamic from "next/dynamic";

// Dynamic import of the MapClient component
const MapClient = dynamic(() => import("./components/MapClient"), {
  ssr: false,
});

export default function Home() {
  return (
    <div className="relative h-screen w-full">
      <MapClient />
      <ChatUI webSocketUrl="ws://localhost:8080" />
    </div>
  );
}
