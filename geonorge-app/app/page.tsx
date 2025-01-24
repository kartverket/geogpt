"use client";
import { useState } from "react";
import { Button } from "@mui/material";
import ChatUI from "./components/ChatUI";
import dynamic from "next/dynamic";
import CustomModal from "./components/CustomModal";

// Dynamic import of the MapClient component
const MapClient = dynamic(() => import("./components/MapPage"), {
  ssr: false,
});

export default function Home() {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleOpenModal = () => {
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
  };

  const handleDownload = () => {
    // Logic to start the download
    window.location.href = "https://example.com/dataset.zip"; // Replace with actual dataset link
    handleCloseModal();
  };

  return (
    <div className="relative h-screen w-full">
      <Button
        className="absolute top-2 right-2"
        variant="contained"
        onClick={handleOpenModal}
        sx={{ zIndex: 100 }}
      >
        Last ned datasett
      </Button>
      <MapClient />
      <ChatUI webSocketUrl="ws://localhost:8080" />
      <CustomModal
        open={isModalOpen}
        handleClose={handleCloseModal}
        handleDownload={handleDownload}
        title="Bekreft nedlasting"
        datasetName="Eksempel Datasett"
        datasetLink="https://example.com/dataset.zip"
        fileSize="10 MB"
        formatInfo="ZIP"
      />
    </div>
  );
}