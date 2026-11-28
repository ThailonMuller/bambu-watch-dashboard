import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  compareFilamentColors,
  filterFilaments,
  groupFilamentsByTone,
  type FilamentFilterable,
  type FilamentStockFilters,
} from "../shared/filament";

type TestSpool = FilamentFilterable & { id: number };

const spool = (
  id: number,
  name: string,
  color = "#ff0000",
  material = "PLA",
  grams = 500,
  manufacturer = "Bambu Lab",
): TestSpool => ({ id, name, color, material, grams, manufacturer });

const allFilters = (): FilamentStockFilters => ({
  name: "all",
  color: "all",
  material: "all",
  weight: "all",
  manufacturer: "all",
});

const home = readFileSync(resolve("client/src/pages/Home.tsx"), "utf8");

describe("filament sorting", () => {
  it("sorts names with pt-BR accent-insensitive collation and natural numeric order", () => {
    const items = [
      spool(1, "PLA 10"),
      spool(2, " Água 2 "),
      spool(3, "água 10"),
      spool(4, "Açaí"),
      spool(5, "acai"),
      spool(6, "PLA 2"),
      spool(7, "abacaxi 1"),
    ];

    expect(filterFilaments(items, { ...allFilters(), name: "asc" }).map(item => item.id)).toEqual([7, 4, 5, 2, 3, 6, 1]);
    expect(filterFilaments(items, { ...allFilters(), name: "desc" }).map(item => item.id)).toEqual([1, 6, 3, 2, 4, 5, 7]);
  });

  it("sorts chromatic colors in increasing hue order and reverses the order for desc", () => {
    const items = [
      spool(1, "Azul", "#0000ff"),
      spool(2, "Magenta", "#ff00ff"),
      spool(3, "Vermelho", "#ff0000"),
      spool(4, "Ciano", "#00ffff"),
      spool(5, "Violeta", "#8000ff"),
      spool(6, "Verde", "#00ff00"),
      spool(7, "Amarelo", "#ffff00"),
      spool(8, "Laranja", "#ff8000"),
    ];

    expect(filterFilaments(items, { ...allFilters(), color: "asc" }).map(item => item.id)).toEqual([3, 8, 7, 6, 4, 1, 5, 2]);
    expect(filterFilaments(items, { ...allFilters(), color: "desc" }).map(item => item.id)).toEqual([2, 5, 1, 4, 6, 7, 8, 3]);
  });

  it("places neutrals after chromatic colors from black through gray to white", () => {
    const items = [
      spool(1, "Branco", "#ffffff"),
      spool(2, "Preto", "#000000"),
      spool(3, "Azul", "#0000ff"),
      spool(4, "Cinza", "#808080"),
    ];

    expect(filterFilaments(items, { ...allFilters(), color: "asc" }).map(item => item.id)).toEqual([3, 2, 4, 1]);
    expect(filterFilaments(items, { ...allFilters(), color: "desc" }).map(item => item.id)).toEqual([1, 4, 2, 3]);
  });

  it("uses natural Portuguese name order as the color tie-breaker in either direction", () => {
    const items = [
      spool(1, "PLA 10", "#ff0000"),
      spool(2, "PLA 2", "#ff0000"),
    ];

    expect(filterFilaments(items, { ...allFilters(), color: "asc" }).map(item => item.id)).toEqual([2, 1]);
    expect(filterFilaments(items, { ...allFilters(), color: "desc" }).map(item => item.id)).toEqual([2, 1]);
  });

  it("applies material, weight, and manufacturer filters before sorting the remaining spools", () => {
    const items = [
      spool(1, "Água 10", "#0000ff", "PLA", 300, "Bambu Lab"),
      spool(2, "Água 2", "#ff0000", "PLA", 450, "bambu lab"),
      spool(3, "Zeta", "#000000", "PLA", 450, "Other"),
      spool(4, "Bambu", "#ff0000", "PETG", 450, "Bambu Lab"),
      spool(5, "Delta", "#0000ff", "PLA", 240, "Bambu Lab"),
    ];
    const filters = {
      ...allFilters(),
      name: "asc" as const,
      material: " pla ",
      weight: "250to499" as const,
      manufacturer: "BAMBU LAB",
    };

    expect(filterFilaments(items, filters).map(item => item.id)).toEqual([2, 1]);
  });

  it("uses name sorting when both sort directions are provided and leaves all-order stable", () => {
    const items = [
      spool(1, "PLA 10", "#0000ff"),
      spool(2, "PLA 2", "#ff0000"),
      spool(3, "PLA 1", "#00ff00"),
    ];
    const original = items.map(item => ({ ...item }));
    const allResult = filterFilaments(items, allFilters());

    expect(allResult).not.toBe(items);
    expect(allResult.map(item => item.id)).toEqual([1, 2, 3]);
    expect(items).toEqual(original);
    expect(filterFilaments(items, { ...allFilters(), name: "desc", color: "asc" }).map(item => item.id)).toEqual([1, 2, 3]);
  });

  it("sorts a new array without mutating any source spool or its insertion order", () => {
    const items = [spool(1, "Zeta", "#0000ff"), spool(2, "Alfa", "#ff0000")];
    const original = items.map(item => ({ ...item }));
    items.forEach(item => Object.freeze(item));
    Object.freeze(items);
    for (const direction of ["asc", "desc"] as const) {
      expect(() => filterFilaments(items, { ...allFilters(), name: direction })).not.toThrow();
      expect(() => filterFilaments(items, { ...allFilters(), color: direction })).not.toThrow();
    }
    expect(items).toEqual(original);
  });

  it("reverses tone-family group order for desc while retaining source order inside groups", () => {
    const items = [
      spool(1, "Magenta 1", "#e600a9"),
      spool(2, "Ciano 1", "#00d8f5"),
      spool(3, "Vermelho 1", "#ff0000"),
      spool(4, "Rosa", "#ff69b4"),
      spool(5, "Neutro", "#222222"),
      spool(6, "Ciano 2", "#00ffff"),
      spool(7, "Vermelho 2", "#ff0000"),
    ];
    const ascending = groupFilamentsByTone(items, "all");
    const descending = groupFilamentsByTone(items, "desc");

    expect(ascending.map(([tone]) => tone)).toEqual(["Vermelhos", "Cianos", "Magentas", "Rosas", "Neutros"]);
    expect(descending.map(([tone]) => tone)).toEqual(["Neutros", "Rosas", "Magentas", "Cianos", "Vermelhos"]);
    expect(ascending.map(([, group]) => group.map(item => item.id))).toEqual([[3, 7], [2, 6], [1], [4], [5]]);
    expect(descending.map(([, group]) => group.map(item => item.id))).toEqual([[5], [4], [1], [2, 6], [3, 7]]);
    expect(groupFilamentsByTone(items, "asc")).toEqual(ascending);
  });

  it("treats malformed colors as neutral values after valid colors without throwing", () => {
    const items = [
      spool(1, "Zulu inválida", "not-a-color"),
      spool(2, "Branco", "#ffffff"),
      spool(3, "Azul", "#0000ff"),
      spool(4, "Alpha inválida", "#zzzzzz"),
      spool(5, "Preto", "#000000"),
    ];

    expect(compareFilamentColors("#ffffff", "not-a-color")).toBeLessThan(0);
    expect(compareFilamentColors("not-a-color", "#ffffff")).toBeGreaterThan(0);
    expect(() => filterFilaments(items, { ...allFilters(), color: "asc" })).not.toThrow();
    expect(filterFilaments(items, { ...allFilters(), color: "asc" }).map(item => item.id)).toEqual([3, 5, 2, 4, 1]);
  });

  it("exposes exactly three sort options for name and color without dynamic HEX options", () => {
    const getSortSelect = (label: string) => {
      const match = home.match(new RegExp(`<select\\s+aria-label="${label}"[^>]*>([\\s\\S]*?)<\\/select>`));
      expect(match, `expected a select labelled ${label}`).not.toBeNull();
      const markup = match![1]!;
      const options = [...markup.matchAll(/<option\b[^>]*>([\s\S]*?)<\/option>/g)];
      return {
        markup,
        labels: options.map(option => option[1]!.trim()),
        values: options.map(option => option[0]!.match(/\bvalue="([^"]+)"/)?.[1]),
      };
    };
    const name = getSortSelect("Ordenar por nome");
    const color = getSortSelect("Ordenar por cor");

    expect(name.labels).toEqual(["Todos", "Crescente", "Decrescente"]);
    expect(name.values).toEqual(["all", "asc", "desc"]);
    expect(color.labels).toEqual(["Todos", "Crescente", "Decrescente"]);
    expect(color.values).toEqual(["all", "asc", "desc"]);
    for (const select of [name, color]) {
      expect(select.markup).not.toContain("#");
      expect(select.markup).not.toMatch(/\.map\s*\(/);
    }
    expect(home).not.toMatch(/\bfilamentNames\b|\bfilamentColors\b/);
    expect(home).toContain("filterFilaments(filaments, filamentFilters)");
    expect(home).toContain("groupFilamentsByTone(filteredFilaments, filamentFilters.color)");
    expect(home).toContain('title="Ordem alfabética: crescente de A a Z ou decrescente de Z a A"');
    expect(home).toContain('color: name === "all" ? current.color : "all"');
    expect(home).toContain('name: color === "all" ? current.name : "all"');
  });
});
