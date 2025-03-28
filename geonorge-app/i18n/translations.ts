export type Language = "nb" | "nn" | "en";

export type TranslationKey =
  | "background_map"
  | "theme_maps"
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
  | "tour_reset_toast_message"
  | "privacy_and_cookies"
  | "privacy_description"
  | "privacy_link_text"
  | "feedback_question"
  | "feedback_description"
  | "phone_label"
  | "email_label"
  | "feedback_form"
  | "close_button"
  | "feature_not_available"
  | "search_address_placeholder"
  | "search_address"
  | "languages";

export const translations: Record<Language, Record<TranslationKey, string>> = {
  nb: {
    background_map: "Bakgrunnskart",
    theme_maps: "Temakart",
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

    privacy_and_cookies: "Personvern og cookies",
    privacy_description: "Les hvordan vi tar vare på personopplysninger i",
    privacy_link_text: "Kartverkets personvernerklæring",

    feedback_question: "Synspunkter eller feil?",
    feedback_description:
      "Har du ris, ros eller tips vedrørende geonorge.no, er vi takknemlige for innspill. Du kan kontakte oss på følgende måter:",
    phone_label: "Telefon:",
    email_label: "E-post:",
    feedback_form: "Gå til tilbakemeldingsskjema",
    close_button: "Lukk",
    feature_not_available: "Denne funksjonen er ikke tilgjengelig ennå",
    search_address: "Adressesøk",
    search_address_placeholder: "Søk etter adresse",
    languages: "Språk",
  },
  nn: {
    background_map: "Bakgrunnskart",
    theme_maps: "Temakart",
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

    privacy_and_cookies: "Personvern og cookies",
    privacy_description: "Les korleis vi tek vare på personopplysningar i",
    privacy_link_text: "Kartverket si personvernerklæring",

    feedback_question: "Synspunkt eller feil?",
    feedback_description:
      "Har du ris, ros eller tips vedkomande geonorge.no, er vi takksame for innspel. Du kan kontakte oss på følgjande måtar:",
    phone_label: "Telefon:",
    email_label: "E-post:",
    feedback_form: "Gå til tilbakemeldingsskjema",
    close_button: "Lukk",
    feature_not_available: "Denne funksjonen er ikkje tilgjengeleg enno",
    search_address: "Adressesøk",
    search_address_placeholder: "Søk etter adresse",
    languages: "Språk",
  },
  en: {
    background_map: "Background Map",
    theme_maps: "Thematic Maps",
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

    privacy_and_cookies: "Privacy and cookies",
    privacy_description: "Read how we handle personal information in",
    privacy_link_text: "Kartverket's privacy statement",

    feedback_question: "Comments or errors?",
    feedback_description:
      "If you have feedback or tips regarding geonorge.no, we appreciate your input. You can contact us in the following ways:",
    phone_label: "Phone:",
    email_label: "Email:",
    feedback_form: "Go to feedback form",
    close_button: "Close",
    feature_not_available: "This feature is not available yet",
    search_address: "Address Search",
    search_address_placeholder: "Search for address...",
    languages: "Languages",
  },
};
