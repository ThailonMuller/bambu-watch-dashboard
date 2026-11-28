import { describe, expect, it } from "vitest";
import {
  filterFilaments,
  filamentColorTone,
  groupFilamentsByTone,
  type FilamentStockFilters,
} from "../shared/filament";

const items = [
  { id: 1, name: "PLA Silk Violeta", material: "PLA", color: "#9b4dff", grams: 249, manufacturer: "Voolt" },
  { id: 2, name: "PLA Ciano", material: "PLA", color: "#00d8f5", grams: 250, manufacturer: "Bambu Lab" },
  { id: 3, name: "PETG Magenta", material: "PETG", color: "#e600a9", grams: 500, manufacturer: "Voolt" },
  { id: 4, name: "ABS Preto", material: "ABS", color: "#111111", grams: 1000, manufacturer: "" },
];

const allFilters = (): FilamentStockFilters => ({
  name: "all",
  color: "all",
  material: "all",
  weight: "all",
  manufacturer: "all",
});

describe("filament stock filters", () => {
  it("starts with Todos and returns every spool when no filter is chosen", () => {
    expect(filterFilaments(items, allFilters())).toEqual(items);
  });

  it("uses name and color values as sort directions rather than exact-value filters", () => {
    expect(filterFilaments(items, { ...allFilters(), name: "asc" })).toHaveLength(items.length);
    expect(filterFilaments(items, { ...allFilters(), color: "desc" })).toHaveLength(items.length);
  });

  it("filters by material and manufacturer without case sensitivity", () => {
    expect(filterFilaments(items, { ...allFilters(), material: "petg" }).map(item => item.id)).toEqual([3]);
    expect(filterFilaments(items, { ...allFilters(), manufacturer: "voolt" }).map(item => item.id)).toEqual([1, 3]);
    expect(filterFilaments(items, { ...allFilters(), manufacturer: "__none__" }).map(item => item.id)).toEqual([4]);
  });

  it("filters weight into non-overlapping gram ranges", () => {
    expect(filterFilaments(items, { ...allFilters(), weight: "under250" }).map(item => item.id)).toEqual([1]);
    expect(filterFilaments(items, { ...allFilters(), weight: "250to499" }).map(item => item.id)).toEqual([2]);
    expect(filterFilaments(items, { ...allFilters(), weight: "500to999" }).map(item => item.id)).toEqual([3]);
    expect(filterFilaments(items, { ...allFilters(), weight: "1000plus" }).map(item => item.id)).toEqual([4]);
  });

  it("groups similar shades by hue family in the existing family order", () => {
    expect(filamentColorTone("#9b4dff")).toBe("Violetas");
    expect(filamentColorTone("#7541c8")).toBe("Violetas");
    expect(filamentColorTone("#00d8f5")).toBe("Cianos");
    expect(filamentColorTone("#111111")).toBe("Neutros");
    expect(groupFilamentsByTone(items).map(([tone, group]) => [tone, group.map(item => item.id)])).toEqual([
      ["Cianos", [2]],
      ["Violetas", [1]],
      ["Magentas", [3]],
      ["Neutros", [4]],
    ]);
  });
});
