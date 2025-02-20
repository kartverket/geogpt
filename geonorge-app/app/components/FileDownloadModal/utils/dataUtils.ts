// Capitalize the first letter of a string
export const capitalizeFirstLetter = (string: string) => {
  return string.charAt(0).toUpperCase() + string.slice(1);
};

// Sort geographical areas and put "Hele landet" first
export const sortGeographicalAreas = (
  areas: { type: string; name: string; code: string }[]
) => {
  return areas.sort((a, b) => {
    if (a.type === "landsdekkende" && a.name === "Hele landet") return -1;
    if (b.type === "landsdekkende" && b.name === "Hele landet") return 1;
    return 0;
  });
};
