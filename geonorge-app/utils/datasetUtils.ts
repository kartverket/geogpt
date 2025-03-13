// Function to filter away duplicates from arrays of strings, areas and projections
export const dedupeFormats = (formats: string[]): string[] => {
  const formatMap = new Map<string, string>();
  for (const f of formats) {
    const key = f.trim().toLowerCase();
    if (!formatMap.has(key)) {
      formatMap.set(key, f.trim());
    }
  }
  return Array.from(formatMap.values());
};

export const dedupeAreas = (
  areas: { type: string; name: string; code: string }[]
): typeof areas => {
  const areaMap = new Map<string, (typeof areas)[0]>();
  for (const area of areas) {
    const key = area.code.trim().toLowerCase();
    if (!areaMap.has(key)) {
      areaMap.set(key, { ...area, name: area.name.trim() });
    }
  }
  return Array.from(areaMap.values());
};

export const dedupeProjections = (
  projections: { name: string; code: string }[]
): typeof projections => {
  const projectionMap = new Map<string, (typeof projections)[0]>();
  for (const proj of projections) {
    const key = proj.code.trim().toLowerCase();
    if (!projectionMap.has(key)) {
      projectionMap.set(key, { ...proj, name: proj.name.trim() });
    }
  }
  return Array.from(projectionMap.values());
};

// Function to get the formats and projections for a selected area
export const getAreaFormatsAndProjections = (
  selectedAreaCode: string,
  downloadFormats: Array<{
    type: string;
    name: string;
    code: string;
    projections?: { name: string; code: string }[];
    formats?: { name: string }[];
  }>
) => {
  const selectedArea = downloadFormats.find(
    (fmt) => fmt.code === selectedAreaCode
  );

  if (selectedArea) {
    const projections = selectedArea.projections
      ? selectedArea.projections.map((proj) => ({
          name: proj.name,
          code: proj.code,
        }))
      : [];

    const formats = selectedArea.formats
      ? selectedArea.formats.map((format) => format.name)
      : [];

    return { projections, formats };
  } else {
    return { projections: [], formats: [] };
  }
};
