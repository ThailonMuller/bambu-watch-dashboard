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

export type FilamentWeightFilter = "all" | "under250" | "250to499" | "500to999" | "1000plus";
export type FilamentSortDirection = "all" | "asc" | "desc";

export type FilamentStockFilters = {
  name: FilamentSortDirection;
  color: FilamentSortDirection;
  material: string;
  weight: FilamentWeightFilter;
  manufacturer: string;
};

export type FilamentFilterable = {
  name: string;
  color: string;
  material: string;
  grams: number;
  manufacturer?: string | null;
};

const normalizeFilterValue = (value: string | null | undefined) => (value ?? "").trim().toLocaleLowerCase("pt-BR");

export function filterFilaments<T extends FilamentFilterable>(items: T[], filters: FilamentStockFilters) {
  const filtered = items.filter((item) => {
    if (filters.material !== "all" && normalizeFilterValue(item.material) !== normalizeFilterValue(filters.material)) return false;
    if (filters.manufacturer === "__none__" && normalizeFilterValue(item.manufacturer)) return false;
    if (filters.manufacturer !== "all" && filters.manufacturer !== "__none__" && normalizeFilterValue(item.manufacturer) !== normalizeFilterValue(filters.manufacturer)) return false;

    switch (filters.weight) {
      case "under250":
        if (item.grams >= 250) return false;
        break;
      case "250to499":
        if (item.grams < 250 || item.grams >= 500) return false;
        break;
      case "500to999":
        if (item.grams < 500 || item.grams >= 1000) return false;
        break;
      case "1000plus":
        if (item.grams < 1000) return false;
        break;
    }
    return true;
  });
  const collator = new Intl.Collator("pt-BR", { numeric: true, sensitivity: "base" });
  if (filters.name !== "all") {
    const direction = filters.name === "desc" ? -1 : 1;
    return filtered.sort((a, b) => direction * collator.compare(a.name.trim(), b.name.trim()));
  }
  if (filters.color !== "all") {
    const direction = filters.color === "desc" ? -1 : 1;
    return filtered.sort((a, b) => direction * compareFilamentColors(a.color, b.color) || collator.compare(a.name.trim(), b.name.trim()));
  }
  return filtered;
}

const colorToneOrder = ["Vermelhos", "Laranjas", "Amarelos", "Verdes", "Cianos", "Azuis", "Violetas", "Magentas", "Rosas", "Neutros"];

function filamentHsl(hex: string) {
  const match = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!match) return null;
  const [r, g, b] = [0, 2, 4].map((offset) => parseInt(match[1]!.slice(offset, offset + 2), 16) / 255) as [number, number, number];
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  const lightness = (max + min) / 2;
  const saturation = delta === 0 ? 0 : delta / (1 - Math.abs(2 * lightness - 1));

  let hue = 0;
  if (delta !== 0) {
    if (max === r) hue = ((g - b) / delta + (g < b ? 6 : 0)) * 60;
    else if (max === g) hue = ((b - r) / delta + 2) * 60;
    else hue = ((r - g) / delta + 4) * 60;
  }
  return { hue, saturation, lightness };
}

/** Spectral hue order, followed by neutral shades from black to white. */
export function compareFilamentColors(a: string, b: string) {
  const key = (hex: string) => {
    const hsl = filamentHsl(hex);
    if (!hsl) return [1, Infinity, 0, 0];
    if (hsl.saturation < 0.14) return [1, hsl.lightness, 0, 0];
    return [0, hsl.hue, hsl.lightness, hsl.saturation];
  };
  const aKey = key(a);
  const bKey = key(b);
  for (let index = 0; index < aKey.length; index++) {
    if (aKey[index] === bKey[index]) continue;
    return aKey[index]! < bKey[index]! ? -1 : 1;
  }
  return 0;
}

export function filamentColorTone(hex: string) {
  const hsl = filamentHsl(hex);
  if (!hsl || hsl.saturation < 0.14) return "Neutros";
  const { hue } = hsl;
  if (hue < 15 || hue >= 345) return "Vermelhos";
  if (hue < 45) return "Laranjas";
  if (hue < 70) return "Amarelos";
  if (hue < 160) return "Verdes";
  if (hue < 195) return "Cianos";
  if (hue < 255) return "Azuis";
  if (hue < 285) return "Violetas";
  if (hue < 325) return "Magentas";
  return "Rosas";
}

export function groupFilamentsByTone<T extends { color: string }>(items: T[], direction: FilamentSortDirection = "all") {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const tone = filamentColorTone(item.color);
    const group = groups.get(tone) ?? [];
    group.push(item);
    groups.set(tone, group);
  }
  const entries: [string, T[]][] = [];
  groups.forEach((group, tone) => entries.push([tone, group]));
  const order = direction === "desc" ? -1 : 1;
  return entries.sort(([toneA], [toneB]) => order * (colorToneOrder.indexOf(toneA) - colorToneOrder.indexOf(toneB)));
}
