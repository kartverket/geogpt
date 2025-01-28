// URL for searching datasets on Geonorge
const GEONORGE_SEARCH_URL = "https://kartkatalog.geonorge.no/search";
// Styles for the dataset links
const LINK_STYLES = {
  color: "#ff7e4d",
  fontWeight: "bold",
} as const;

const formatDatasetLink = (datasetName: string): string => {
  const link = {
    name: datasetName,
    url: `${GEONORGE_SEARCH_URL}?text=${encodeURIComponent(datasetName)}`,
    styles: Object.entries(LINK_STYLES)
      .map(([key, value]) => `${key}: ${value}`)
      .join("; "),
  };

  return `<a href="${link.url}" target="_blank" style="${link.styles}">${link.name}</a>`;
};

export default formatDatasetLink;
