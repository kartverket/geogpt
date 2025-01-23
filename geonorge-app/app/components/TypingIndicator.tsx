import React from "react";

// Components from Material-UI
import { Box } from "@mui/material";

const TypingIndicator: React.FC = () => (
  <Box sx={{ display: "flex", alignItems: "center" }}>
    {[0, 0.2, 0.4].map((delay, index) => (
      <Box
        key={index}
        sx={{
          width: 7,
          height: 7,
          margin: "7px 7px 7px 4px",
          backgroundColor: "#a6a6a6",
          borderRadius: "50%",
          animation: `blink 1.5s infinite ${delay}s`,
          "@keyframes blink": {
            "0%, 100%": { opacity: 0.2 },
            "50%": { opacity: 1 },
          },
        }}
      />
    ))}
  </Box>
);

export default TypingIndicator;
