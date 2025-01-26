"use client";
import { Button } from "@mui/material";
import { useState } from "react";
import ChatUI from "./components/ChatUI";
import CustomModal from "./components/CustomModal";
import Demo from "./components/Demo";

export default function Home() {
  // TEST FOR Å ÅPNE MODAL
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
      <Demo />
      <ChatUI webSocketUrl="ws://localhost:8080" />
      <Button
        variant="contained"
        onClick={handleOpenModal}
        sx={{
          position: "absolute",
          top: 10,
          right: "5%",
          zIndex: 100,
        }}
      >
        Last ned datasett
      </Button>
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
