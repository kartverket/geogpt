import React, { useState } from "react";
import {
  Modal,
  Box,
  Typography,
  Button,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from "@mui/material";
import { Close, Download } from "@mui/icons-material";
import Image from "next/image";

interface CustomModalProps {
  open: boolean;
  handleClose: () => void;
  handleDownload: () => void;
  title: string;
  datasetName: string;
  datasetLink: string;
  fileSize?: string;
  formatInfo: string;
}

const CustomModal: React.FC<CustomModalProps> = ({
  open,
  handleClose,
  handleDownload,
  title,
  datasetName,
  datasetLink,
  fileSize,
  formatInfo,
}) => {
  const [confirmationOpen, setConfirmationOpen] = useState(false);

  const handleDownloadClick = () => {
    setConfirmationOpen(true); 
  };

  const handleConfirmationClose = () => {
    setConfirmationOpen(false); 
  };

  const handleConfirmDownload = () => {
    setConfirmationOpen(false); 
    handleDownload(); 
  };

  return (
    <>
      {/* Main Modal */}
      <Modal
        open={open}
        onClose={handleClose}
        aria-labelledby="modal-title"
        aria-describedby="modal-description"
      >
        <Box
          sx={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            width: { xs: "90%", sm: 500, md: 600 },
            bgcolor: "background.paper",
            borderRadius: 2,
            boxShadow: 24,
            p: 3,
            border: "1px solid #E0E0E0",
          }}
        >
          {/* Header with logo and title */}
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 2,
            }}
          >
            <Box sx={{ display: "flex", alignItems: "center" }}>
              <Image
                src="/geonorge-logo.png"
                alt="Logo"
                width={64}
                height={64}
              />
              <Typography
                variant="h6"
                component="h2"
                sx={{ marginLeft: 2, fontWeight: 500, color: "#333" }}
              >
                {title}
              </Typography>
            </Box>
            <IconButton onClick={handleClose} sx={{ color: "#333" }}>
              <Close />
            </IconButton>
          </Box>

          {/* Content */}
          <Box sx={{ maxHeight: "60vh", overflowY: "auto", paddingRight: 1 }}>
            <Typography sx={{ mt: 2, fontSize: "14px", color: "#555" }}>
              <strong>Datasettets navn:</strong> {datasetName}
            </Typography>
            <Typography sx={{ mt: 2, fontSize: "14px", color: "#555" }}>
              <strong>Link til datasettet:</strong>{" "}
              <a
                href={datasetLink}
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: "#1976d2", textDecoration: "none" }}
              >
                {datasetLink}
              </a>
            </Typography>
            {fileSize && (
              <Typography sx={{ mt: 2, fontSize: "14px", color: "#555" }}>
                <strong>Filstørrelse:</strong> {fileSize}
              </Typography>
            )}
            <Typography sx={{ mt: 2, fontSize: "14px", color: "#555" }}>
              <strong>Formatinformasjon:</strong> {formatInfo}
            </Typography>
          </Box>

          {/* Footer with buttons */}
          <Box
            sx={{
              mt: 3,
              display: "flex",
              justifyContent: "flex-end",
              gap: 2,
            }}
          >
            <Button
              onClick={handleClose}
              variant="outlined"
              sx={{
                color: "#333",
                borderColor: "#E0E0E0",
                "&:hover": { borderColor: "#4F4F4F" },
              }}
            >
              Avbryt
            </Button>
            <Button
              onClick={handleDownloadClick}
              variant="contained"
              startIcon={<Download />}
              sx={{
                backgroundColor: "#333",
                "&:hover": { backgroundColor: "#444" },
              }}
            >
              Last ned
            </Button>
          </Box>
        </Box>
      </Modal>

      {/* Confirmation Dialog */}
      <Dialog
        open={confirmationOpen}
        onClose={handleConfirmationClose}
        aria-labelledby="confirmation-dialog-title"
        aria-describedby="confirmation-dialog-description"
      >
        <DialogTitle id="confirmation-dialog-title">
          Bekreft nedlasting
        </DialogTitle>
        <DialogContent>
          <Typography sx={{ fontSize: "14px", color: "#555" }}>
            <strong>Datasettets navn:</strong> {datasetName}
          </Typography>
          <Typography sx={{ mt: 2, fontSize: "14px", color: "#555" }}>
            <strong>Link til datasettet:</strong>{" "}
            <a
              href={datasetLink}
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: "#1976d2", textDecoration: "none" }}
            >
              {datasetLink}
            </a>
          </Typography>
          {fileSize && (
            <Typography sx={{ mt: 2, fontSize: "14px", color: "#555" }}>
              <strong>Filstørrelse:</strong> {fileSize}
            </Typography>
          )}
          <Typography sx={{ mt: 2, fontSize: "14px", color: "#555" }}>
            <strong>Formatinformasjon:</strong> {formatInfo}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleConfirmationClose} sx={{ color: "#333" }}>
            Avbryt
          </Button>
          <Button
            onClick={handleConfirmDownload}
            variant="contained"
            sx={{
              backgroundColor: "#333",
              "&:hover": { backgroundColor: "#444" },
            }}
          >
            Last ned
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default CustomModal;
