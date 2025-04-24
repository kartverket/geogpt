export const fixNorwegianEncoding = (text: string): string => {
  if (!text) return text;
  // Fix elements with UTF-8 char errors
  return text
    .replace(/Ã¸/g, "ø")
    .replace(/Ã¥/g, "å")
    .replace(/Ã¦/g, "æ")
    .replace(/Ã˜/g, "Ø")
    .replace(/Ã…/g, "Å")
    .replace(/Ã†/g, "Æ");
};
