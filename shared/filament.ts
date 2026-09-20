export function isLowStock(grams: number, lowThreshold: number) {
  return grams <= lowThreshold;
}

export function debitStock(grams: number, debitGrams: number) {
  return Math.max(0, grams - Math.max(0, debitGrams));
}
