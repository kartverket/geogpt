"use client";

import { AnimatePresence, motion } from "motion/react";
import type React from "react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { ArrowRight, Search, Layers, Sparkle, Sparkles, X } from "lucide-react";
import { TOUR_STEP_IDS } from "@/lib/tour-constants";
import GeoNorgeLogo from "./ui/GeoNorgeLogo";
import GeoNorgeIcon from "./ui/GeoNorgeIcon";

export interface TourStep {
  content: React.ReactNode;
  selectorId: string;
  width?: number;
  height?: number;
  onClickWithinArea?: () => void;
  position?: "top" | "bottom" | "left" | "right";
}

interface TourContextType {
  currentStep: number;
  totalSteps: number;
  nextStep: () => void;
  previousStep: () => void;
  endTour: () => void;
  isActive: boolean;
  startTour: () => void;
  setSteps: (steps: TourStep[]) => void;
  steps: TourStep[];
  isTourCompleted: boolean;
  setIsTourCompleted: (completed: boolean) => void;
}

interface TourProviderProps {
  children: React.ReactNode;
  onComplete?: () => void;
  className?: string;
  isTourCompleted?: boolean;
}

const TourContext = createContext<TourContextType | null>(null);

const PADDING = 16;
const CONTENT_WIDTH = 400;
const CONTENT_HEIGHT = 200;

function getElementPosition(id: string) {
  const element = document.getElementById(id);
  if (!element) return null;
  const rect = element.getBoundingClientRect();
  return {
    top: rect.top + window.scrollY,
    left: rect.left + window.scrollX,
    width: rect.width,
    height: rect.height,
  };
}

function calculateContentPosition(
  elementPos: { top: number; left: number; width: number; height: number },
  position: "top" | "bottom" | "left" | "right" = "bottom"
) {
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;

  let left = elementPos.left;
  let top = elementPos.top;

  switch (position) {
    case "top":
      top = elementPos.top - CONTENT_HEIGHT - PADDING;
      left = elementPos.left + elementPos.width / 2 - CONTENT_WIDTH / 2;
      break;
    case "bottom":
      top = elementPos.top + elementPos.height + PADDING;
      left = elementPos.left + elementPos.width / 2 - CONTENT_WIDTH / 2;
      break;
    case "left":
      left = elementPos.left - CONTENT_WIDTH - PADDING;
      top = elementPos.top + elementPos.height / 2 - CONTENT_HEIGHT / 2;
      break;
    case "right":
      left = elementPos.left + elementPos.width + PADDING;
      top = elementPos.top + elementPos.height / 2 - CONTENT_HEIGHT / 2;
      break;
  }

  return {
    top: Math.max(
      PADDING,
      Math.min(top, viewportHeight - CONTENT_HEIGHT - PADDING)
    ),
    left: Math.max(
      PADDING,
      Math.min(left, viewportWidth - CONTENT_WIDTH - PADDING)
    ),
    width: CONTENT_WIDTH,
    height: CONTENT_HEIGHT,
  };
}

export function TourProvider({
  children,
  onComplete,
  className,
  isTourCompleted = false,
}: TourProviderProps) {
  const [steps, setSteps] = useState<TourStep[]>([]);
  const [currentStep, setCurrentStep] = useState(-1);
  const [elementPosition, setElementPosition] = useState<{
    top: number;
    left: number;
    width: number;
    height: number;
  } | null>(null);
  const [isCompletedInternal, setIsCompletedInternal] =
    useState(isTourCompleted);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (!isMounted) return;

    let completedFromStorage = false;
    try {
      completedFromStorage =
        localStorage.getItem("geonorgeTourCompleted") === "true";
    } catch (error) {
      console.error("Failed to read from localStorage:", error);
    }

    if (completedFromStorage) {
      setIsCompletedInternal(true);
    }
  }, [isMounted]);

  const updateElementPosition = useCallback(() => {
    if (currentStep >= 0 && currentStep < steps.length) {
      const position = getElementPosition(steps[currentStep]?.selectorId ?? "");
      if (position) {
        setElementPosition(position);
      }
    }
  }, [currentStep, steps]);

  useEffect(() => {
    updateElementPosition();
    window.addEventListener("resize", updateElementPosition);
    window.addEventListener("scroll", updateElementPosition);

    return () => {
      window.removeEventListener("resize", updateElementPosition);
      window.removeEventListener("scroll", updateElementPosition);
    };
  }, [updateElementPosition]);

  const nextStep = useCallback(async () => {
    const prevStepIndex = currentStep;
    setCurrentStep((prev) => {
      if (prev >= steps.length - 1) {
        return -1;
      }
      return prev + 1;
    });

    if (
      prevStepIndex === 3 &&
      steps[prevStepIndex]?.selectorId === TOUR_STEP_IDS.KARTKATALOG_PANEL
    ) {
      if (window.collapseKartkatalog) {
        console.log("Tour: Collapsing Kartkatalog panel after step 3");
        window.collapseKartkatalog();
      }
    }

    if (currentStep === steps.length - 1) {
      setIsTourCompleted(true);
      onComplete?.();
    }
  }, [steps, currentStep, onComplete]);

  const previousStep = useCallback(() => {
    setCurrentStep((prev) => (prev > 0 ? prev - 1 : prev));
  }, []);

  const endTour = useCallback(() => {
    setCurrentStep(-1);
  }, []);

  const startTour = useCallback(() => {
    if (!isMounted || isCompletedInternal) {
      return;
    }
    setCurrentStep(0);
  }, [isMounted, isCompletedInternal]);

  const handleClick = useCallback(
    (e: MouseEvent) => {
      if (
        currentStep >= 0 &&
        elementPosition &&
        steps[currentStep]?.onClickWithinArea
      ) {
        const clickX = e.clientX + window.scrollX;
        const clickY = e.clientY + window.scrollY;

        const isWithinBounds =
          clickX >= elementPosition.left &&
          clickX <=
            elementPosition.left +
              (steps[currentStep]?.width || elementPosition.width) &&
          clickY >= elementPosition.top &&
          clickY <=
            elementPosition.top +
              (steps[currentStep]?.height || elementPosition.height);

        if (isWithinBounds) {
          steps[currentStep].onClickWithinArea?.();
        }
      }
    },
    [currentStep, elementPosition, steps]
  );

  useEffect(() => {
    window.addEventListener("click", handleClick);
    return () => {
      window.removeEventListener("click", handleClick);
    };
  }, [handleClick]);

  const setIsTourCompleted = useCallback((completed: boolean) => {
    setIsCompletedInternal(completed);
    if (completed) {
      try {
        if (typeof window !== "undefined") {
          localStorage.setItem("geonorgeTourCompleted", "true");
        }
      } catch (error) {
        console.error("Failed to write to localStorage:", error);
      }
    }
  }, []);

  const isActive = isMounted && currentStep >= 0;
  const currentTourStep = steps[currentStep];
  const contentPosition = elementPosition
    ? calculateContentPosition(elementPosition, currentTourStep?.position)
    : null;

  return (
    <TourContext.Provider
      value={{
        currentStep,
        totalSteps: steps.length,
        nextStep,
        previousStep,
        endTour,
        isActive,
        startTour,
        setSteps,
        steps,
        isTourCompleted: isCompletedInternal,
        setIsTourCompleted,
      }}
    >
      {children}
      <AnimatePresence>
        {currentStep >= 0 && elementPosition && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-[100] overflow-hidden bg-black/50"
              style={{
                clipPath: `polygon(
                  0% 0%,                                                                          /* top-left */
                  0% 100%,                                                                        /* bottom-left */
                  100% 100%,                                                                      /* bottom-right */
                  100% 0%,                                                                        /* top-right */
                  
                  /* Create rectangular hole */
                  ${
                    elementPosition.left
                  }px 0%,                                                   /* top edge start */
                  ${elementPosition.left}px ${
                  elementPosition.top
                }px,                             /* hole top-left */
                  ${
                    elementPosition.left +
                    (steps[currentStep]?.width || elementPosition.width)
                  }px ${elementPosition.top}px,  /* hole top-right */
                  ${
                    elementPosition.left +
                    (steps[currentStep]?.width || elementPosition.width)
                  }px ${
                  elementPosition.top +
                  (steps[currentStep]?.height || elementPosition.height)
                }px,  /* hole bottom-right */
                  ${elementPosition.left}px ${
                  elementPosition.top +
                  (steps[currentStep]?.height || elementPosition.height)
                }px,  /* hole bottom-left */
                  ${
                    elementPosition.left
                  }px 0%                                                    /* back to top edge */
                )`,
              }}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              style={{
                position: "absolute",
                top: elementPosition.top,
                left: elementPosition.left,
                width: steps[currentStep]?.width || elementPosition.width,
                height: steps[currentStep]?.height || elementPosition.height,
              }}
              className={cn(
                "z-[100] border-2 border-muted-foreground",
                className
              )}
            />

            <motion.div
              initial={{ opacity: 0, y: 10, top: 50, right: 50 }}
              animate={{
                opacity: 1,
                y: 0,
                top: calculateContentPosition(
                  elementPosition,
                  steps[currentStep]?.position
                ).top,
                left: calculateContentPosition(
                  elementPosition,
                  steps[currentStep]?.position
                ).left,
              }}
              transition={{
                duration: 0.8,
                ease: [0.16, 1, 0.3, 1],
                opacity: { duration: 0.4 },
              }}
              exit={{ opacity: 0, y: 10 }}
              style={{
                position: "absolute",
                width: calculateContentPosition(
                  elementPosition,
                  steps[currentStep]?.position
                ).width,
              }}
              className="bg-background relative z-[100] rounded-lg border p-4 shadow-lg"
            >
              <AnimatePresence mode="wait">
                <div>
                  {/* Progress indicator */}
                  <div className="mb-3 flex justify-center">
                    {Array.from({ length: steps.length }).map((_, index) => (
                      <div
                        key={index}
                        className={`mx-0.5 h-1 w-6 rounded-full transition-colors ${
                          index === currentStep
                            ? "bg-color-gn-primary"
                            : "bg-gray-200"
                        }`}
                      />
                    ))}
                  </div>
                  <motion.div
                    key={`tour-content-${currentStep}`}
                    initial={{ opacity: 0, scale: 0.95, filter: "blur(4px)" }}
                    animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
                    exit={{ opacity: 0, scale: 0.95, filter: "blur(4px)" }}
                    className="overflow-hidden"
                    transition={{
                      duration: 0.2,
                      height: {
                        duration: 0.4,
                      },
                    }}
                  >
                    {steps[currentStep]?.content}
                  </motion.div>
                  <div className="mt-4 flex justify-between px-2">
                    {currentStep > 0 && (
                      <button
                        onClick={previousStep}
                        disabled={currentStep === 0}
                        className="text-sm text-muted-foreground hover:text-foreground hover:bg-gray-100 px-4 py-1.5 rounded-omar border"
                      >
                        Forrige
                      </button>
                    )}
                    {currentStep === 0 && (
                      <button
                        onClick={previousStep}
                        disabled={currentStep === 0}
                        className="text-sm text-white"
                      >
                        Forrige
                      </button>
                    )}
                    <div className="text-muted-foreground text-sm font-medium self-center">
                      {currentStep + 1} / {steps.length}
                    </div>
                    <button
                      onClick={nextStep}
                      className="flex justify-center items-center gap-1 text-sm font-medium text-primary hover:bg-color-gn-primary/90 hover:text-white px-4 py-1.5 rounded-omar border border-color-gn-primary"
                    >
                      {currentStep === steps.length - 1 ? "Fullfør" : "Neste"}
                      {currentStep !== steps.length - 1 && (
                        <ArrowRight className="size-4" />
                      )}
                    </button>
                  </div>
                </div>
              </AnimatePresence>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </TourContext.Provider>
  );
}

export function useTour() {
  const context = useContext(TourContext);
  if (!context) {
    throw new Error("useTour must be used within a TourProvider");
  }
  return context;
}

export function TourAlertDialog({
  isOpen,
  setIsOpen,
}: {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
}) {
  const { startTour, steps, isTourCompleted, currentStep, setIsTourCompleted } =
    useTour();

  if (isTourCompleted || steps.length === 0 || currentStep > -1) {
    return null;
  }
  const handleSkip = async () => {
    setIsOpen(false);
    setIsTourCompleted(true);
  };

  return (
    <AlertDialog open={isOpen}>
      <AlertDialogContent className="max-w-md w-full p-0 rounded-2xl shadow-2xl overflow-hidden">
        <AlertDialogTitle asChild>
          <span className="not-sr-only w-full">
            <div className="bg-white p-4 relative flex items-center gap-3">
              <div className="w-12 h-auto rounded-full bg-white border flex items-center justify-center">
                <GeoNorgeIcon className="h-12 w-full p-2" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-black">GEONORGE</h2>
                <p className="text-sm text-black/90">
                  Norges offisielle portal for kartinformasjon
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-2 top-2 text-white hover:bg-orange-600/20"
              >
                <X className="h-4 w-4" />
                <span className="sr-only">Close</span>
              </Button>
            </div>
            <div className="border-b border-color-gn-primary mx-auto w-[90%]"></div>
          </span>
        </AlertDialogTitle>

        <div className="flex flex-col ">
          <div className="w-full px-6 text-black">
            <h3 className="text-md font-medium mb-2">
              Utforsk mulighetene med Geonorge & GeoGPT
            </h3>
            <p className="text-sm text-muted-foreground mb-5">
              Opplev avanserte funksjoner for geografisk analyse og
              datavisualisering
            </p>
          </div>
          <div className="px-6 pb-6 w-full">
            <div className="bg-gray-50 rounded-xl p-4 mb-6 border border-orange-100">
              <h3 className="font-medium text-gray-800 mb-2">
                Hva kan du gjøre?
              </h3>
              <ul className="space-y-3">
                <li className="flex items-start">
                  <div className="bg-white p-1 rounded-full mr-2 mt-0.5">
                    <Search className="h-4 w-4 text-orange-600" />
                  </div>
                  <span className="text-gray-700">
                    Effektivt søke og finne datasett
                  </span>
                </li>
                <li className="flex items-start">
                  <div className="bg-white p-1 rounded-full mr-2 mt-0.5">
                    <Layers className="h-4 w-4 text-orange-600" />
                  </div>
                  <span className="text-gray-700">
                    Utforske ulike kartlag og datasett
                  </span>
                </li>
                <li className="flex items-start">
                  <div className="bg-white p-1 rounded-full mr-2 mt-0.5">
                    <Sparkle className="h-4 w-4 text-orange-600" />
                  </div>
                  <span className="text-gray-700">
                    Utforsk AI-verktøy og funksjoner
                  </span>
                </li>
              </ul>
            </div>

            <p className="text-gray-600 mb-6 text-sm">
              Ta en rask omvisning for å lære om de viktigste funksjonene i
              Geonorge & GeoGPT.
            </p>

            <div className="flex gap-4">
              <Button
                variant="outline"
                onClick={handleSkip}
                className="border-gray-300 text-gray-700 hover:bg-gray-100 w-1/3 rounded-omar"
              >
                Hopp over
              </Button>
              <Button
                onClick={() => {
                  setIsOpen(false);
                  startTour();
                }}
                className="bg-color-gn-primary hover:bg-color-gn-primary/80 text-white py-2 rounded-omar w-2/3"
              >
                Start omvisning
              </Button>
            </div>
          </div>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
}
