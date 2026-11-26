export function isLowStock(grams: number, lowThreshold: number) {
  return grams <= lowThreshold;
}

export function debitStock(grams: number, debitGrams: number) {
  return Math.max(0, grams - Math.max(0, debitGrams));
}

export function remainingAfterDebit(grams: number, debitGrams: number) {
  return debitStock(grams, debitGrams);
}

/** Choose the higher WCAG contrast for text on the exact filament color. */
export function filamentTextColor(hex: string) {
  const match = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!match) return "#ffffff";
  const channels = [0, 2, 4].map((offset) => {
    const value = parseInt(match[1]!.slice(offset, offset + 2), 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  const luminance = channels[0]! * 0.2126 + channels[1]! * 0.7152 + channels[2]! * 0.0722;
  const blackContrast = (luminance + 0.05) / 0.05;
  const whiteContrast = 1.05 / (luminance + 0.05);
  return blackContrast >= whiteContrast ? "#000000" : "#ffffff";
}
