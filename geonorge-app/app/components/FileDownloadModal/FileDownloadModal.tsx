import React, { useEffect, useState, useRef } from "react";

// Type definitions
interface FileDownloadModalProps {
  isOpen: boolean;
  handleClose: () => void;
  handleStandardDownload: () => void;
  geographicalAreas: { name: string; code: string; type: string }[];
  projections: { name: string; code: string; codespace: string }[];
  formats: string[];
  datasetName: string;
  onAreaChange: (areaCode: string) => void;
  metadataUuid: string;
}

// Utils
import { fixNorwegianEncoding } from "./utils/fixNbEncoding";
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
import { Separator } from "@/components/ui/separator";

// Icons or images
import GeoNorgeLogo from "@/components/ui/GeoNorgeLogo";
import { ArrowDownAZ, Info, X, CheckCircle2 } from "lucide-react";

// Custom ProgressSteps component
const ProgressSteps = ({
  currentStep,
  isEditing,
  onStepClick,
}: {
  currentStep: number;
  isEditing: boolean;
  onStepClick: (step: number) => void;
}) => {
  const steps = [
    { index: 0, label: "Område" },
    { index: 1, label: "Brukergruppe" },
    { index: 2, label: "Oversikt" },
  ];

  // Determine active step for display purposes
  const activeStep = isEditing ? currentStep : 2;

  return (
    <div className="my-5">
      <div className="flex items-center justify-between">
        {steps.map((step, i) => (
          <React.Fragment key={step.index}>
            {/* Step Circle */}
            <div
              className="relative flex flex-col items-center group cursor-pointer"
              onClick={() => onStepClick(step.index)}
            >
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300
                  ${
                    i < activeStep || (!isEditing && i === 2)
                      ? "bg-color-kv-primary text-white"
                      : i === activeStep
                      ? "bg-color-kv-secondary text-white ring-2 ring-color-kv-secondary ring-offset-2"
                      : "bg-gray-200 text-gray-500"
                  }`}
              >
                {i < activeStep || (!isEditing && i === 2) ? (
                  <CheckCircle2 size={16} />
                ) : (
                  <span className="text-sm font-medium">{i + 1}</span>
                )}
              </div>

              {/* Step Label */}
              <span
                className={`absolute -bottom-7 text-xs font-medium transition-colors
                  ${
                    i === activeStep
                      ? "text-color-kv-secondary"
                      : i < activeStep || (!isEditing && i === 2)
                      ? "text-color-kv-secondary"
                      : "text-gray-500"
                  }`}
              >
                {step.label}
              </span>

              {/* Tooltip for clickable steps */}
              <div
                className="absolute -bottom-12 left-1/2 transform -translate-x-1/2 opacity-0 
                          group-hover:opacity-100 transition-opacity text-xs bg-gray-800 text-white 
                          py-1 px-2 rounded pointer-events-none"
              >
                Velg {step.label.toLowerCase()}
              </div>
            </div>

            {/* Connecting Line */}
            {i < steps.length - 1 && (
              <div className="flex-1 mx-2 h-[2px] relative">
                <div className="absolute inset-0 bg-gray-200"></div>
                <div
                  className={`absolute inset-0 bg-color-kv-primary transition-all duration-500 origin-left`}
                  style={{
                    transform: i < activeStep ? "scaleX(1)" : "scaleX(0)",
                  }}
                ></div>
              </div>
            )}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
};

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
      {fixNorwegianEncoding(value) || "Ikke valgt"}
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
              ${isDisabled ? "opacity-60 cursor-not-allowed" : ""}`}
            disabled={isDisabled}
          >
            {fixNorwegianEncoding(selectedValue) || placeholder}

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
        <PopoverContent className="w-full min-w-[var(--radix-popover-anchor-width)] p-0">
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
                          {fixNorwegianEncoding(item.name)}
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
                          {fixNorwegianEncoding(item.name)}
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
                      {fixNorwegianEncoding(item.name)}
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
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
  isDisabled = false
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
  />
);

// Simplify how we track steps
const STEPS = {
  INITIAL_OVERVIEW: 0,
  AREA: 1,
  USER_GROUP: 2,
};

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
  const [step, setStep] = useState<number>(STEPS.INITIAL_OVERVIEW);
  const [isEditing, setIsEditing] = useState<boolean>(false);

  const [openLocation, setOpenLocation] = useState<boolean>(false);
  const [openProj, setOpenProj] = useState<boolean>(false);
  const [openFmt, setOpenFmt] = useState<boolean>(false);
  const [openGroup, setOpenGroup] = useState<boolean>(false);
  const [openGoal, setOpenGoal] = useState<boolean>(false);

  // Keep track of available options based on current selection
  const [availableProjections, setAvailableProjections] = useState<
    typeof projections
  >([]);
  const [availableFormats, setAvailableFormats] = useState<string[]>([]);

  const initialLoadRef = useRef<boolean>(false);

  // Reset modal state and pre-fill default values when modal opens
  useEffect(() => {
    if (isOpen && !initialLoadRef.current) {
      initialLoadRef.current = true;

      // Set default values from first element of each array
      if (geographicalAreas.length > 0) {
        const defaultArea = geographicalAreas[0];
        setSelectedLocation(defaultArea.name);
        onAreaChange(defaultArea.code);

        // Update available projections based on this area
        // This will be updated in the API response handler
        setAvailableProjections(projections);

        if (projections.length > 0) {
          setSelectedProj(projections[0].name);

          // Update available formats based on the selected projection
          setAvailableFormats(formats);

          if (formats.length > 0) {
            setSelectedFmt(formats[0]);
          }
        }
      }

      // Set default values for brukergruppe and formål
      if (userGroups.length > 0) {
        setSelectedGroup(userGroups[0].name);
      }

      if (groupedGoals.length > 0) {
        setSelectedGoal(groupedGoals[0].name);
      }

      // Reset to overview
      setStep(STEPS.INITIAL_OVERVIEW);
      setIsEditing(false);
    } else if (!isOpen) {
      initialLoadRef.current = false;
    }
  }, [isOpen, geographicalAreas, projections, formats, onAreaChange]);

  // Handle area change - update projections and formats
  const handleAreaChange = (areaName: string, areaCode: string) => {
    setSelectedLocation(areaName);
    onAreaChange(areaCode); // This will trigger API call to get updated projections

    // Reset projection and format since they depend on the area
    setSelectedProj("");
    setSelectedFmt("");
  };

  // Effect to watch for projection and format changes from API
  useEffect(() => {
    if (selectedLocation) {
      // Update available projections when the API returns new data
      setAvailableProjections(projections);

      // Auto-select first projection if available
      if (projections.length > 0 && !selectedProj) {
        setSelectedProj(projections[0].name);
      }
    }
  }, [projections, selectedLocation, selectedProj]);

  // Effect to update formats when projection changes
  useEffect(() => {
    if (selectedProj) {
      // Update available formats based on selected projection
      setAvailableFormats(formats);

      // Auto-select first format if available
      if (formats.length > 0 && !selectedFmt) {
        setSelectedFmt(formats[0]);
      }
    }
  }, [formats, selectedProj, selectedFmt]);

  const uniqueGeographicalAreas = sortGeographicalAreas(
    Array.from(
      new Set(geographicalAreas.map((area) => JSON.stringify(area)))
    ).map((area) => JSON.parse(area))
  );

  const uniqueProjections = Array.from(
    new Set(availableProjections.map((proj) => JSON.stringify(proj)))
  ).map((proj) => JSON.parse(proj));

  const uniqueFormats = Array.from(
    new Set(availableFormats.map((format) => JSON.stringify({ name: format })))
  ).map((format) => JSON.parse(format));

  // Function to handle step navigation via clicking on step labels
  const handleStepClick = (targetStep: number) => {
    // Convert between component's step indices and our STEPS constants
    const stepMapping = [STEPS.AREA, STEPS.USER_GROUP, STEPS.INITIAL_OVERVIEW];
    const mappedStep = stepMapping[targetStep];

    // Allow free navigation between all steps including overview
    if (isEditing) {
      if (mappedStep === STEPS.INITIAL_OVERVIEW) {
        completeEditing(); // Go to overview and exit editing mode
      } else {
        setStep(mappedStep); // Navigate to selected step while maintaining editing mode
      }
    } else if (!isEditing && mappedStep === STEPS.INITIAL_OVERVIEW) {
      // Already on overview, nothing to do
      setStep(STEPS.INITIAL_OVERVIEW);
    } else if (!isEditing) {
      // If on overview and clicking a step other than overview, start editing at that step
      setIsEditing(true);
      setStep(mappedStep);
    }
  };

  // Start the editing process
  const startEditing = () => {
    setIsEditing(true);
    setStep(STEPS.AREA);
  };

  // Complete the editing process - go back to initial overview
  const completeEditing = () => {
    setIsEditing(false);
    setStep(STEPS.INITIAL_OVERVIEW);
  };

  const nextStep = () => {
    if (step === STEPS.INITIAL_OVERVIEW && !isEditing) {
      // Start editing when clicking "Endre" on initial overview
      startEditing();
      return;
    }

    if (step === STEPS.AREA) {
      // Go to user group step
      setStep(STEPS.USER_GROUP);
    } else if (step === STEPS.USER_GROUP) {
      // Complete editing and go back to overview
      completeEditing();
    }
  };

  const prevStep = () => {
    if (step === STEPS.AREA) {
      // If at first edit step, go back to initial overview
      completeEditing();
    } else if (step === STEPS.USER_GROUP) {
      // Go back to area step without validation (since area -> user group is optional)
      setStep(STEPS.AREA);
    }
  };

  const handleDownload = async () => {
    try {
      // Use default values if nothing is selected
      if (!selectedProj || !selectedFmt) {
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

  return (
    <TooltipProvider delayDuration={100}>
      <div
        className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-[50]"
        onClick={(e) => {
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
          {/* Close button */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClose}
                className="absolute top-2 right-2 text-color-gn-secondary hover:bg-gray-100"
                aria-label="Lukk"
              >
                <X />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <p>Lukk</p>
            </TooltipContent>
          </Tooltip>

          {/* Logo and Header */}
          <div className="flex items-center justify-start mb-4">
            <GeoNorgeLogo className="w-32 h-auto" />
          </div>

          <h2 className="text-1xl font-semibold text-color-gn-secondary mb-3">
            Filnedlastning -{" "}
            {step === STEPS.INITIAL_OVERVIEW ? "Oversikt" : "Brukergruppe"}
          </h2>

          {/* Dataset name below title */}
          <p className="text-2xl text-color-kv-secondary mb-4 font-medium">
            {datasetName}
          </p>

          <Separator />

          {/* Replace Progress bar with new ProgressSteps component */}
          <ProgressSteps
            currentStep={
              step === STEPS.AREA ? 0 : step === STEPS.USER_GROUP ? 1 : 2
            }
            isEditing={isEditing}
            onStepClick={handleStepClick}
          />

          <div className="flex-1 overflow-y-auto mt-4">
            {/* Initial Overview Screen */}
            {step === STEPS.INITIAL_OVERVIEW && (
              <div className="space-y-4">
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

            {/* Area selection (step 1) */}
            {step === STEPS.AREA && (
              <div className="space-y-4">
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
                        className="w-full justify-start text-left"
                        aria-labelledby="geo-area-label"
                      >
                        {fixNorwegianEncoding(selectedLocation) ||
                          "Velg område..."}
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
                                    handleAreaChange(item.name, item.code);
                                    setOpenLocation(false);
                                  }}
                                >
                                  {fixNorwegianEncoding(item.name)}
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          ))}
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
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
                  !selectedLocation || uniqueProjections.length === 0
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
                  !selectedLocation ||
                    !selectedProj ||
                    uniqueFormats.length === 0
                )}
              </div>
            )}

            {/* User Group selection (step 2) */}
            {step === STEPS.USER_GROUP && (
              <div className="space-y-4">
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
