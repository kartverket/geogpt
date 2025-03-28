"use client";

import { useEffect, useState } from "react";
import { TourAlertDialog, useTour } from "@/components/tour";
import { TOUR_STEP_IDS } from "@/lib/tour-constants";
import type { TourStep } from "@/components/tour";
import { Bot, Layers, MapPin, ThumbsUp } from "lucide-react";

declare global {
  interface Window {
    startGeoNorgeTour?: () => void;
    collapseKartkatalog?: () => void;
  }
}

export function GeoNorgeTour() {
  const { setSteps, startTour, currentStep } = useTour();
  const [openTour, setOpenTour] = useState(false);

  // Function to collapse the Kartkatalog tab
  const collapseKartkatalog = () => {
    try {
      const button = document.querySelector(
        `button[id="${TOUR_STEP_IDS.KARTKATALOG_TAB}"]`
      ) as HTMLButtonElement | null;
      const parentElement = document.getElementById(
        TOUR_STEP_IDS.KARTKATALOG_TAB
      );
      const buttonInParent = parentElement?.querySelector("button");
      const targetButton = button || buttonInParent;

      if (targetButton) {
        console.log("Found Kartkatalog tab button, collapsing...");
        // SJEKK OM OMAR ER PÅ KNAPPEN
        const isExpanded = targetButton.className.includes("rounded-r-omar");

        if (isExpanded) {
          console.log("Kartkatalog is expanded, clicking to collapse");
          targetButton.click();

          if (targetButton.className.includes("rounded-r-omar")) {
            const clickEvent = new MouseEvent("click", {
              view: window,
              bubbles: true,
              cancelable: true,
            });
            targetButton.dispatchEvent(clickEvent);
          }
        } else {
          console.log("Kartkatalog is already collapsed");
        }
      } else {
        console.warn("Kartkatalog tab button not found");
      }
    } catch (error) {
      console.error("Error collapsing Kartkatalog tab:", error);
    }
  };

  const steps: TourStep[] = [
    {
      content: (
        <div className="p-2">
          <div className="flex items-center gap-1">
            <h3 className="text-lg font-semibold">Tilbakemelding</h3>
            <ThumbsUp className="size-5 font-medium text-color-gn-primary" />
          </div>
          <p>
            Hvis du har noen kommentarer eller tilbakemeldinger, kan du kontakte
            oss her.
          </p>
        </div>
      ),
      selectorId: TOUR_STEP_IDS.FEEDBACK_BUTTON,
      position: "right",
    },
    {
      content: (
        <div className="p-2">
          <div className="flex items-center gap-1">
            <h3 className="text-lg font-semibold">GeoGPT</h3>
            <Bot className="size-5 font-medium text-color-gn-primary" />
          </div>
          <p>
            Få hjelp til å finne datasett og kartlag. Spør alt om Geonorge og
            GeoGPT.
          </p>
        </div>
      ),
      selectorId: TOUR_STEP_IDS.CHAT_INTERFACE,
      position: "left",
    },
    {
      content: (
        <div className="p-2">
          <div className="flex items-center gap-1">
            <h3 className="text-lg font-semibold">Kartlag</h3>
            <Layers className="size-5 font-medium text-color-gn-primary" />
          </div>
          <p>
            Her kan du legge på kartlag fra datasettene. Klikk på "VIS" i
            kartkatalogen for å se kartlaget.
          </p>
        </div>
      ),
      selectorId: TOUR_STEP_IDS.APP_SIDEBAR,
      position: "right",
    },
    {
      content: (
        <div className="p-2">
          <div className="flex items-center gap-1">
            <h3 className="text-lg font-semibold">Kartkatalog</h3>
            <MapPin className="size-5 font-medium text-color-gn-primary" />
          </div>
          <p>
            Her kan du søke og utforske tilgjengelige datasett. Klikk på "VIS" i
            kartkatalogen for å se kartlaget.
          </p>
        </div>
      ),
      selectorId: TOUR_STEP_IDS.KARTKATALOG_PANEL,
      position: "left",
    },
  ];

  // Monitor currentStep to scroll elements into view
  useEffect(() => {
    // If we're at the Kartkatalog panel step (index 3)
    if (currentStep === 3) {
      // Ensure the panel is visible in the viewport
      const panel = document.getElementById(TOUR_STEP_IDS.KARTKATALOG_PANEL);
      if (panel) {
        panel.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }
    }
  }, [currentStep]);

  useEffect(() => {
    // Set the tour steps
    setSteps(steps);

    // Show the tour after a short delay
    const timer = setTimeout(() => {
      // Only show the tour if it hasn't been completed before
      const tourCompleted = localStorage.getItem("geonorge-tour-completed");
      if (!tourCompleted) {
        setOpenTour(true);
      }
    }, 1000);

    return () => clearTimeout(timer);
  }, [setSteps]);

  // Handle tour completion
  const handleTourComplete = () => {
    localStorage.setItem("geonorge-tour-completed", "true");
  };

  // Export functions to window object for manual triggering
  useEffect(() => {
    // Add the function to the window object
    window.startGeoNorgeTour = () => {
      startTour();
    };

    window.collapseKartkatalog = collapseKartkatalog;

    // Clean up when component unmounts
    return () => {
      delete window.startGeoNorgeTour;
      delete window.collapseKartkatalog;
    };
  }, [startTour]);

  return <TourAlertDialog isOpen={openTour} setIsOpen={setOpenTour} />;
}
