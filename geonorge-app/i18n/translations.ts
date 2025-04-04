export type Language = "nb" | "nn" | "en";

export type TranslationKey =
  | "background_map"
  | "theme_maps"
  | "search_layers"
  | "active_datasets"
  | "deselect_all"
  | "remove_dataset"
  | "no_layers_found"
  | "tool"
  | "draw_and_measure"
  | "share_map"
  | "create_elevation_profile"
  | "tips_and_tricks"
  | "contact_us"
  | "privacy"
  | "landscape_map"
  | "grayscale_map"
  | "raster_map"
  | "sea_map"
  | "reset_tour_title"
  | "tour_reset_message"
  | "reset_tour_button"
  | "back_button"
  | "tour_reset_toast_message";

export const translations: Record<Language, Record<TranslationKey, string>> = {
  nb: {
    background_map: "Bakgrunnskart",
    theme_maps: "Temakart",
    active_datasets: "Aktive datasett",
    deselect_all: "Fjern alle valgte lag",
    remove_dataset: "Fjern datasett",
    search_layers: "Søk etter lag...",
    no_layers_found: "Ingen lag funnet",
    tool: "Verktøy",
    draw_and_measure: "TEGNE OG MÅLE",
    share_map: "DELE KARTET",
    create_elevation_profile: "LAG HØYDEPROFIL",
    tips_and_tricks: "Tips og triks",
    contact_us: "Kontakt oss",
    privacy: "Personvern",
    landscape_map: "Landskart",
    grayscale_map: "Gråtone",
    raster_map: "Rasterkart",
    sea_map: "Sjøkart",
    reset_tour_title: "Tilbakestill omvisning",
    tour_reset_message:
      "Klikk på knappen under for å starte omvisningen på nytt.",
    reset_tour_button: "Tilbakestill omvisning",
    back_button: "Tilbake",
    tour_reset_toast_message:
      "Omvisningen er tilbakestilt! Last inn siden på nytt for å se den igjen.",
  },
  nn: {
    background_map: "Bakgrunnskart",
    theme_maps: "Temakart",
    active_datasets: "Aktive datasett",
    deselect_all: "Fjern alle valgte lag",
    remove_dataset: "Fjern datasett",
    search_layers: "Søk etter lag...",
    no_layers_found: "Ingen lag funne",
    tool: "Verktøy",
    draw_and_measure: "TEIKNE OG MÅLE",
    share_map: "DELE KARTET",
    create_elevation_profile: "LAG HØGDEPROFIL",
    tips_and_tricks: "Tips og triks",
    contact_us: "Kontakt oss",
    privacy: "Personvern",
    landscape_map: "Landskart",
    grayscale_map: "Gråtone",
    raster_map: "Rasterkart",
    sea_map: "Sjøkart",
    reset_tour_title: "Tilbakestill omvising",
    tour_reset_message:
      "Klikk på knappen under for å starte omvisinga på nytt.",
    reset_tour_button: "Tilbakestill omvising",
    back_button: "Tilbake",
    tour_reset_toast_message:
      "Omvisinga er tilbakestilt! Last inn sida på nytt for å sjå ho igjen.",
  },
  en: {
    background_map: "Background Map",
    theme_maps: "Thematic Maps",
    active_datasets: "Active daatasets",
    deselect_all: "Deselect all layers",
    remove_dataset: "Remove dataset",
    search_layers: "Search for layers...",
    no_layers_found: "No layers found",
    tool: "Tools",
    draw_and_measure: "DRAW AND MEASURE",
    share_map: "SHARE MAP",
    create_elevation_profile: "CREATE ELEVATION PROFILE",
    tips_and_tricks: "Tips and tricks",
    contact_us: "Contact us",
    privacy: "Privacy",
    landscape_map: "Landscape map",
    grayscale_map: "Grayscale",
    raster_map: "Raster map",
    sea_map: "Sea map",
    reset_tour_title: "Reset Tour",
    tour_reset_message:
      "Click the button below to restart the application tour.",
    reset_tour_button: "Reset Tour",
    back_button: "Back",
    tour_reset_toast_message: "Tour reset! Reload the page to see it again.",
  },
};
