import React, { useEffect, useState } from "react";

// Utils
import { groupedGoals, userGroups } from "./utils/selectionData";
import {
  capitalizeFirstLetter,
  sortGeographicalAreas,
} from "./utils/dataUtils";

// Components
import StepNavigationButtons from "./StepNavigationButtons";

// UI components
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandInput,
  CommandItem,
  CommandList,
  CommandGroup,
  CommandEmpty,
} from "@/components/ui/command";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from "@/components/ui/tooltip";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";

// Icons or images
import GeoNorgeLogo from "../GeoNorgeLogo";
import { ArrowDownAZ, Info, X } from "lucide-react";

interface FileDownloadModalProps {
  isOpen: boolean;
  handleClose: () => void;
  handleConfirmSelection: () => void;
  handleStandardDownload: () => void;
  geographicalAreas: { type: string; name: string; code: string }[];
  projections: { name: string; code: string }[];
  formats: string[];
  datasetName: string;
  onAreaChange: (selectedAreaCode: string) => void;
  metadataUuid: string;
}

// Render a tooltip with a help icon
const renderTooltip = (helpLink: string, label: string) => (
  <TooltipProvider delayDuration={100}>
    <Tooltip>
      <TooltipTrigger asChild>
        <a
          href={helpLink}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Lær mer om ${label.toLowerCase()}`}
          className="inline-flex"
        >
          <Info className="h-4 w-4 text-color-kv-secondary hover:text-color-gn-primary transition-colors duration-100 ml-1" />
        </a>
      </TooltipTrigger>
      <TooltipContent side="right">
        <p>Klikk for mer informasjon</p>
      </TooltipContent>
    </Tooltip>
  </TooltipProvider>
);

// Summary Component
const SummaryItem = ({ label, value }: { label: string; value: string }) => (
  <div className="flex justify-between items-center text-sm text-color-gn-secondary mb-3">
    <span className="font-semibold text-color-gn-secondary">{label}:</span>
    <Badge
      variant="default"
      className={`${
        value ? "bg-color-gn-lightblue text-white" : "bg-gray-200 text-gray-500"
      } ml-2 px-3 py-1 text-xs rounded-lg`}
    >
      {value || "Ikke valgt"}
    </Badge>
  </div>
);

// SelectionPopover component for selecting values from a list
const SelectionPopover = ({
  label,
  helpLink,
  selectedValue,
  setSelectedValue,
  open,
  setOpen,
  items,
  placeholder,
  grouped = false,
  isDisabled = false,
  hasError = false,
}: {
  label: string;
  helpLink?: string;
  selectedValue: string;
  setSelectedValue: (value: string) => void;
  open: boolean;
  setOpen: (value: boolean) => void;
  items: { name: string; category?: string }[];
  placeholder: string;
  grouped?: boolean;
  isDisabled?: boolean;
  hasError?: boolean;
}) => {
  // Autofill the selected value if there is only one item in the list
  useEffect(() => {
    if (items.length === 1 && !selectedValue && !isDisabled) {
      setSelectedValue(items[0].name);
      setOpen(false);
    }
  }, [
    items,
    items.length,
    selectedValue,
    setSelectedValue,
    setOpen,
    isDisabled,
  ]);

  return (
    <div>
      <div className="flex items-center mb-2 gap-1 text-sm text-color-gn-secondary">
        <p className="font-semibold">{label}</p>
        {helpLink && renderTooltip(helpLink, label)}
      </div>
      <Popover
        open={isDisabled ? false : open}
        onOpenChange={(newOpen) => {
          if (!isDisabled) {
            setOpen(newOpen);
          }
        }}
      >
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={`w-full justify-start text-left 
              ${isDisabled ? "opacity-60 cursor-not-allowed" : ""} 
              ${hasError ? "" : ""}`}
            disabled={isDisabled}
          >
            {selectedValue || placeholder}

            {isDisabled ? (
              <span className="ml-auto text-color-kv-secondary text-xs italic">
                {label.includes("Format")
                  ? "Velg projeksjon først"
                  : "Velg område først"}
              </span>
            ) : (
              <ArrowDownAZ className="ml-auto" />
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-full min-w-[var(--radix-popper-anchor-width)] p-0">
          <Command>
            <CommandInput placeholder={`Søk etter ${label.toLowerCase()}`} />
            <CommandList>
              <CommandEmpty>Ingen resultater funnet.</CommandEmpty>
              {grouped ? (
                <>
                  <CommandGroup heading="Formål">
                    {items
                      .filter((item) => !item.category)
                      .map((item) => (
                        <CommandItem
                          key={item.name}
                          onSelect={() => {
                            setSelectedValue(item.name);
                            setOpen(false);
                          }}
                        >
                          {item.name}
                        </CommandItem>
                      ))}
                  </CommandGroup>
                  {Object.entries(
                    items.reduce((acc, item) => {
                      if (item.category) {
                        if (!acc[item.category]) {
                          acc[item.category] = [];
                        }
                        acc[item.category].push(item);
                      }
                      return acc;
                    }, {} as Record<string, { name: string }[]>)
                  ).map(([category, items]) => (
                    <CommandGroup key={category} heading={category}>
                      {items.map((item) => (
                        <CommandItem
                          key={item.name}
                          onSelect={() => {
                            setSelectedValue(item.name);
                            setOpen(false);
                          }}
                        >
                          {item.name}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  ))}
                </>
              ) : (
                <CommandGroup heading={label}>
                  {items.map((item) => (
                    <CommandItem
                      key={item.name}
                      onSelect={() => {
                        setSelectedValue(item.name);
                        setOpen(false);
                      }}
                    >
                      {item.name}
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {hasError && (
        <p className="text-xs text-color-gn-primary mt-1 animate-fadeIn">
          {label.includes("Geo")
            ? "Du må velge et geografisk område"
            : label.includes("Proj")
            ? "Du må velge en projeksjon"
            : "Du må velge et format"}
        </p>
      )}
    </div>
  );
};

// Render a SelectionPopover component with a list of items
const renderSelectionPopover = (
  label: string,
  selectedValue: string,
  setSelectedValue: (value: string) => void,
  open: boolean,
  setOpen: (value: boolean) => void,
  items: { name: string; category?: string }[],
  placeholder: string,
  grouped = false,
  helpLink?: string,
  isDisabled = false,
  hasError = false
) => (
  <SelectionPopover
    label={label}
    helpLink={helpLink || ""}
    selectedValue={selectedValue}
    setSelectedValue={setSelectedValue}
    open={open}
    setOpen={setOpen}
    items={items}
    placeholder={placeholder}
    grouped={grouped}
    isDisabled={isDisabled}
    hasError={hasError}
  />
);

// Update step labels to remove user group step
const stepLabels = [
  "Standard nedlasting",
  "1. Velg område",
  "2. Bekreft og last ned",
];

// FileDownloadModal component
const FileDownloadModal: React.FC<FileDownloadModalProps> = ({
  isOpen,
  handleClose,
  handleStandardDownload,
  geographicalAreas,
  projections,
  formats,
  datasetName,
  onAreaChange,
  metadataUuid,
}) => {
  const [selectedLocation, setSelectedLocation] = useState<string>("");
  const [selectedProj, setSelectedProj] = useState<string>("");
  const [selectedFmt, setSelectedFmt] = useState<string>("");
  const [selectedGroup, setSelectedGroup] = useState<string>("");
  const [selectedGoal, setSelectedGoal] = useState<string>("");
  const [step, setStep] = useState<number>(0);
  const [manualStepChange, setManualStepChange] = useState<boolean>(false);

  const [openLocation, setOpenLocation] = useState<boolean>(false);
  const [openProj, setOpenProj] = useState<boolean>(false);
  const [openFmt, setOpenFmt] = useState<boolean>(false);
  const [openGroup, setOpenGroup] = useState<boolean>(false);
  const [openGoal, setOpenGoal] = useState<boolean>(false);

  const [validationErrors, setValidationErrors] = useState<{
    location?: boolean;
    projection?: boolean;
    format?: boolean;
  }>({});

  // Clear location error when location is selected
  useEffect(() => {
    if (selectedLocation && validationErrors.location) {
      setValidationErrors((prev) => ({ ...prev, location: false }));
    }
  }, [selectedLocation, validationErrors.location]);

  // Clear projection error when projection is selected
  useEffect(() => {
    if (selectedProj && validationErrors.projection) {
      setValidationErrors((prev) => ({ ...prev, projection: false }));
    }
  }, [selectedProj, validationErrors.projection]);

  // Clear format error when format is selected
  useEffect(() => {
    if (selectedFmt && validationErrors.format) {
      setValidationErrors((prev) => ({ ...prev, format: false }));
    }
  }, [selectedFmt, validationErrors.format]);

  // Reset modal state when new modal is opened
  useEffect(() => {
    if (isOpen) {
      setSelectedLocation("");
      setSelectedProj("");
      setSelectedFmt("");
      setSelectedGroup("");
      setSelectedGoal("");
      setStep(0);
      setManualStepChange(false);
    }
  }, [isOpen]);

  const uniqueGeographicalAreas = sortGeographicalAreas(
    Array.from(
      new Set(geographicalAreas.map((area) => JSON.stringify(area)))
    ).map((area) => JSON.parse(area))
  );

  // AUTO-FILL: If there is only one geographical area, select it automatically.
  useEffect(() => {
    if (uniqueGeographicalAreas.length === 1 && !selectedLocation) {
      setSelectedLocation(uniqueGeographicalAreas[0].name);
      onAreaChange(uniqueGeographicalAreas[0].code);
      setOpenLocation(false);
    }
  }, [uniqueGeographicalAreas, selectedLocation, onAreaChange]);

  const uniqueProjections = Array.from(
    new Set(projections.map((proj) => JSON.stringify(proj)))
  ).map((proj) => JSON.parse(proj));

  const uniqueFormats = Array.from(
    new Set(formats.map((format) => JSON.stringify({ name: format })))
  ).map((format) => JSON.parse(format));

  const nextStep = () => {
    if (step === 1) {
      // Check for validation errors
      const errors = {
        location: !selectedLocation,
        projection: !selectedProj,
        format: !selectedFmt,
      };

      // If any errors, set them and add visual feedback
      if (errors.location || errors.projection || errors.format) {
        setValidationErrors(errors);
        return;
      }
      // Clear errors if all fields are valid
      setValidationErrors({});
    }

    setManualStepChange(true);
    setStep((prev) => Math.min(prev + 1, 2));
  };

  const prevStep = () => {
    setManualStepChange(true);
    setStep((prev) => Math.max(prev - 1, 0));
  };

  // Auto-step progression
  useEffect(() => {
    if (!manualStepChange) {
      if (step === 1 && selectedLocation && selectedProj && selectedFmt) {
        setStep(2);
      } else if (step === 0 && selectedGroup && selectedGoal) {
        setStep(1);
      }
    }
  }, [
    step,
    selectedGroup,
    selectedGoal,
    selectedLocation,
    selectedProj,
    selectedFmt,
    manualStepChange,
  ]);

  // Once step 2 is reached, set manual step change to true
  useEffect(() => {
    if (step === 2) {
      setManualStepChange(true);
    }
  }, [step]);

  const handleDownload = async () => {
    try {
      // Check if any selections have been made, if not use standard download
      // CHANGE LOGIC LATER -> USE USER INPUT VALUES AND FILL IN MISSING VALUES WITH DEFAULT VALUES
      if (!selectedLocation || !selectedProj || !selectedFmt) {
        handleStandardDownload();
        handleClose();
        return;
      }

      const selectedArea = uniqueGeographicalAreas.find(
        (area) => area.name === selectedLocation
      );
      const selectedProjection = uniqueProjections.find(
        (proj) => proj.name === selectedProj
      );

      const orderRequest = {
        metadataUuid: metadataUuid,
        area: {
          code: selectedArea?.code || "",
          name: selectedArea?.name || "",
          type: selectedArea?.type || "",
        },
        projection: {
          code: selectedProjection?.code || "",
          name: selectedProjection?.name || "",
          codespace: selectedProjection?.codespace || "",
        },
        format: {
          name: selectedFmt,
        },
        userGroup: selectedGroup,
        purpose: selectedGoal,
      };

      const response = await fetch("/api/download/order", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(orderRequest),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          errorData.error || `HTTP error! status: ${response.status}`
        );
      }

      const data = await response.json();

      if (data.files?.[0]?.downloadUrl) {
        window.location.href = data.files[0].downloadUrl;
        handleClose();
      } else {
        throw new Error("No download URL received from the server");
      }
    } catch (error) {
      console.error("Download failed:", error);
      alert(
        `Download failed: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  };

  const handleConfirmSelectionWithLoading = async () => {
    await handleDownload();
  };

  if (!isOpen) return null;

  // Update progress calculation for 3 steps instead of 4
  const progressValue = (step / 2) * 100;

  return (
    <TooltipProvider delayDuration={100}>
      <div
        className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-[50]"
        onClick={(e) => {
          // Stop propagation and only close if the backdrop was clicked
          e.stopPropagation();
          if (e.target === e.currentTarget) {
            handleClose();
          }
        }}
      >
        <div
          className="bg-white rounded-lg shadow-xl p-6 w-full max-w-sm sm:max-w-md md:max-w-lg lg:max-w-xl xl:max-w-2xl 
  relative min-h-[300px] sm:min-h-[400px] md:min-h-[450px] lg:min-h-[500px] xl:min-h-[550px]
  sm:h-auto md:h-auto lg:h-auto xl:h-auto 
  sm:w-[70%] md:w-[60%] lg:w-[50%] xl:w-[40%] 
  flex flex-col justify-between"
        >
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                onClick={handleClose}
                className="absolute top-2 right-2 px-4 text-gray-600 hover:text-gray-800"
                aria-label="Lukk"
              >
                <X />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <p>Lukk</p>
            </TooltipContent>
          </Tooltip>
          <div className="flex items-center justify-start mb-4">
            <GeoNorgeLogo className="w-32 h-auto" />
          </div>
          <h2 className="text-1xl font-semibold text-color-gn-secondary mb-3">
            Filnedlastning - {step === 2 ? "Nedlastning" : "Bestilling"}
            <p className="text-2xl text-color-kv-secondary mt-1 font-medium">
              {datasetName}
            </p>
          </h2>

          <Separator />
          <Progress
            value={progressValue}
            className="my-4"
            bgColor={"bg-color-kv-primary"}
          />
          <div className="flex justify-between text-sm text-gray-600">
            {stepLabels.map((label, index) => (
              <span
                key={index}
                className={`${
                  step === index ? "text-color-kv-secondary font-semibold" : ""
                } cursor-pointer`}
                onClick={() => setStep(index)}
              >
                {label}
              </span>
            ))}
          </div>
          <div className="flex-1 overflow-y-auto">
            {/* Steg 0: Velg brukergruppe og formål */}
            {step === 0 && (
              <div className="space-y-4 mt-4">
                <Separator />
                {renderSelectionPopover(
                  "Brukergruppe",
                  selectedGroup,
                  setSelectedGroup,
                  openGroup,
                  setOpenGroup,
                  userGroups,
                  "Velg brukergruppe..."
                )}
                {renderSelectionPopover(
                  "Formål",
                  selectedGoal,
                  setSelectedGoal,
                  openGoal,
                  setOpenGoal,
                  groupedGoals,
                  "Velg formål...",
                  true
                )}
              </div>
            )}
            {/* Steg 1: Velg område, projeksjon og format */}
            {step === 1 && (
              <div className="space-y-4 mt-4">
                <Separator />
                <div>
                  <div className="flex items-center mb-2 gap-1 text-sm text-color-gn-secondary">
                    <p className="font-semibold">Geografisk område</p>
                    {renderTooltip(
                      "https://www.geonorge.no/aktuelt/om-geonorge/slik-bruker-du-geonorge/omradeinndelinger/",
                      "Geografisk område"
                    )}
                  </div>
                  <Popover open={openLocation} onOpenChange={setOpenLocation}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={`w-full justify-start text-left ${validationErrors.location}`}
                        aria-labelledby="geo-area-label"
                      >
                        {selectedLocation || "Velg område..."}
                        <ArrowDownAZ className="ml-auto" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-full min-w-[var(--radix-popper-anchor-width)] p-0">
                      <Command>
                        <CommandInput placeholder="Søk etter geografisk område..." />
                        <CommandList>
                          <CommandEmpty>Ingen resultater funnet.</CommandEmpty>
                          {Object.entries(
                            uniqueGeographicalAreas.reduce((acc, item) => {
                              if (!acc[item.type]) {
                                acc[item.type] = [];
                              }
                              acc[item.type].push(item);
                              return acc;
                            }, {} as Record<string, { name: string; code: string }[]>)
                          ).map(([type, items]) => (
                            <CommandGroup
                              key={type}
                              heading={capitalizeFirstLetter(type)}
                            >
                              {items.map((item) => (
                                <CommandItem
                                  key={item.name}
                                  onSelect={() => {
                                    setSelectedLocation(item.name);
                                    setOpenLocation(false);
                                    onAreaChange(item.code);
                                  }}
                                >
                                  {item.name}
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          ))}
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                  {validationErrors.location && (
                    <p className="text-xs text-color-gn-primary mt-1 animate-fadeIn">
                      Du må velge et geografisk område
                    </p>
                  )}
                </div>

                {renderSelectionPopover(
                  "Projeksjon",
                  selectedProj,
                  setSelectedProj,
                  openProj,
                  setOpenProj,
                  uniqueProjections,
                  "Velg projeksjon...",
                  false,
                  "https://www.geonorge.no/aktuelt/om-geonorge/slik-bruker-du-geonorge/kartprojeksjoner-og-koordinatsystemer/",
                  !selectedLocation,
                  validationErrors.projection
                )}

                {renderSelectionPopover(
                  "Format",
                  selectedFmt,
                  setSelectedFmt,
                  openFmt,
                  setOpenFmt,
                  uniqueFormats,
                  "Velg format...",
                  false,
                  "https://www.geonorge.no/aktuelt/om-geonorge/slik-bruker-du-geonorge/formater/",
                  !selectedLocation || !selectedProj,
                  validationErrors.projection
                )}
              </div>
            )}

            {/* Steg 2: Oversikt Items */}
            {step === 2 && (
              <div className="space-y-4 mt-4">
                <Separator />
                <p className="text-xl font-semibold text-color-gn-secondary">
                  Oversikt - bekreft og last ned
                </p>
                <SummaryItem
                  label="Geografisk område"
                  value={selectedLocation}
                />
                <SummaryItem label="Projeksjon" value={selectedProj} />
                <SummaryItem label="Format" value={selectedFmt} />
                <SummaryItem label="Brukergruppe" value={selectedGroup} />
                <SummaryItem label="Formål" value={selectedGoal} />
              </div>
            )}
          </div>
          <StepNavigationButtons
            step={step}
            nextStep={nextStep}
            prevStep={prevStep}
            handleClose={handleClose}
            handleConfirmSelectionWithLoading={
              handleConfirmSelectionWithLoading
            }
          />
        </div>
      </div>
    </TooltipProvider>
  );
};

export default FileDownloadModal;
