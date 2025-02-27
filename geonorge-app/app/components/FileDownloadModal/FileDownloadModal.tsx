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
import CloseIcon from "@mui/icons-material/Close";
import GeoNorgeLogo from "../GeoNorgeLogo";
import HelpOutlinedIcon from "@mui/icons-material/HelpOutlined";

interface FileDownloadModalProps {
  isOpen: boolean;
  handleClose: () => void;
  handleConfirmSelection: () => void;
  geographicalAreas: { type: string; name: string; code: string }[];
  projections: { name: string; code: string }[];
  formats: string[];
  datasetName: string;
  onAreaChange: (selectedAreaCode: string) => void;
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
        >
          <HelpOutlinedIcon className="text-color-kv-secondary hover:text-color-gn-primary transition-colors duration-100" />
        </a>
      </TooltipTrigger>
      <TooltipContent side="right">
        <p>Klikk for mer informasjon</p>
      </TooltipContent>
    </Tooltip>
  </TooltipProvider>
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
}) => {
  // Autofill the selected value if there is only one item in the list
  useEffect(() => {
    if (items.length === 1 && !selectedValue) {
      setSelectedValue(items[0].name);
      setOpen(false);
    }
  }, [items, selectedValue, setSelectedValue, setOpen]);

  return (
    <div>
      <div className="flex items-center gap-1 text-sm text-color-gn-secondary">
        <strong>{label}</strong>
        {label.includes(":") && (
          <span className="text-color-gn-primary text-sm">*</span>
        )}
        {helpLink && renderTooltip(helpLink, label)}
      </div>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" className="w-full justify-start text-left">
            {selectedValue || placeholder}
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
  helpLink?: string // Make helpLink optional
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
  handleConfirmSelection,
  geographicalAreas,
  projections,
  datasetName,
  formats,
  onAreaChange,
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
    setManualStepChange(true);
    setStep((prev) => Math.min(prev + 1, 2));
  };

  const prevStep = () => {
    setManualStepChange(true);
    setStep((prev) => Math.max(prev - 1, 0));
  };

  // Auto-step progression to require both user group and purpose
  useEffect(() => {
    if (!manualStepChange) {
      if (step === 1 && selectedLocation && selectedProj && selectedFmt) {
        setStep(2);
      }
    }
  }, [
    step,
    selectedGroup,
    selectedGoal, // Added selectedGoal to dependencies
    selectedLocation,
    selectedProj,
    selectedFmt,
    manualStepChange,
  ]);

  // Once step 2 is reached, lock auto-step progression by setting manualStepChange to true
  useEffect(() => {
    if (step === 2) {
      setManualStepChange(true);
    }
  }, [step]);

  const handleConfirmSelectionWithLoading = async () => {
    try {
      await handleConfirmSelection();
    } catch (error: unknown) {
      console.error("Failed to confirm selection:", error);
    }
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
          {" "}
          <button
            onClick={handleClose}
            className="absolute top-2 right-2 text-gray-600 hover:text-gray-800"
            aria-label="Lukk"
          >
            <CloseIcon />
          </button>
          <div className="flex items-center justify-start mb-4">
            <GeoNorgeLogo />
          </div>
          <h2 className="text-xl text-color-gn-secondary mb-2">
            Filnedlastning - {step === 2 ? "nedlastning" : "bestilling"}
          </h2>
          <Separator />
          <Progress
            value={progressValue}
            className="my-4"
            bgColor={"bg-color-gn-primary"}
          />
          <div className="flex justify-between text-sm text-gray-600">
            {stepLabels.map((label, index) => (
              <span
                key={index}
                className={`${
                  step === index ? "text-color-kv-secondary font-bold" : ""
                } cursor-pointer`}
                onClick={() => setStep(index)}
              >
                {label}
              </span>
            ))}
          </div>
          <div className="flex-1 overflow-y-auto">
            {step === 0 && (
              <div className="space-y-4 mt-4">
                <Separator />
                <span className="block mt-2 text-sm text-color-gn-secondary">
                  <strong>Datasettets navn:</strong>{" "}
                  <Badge
                    variant="default"
                    className="bg-color-gn-lightblue text-white"
                  >
                    {datasetName || "N/A"}
                  </Badge>
                </span>
                {/* Moved from step 2 to step 0 */}
                {renderSelectionPopover(
                  "Brukergruppe:",
                  selectedGroup,
                  setSelectedGroup,
                  openGroup,
                  setOpenGroup,
                  userGroups,
                  "Velg brukergruppe..."
                )}
                {renderSelectionPopover(
                  "Formål:",
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

            {step === 1 && (
              <div className="space-y-4 mt-4">
                <Separator />
                <span className="block mt-2 text-sm text-color-gn-secondary">
                  <strong>Datasettets navn:</strong>{" "}
                  <Badge
                    variant="default"
                    className="bg-color-gn-lightblue text-white"
                  >
                    {datasetName || "N/A"}
                  </Badge>
                </span>
                <div>
                  <div className="flex items-center gap-1 text-sm text-color-gn-secondary">
                    <strong id="geo-area-label">Geografisk område</strong>
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
                        {selectedLocation || "Velg område..."}
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
                  "https://www.geonorge.no/aktuelt/om-geonorge/slik-bruker-du-geonorge/kartprojeksjoner-og-koordinatsystemer/"
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
                  "https://www.geonorge.no/aktuelt/om-geonorge/slik-bruker-du-geonorge/formater/"
                )}
              </div>
            )}

            {step === 2 && (
              <div className="space-y-4 mt-4">
                <Separator />

                <span className="block mt-2 text-sm text-color-gn-secondary">
                  <strong>Datasettets navn:</strong>{" "}
                  <Badge
                    variant="default"
                    className="bg-color-gn-lightblue text-white"
                  >
                    {datasetName || "N/A"}
                  </Badge>
                </span>
                <span className="block mt-2 text-sm text-color-gn-secondary">
                  <strong>Geografisk område:</strong>{" "}
                  <Badge
                    variant="default"
                    className="bg-color-gn-lightblue text-white"
                  >
                    {selectedLocation || "N/A"}
                  </Badge>
                </span>
                <span className="block mt-2 text-sm text-color-gn-secondary">
                  <strong>Projeksjon:</strong>{" "}
                  <Badge
                    variant="default"
                    className="bg-color-gn-lightblue text-white ml-1"
                  >
                    {selectedProj || "N/A"}
                  </Badge>
                </span>
                <span className="block mt-2 text-sm text-color-gn-secondary">
                  <strong>Format:</strong>{" "}
                  <Badge
                    variant="default"
                    className="bg-color-gn-lightblue text-white ml-1"
                  >
                    {selectedFmt || "N/A"}
                  </Badge>
                </span>
                <span className="block mt-2 text-sm text-color-gn-secondary">
                  <strong>Brukergruppe:</strong>{" "}
                  <Badge
                    variant="default"
                    className="bg-color-gn-lightblue text-white ml-1"
                  >
                    {selectedGroup || "N/A"}
                  </Badge>
                </span>
                <span className="block mt-2 text-sm text-color-gn-secondary">
                  <strong>Formål:</strong>{" "}
                  <Badge
                    variant="default"
                    className="bg-color-gn-lightblue text-white ml-1"
                  >
                    {selectedGoal || "N/A"}
                  </Badge>
                </span>
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
