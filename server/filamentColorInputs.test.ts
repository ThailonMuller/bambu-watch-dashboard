import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import postcss from "postcss";
import { describe, expect, it } from "vitest";

const home = readFileSync(resolve("client/src/pages/Home.tsx"), "utf8");
const spoolCard = readFileSync(
  resolve("client/src/components/FilamentSpoolCard.tsx"),
  "utf8"
);
const stylesheet = postcss.parse(
  readFileSync(resolve("client/src/index.css"), "utf8")
);

function colorInputs(source: string) {
  return source.match(/<input\b(?=[^>]*\btype="color")[^>]*>/g) ?? [];
}

function ruleFor(selector: string) {
  let found: postcss.Rule | undefined;
  stylesheet.walkRules((rule) => {
    if (rule.selectors.includes(selector)) found = rule;
  });
  return found;
}

function declarations(selector: string) {
  const rule = ruleFor(selector);
  const values: Record<string, string> = {};
  rule?.walkDecls((declaration) => {
    values[declaration.prop] = declaration.value.replace(/\s+/g, "");
  });
  return values;
}

describe("filament color inputs", () => {
  it("applies the shared class to exactly the three color inputs", () => {
    expect(colorInputs(home)).toHaveLength(2);
    expect(colorInputs(spoolCard)).toHaveLength(1);

    const allInputs = [...colorInputs(home), ...colorInputs(spoolCard)];
    expect(allInputs).toHaveLength(3);
    expect(allInputs.every((input) => /className="[^"}]*filament-color-input/.test(input))).toBe(true);
    expect(home).toMatch(
      /className="filament-color-input"\s+type="color"\s+style=\{\{\s*backgroundColor:\s*newFilament\.color\s*\}\}/
    );
    expect(home).toMatch(
      /className="debit-color filament-color-input"\s+type="color"\s+style=\{\{\s*backgroundColor:\s*newDebit\.color\s*\}\}/
    );
    expect(spoolCard).toMatch(
      /className="filament-color-input"\s+type="color"\s+style=\{\{\s*backgroundColor:\s*draft\.color\s*\}\}/
    );
  });

  it("keeps each color input value and onChange backed by its existing state", () => {
    expect(home).toMatch(
      /backgroundColor:\s*newFilament\.color[\s\S]*?value=\{newFilament\.color\}[\s\S]*?onChange=\{\(event\)\s*=>\s*setNewFilament\(\s*(?:\(current\)|current)\s*=>\s*\(\{\s*\.\.\.current,\s*color:\s*event\.target\.value/
    );
    expect(home).toMatch(
      /backgroundColor:\s*newDebit\.color[\s\S]*?value=\{newDebit\.color\}[\s\S]*?onChange=\{\(event\)\s*=>\s*setNewDebit\(\s*(?:\(current\)|current)\s*=>\s*\(\{\s*\.\.\.current,\s*color:\s*event\.target\.value/
    );
    expect(spoolCard).toMatch(
      /backgroundColor:\s*draft\.color[\s\S]*?value=\{draft\.color\}[\s\S]*?onChange=\{\s*event\s*=>\s*setDraft\(\s*(?:\(current\)|current)\s*=>\s*\(\{\s*\.\.\.current,\s*color:\s*event\.target\.value/
    );
  });

  it("defines the shared rounded swatch treatment for all three contexts", () => {
    const sharedSelectors = [
      '.filament-color-input[type="color"]',
      '.filament-detail-color-control .filament-color-input[type="color"]',
      '.debit-add-controls .filament-color-input[type="color"]',
    ];
    const sharedRule = stylesheet.nodes.find(
      (node): node is postcss.Rule =>
        node.type === "rule" && sharedSelectors.every((selector) => node.selectors.includes(selector))
    );
    expect(sharedRule).toBeDefined();
    expect(declarations(sharedSelectors[0])).toMatchObject({
      padding: "0",
      overflow: "hidden",
      "box-sizing": "border-box",
      "border-radius": "9px",
      appearance: "none",
      "-webkit-appearance": "none",
      cursor: "pointer",
    });
    expect(ruleFor('.filament-color-input[type="color"]::-webkit-color-swatch-wrapper')).toBeDefined();
    expect(declarations('.filament-color-input[type="color"]::-webkit-color-swatch-wrapper')).toMatchObject({ padding: "0" });
    expect(declarations('.filament-color-input[type="color"]::-webkit-color-swatch')).toMatchObject({ border: "0", "border-radius": "8px" });
    expect(declarations('.filament-color-input[type="color"]::-moz-color-swatch')).toMatchObject({ border: "0", "border-radius": "8px" });
  });

  it("keeps a visible cyan focus ring with the requested offset", () => {
    expect(declarations('.filament-color-input[type="color"]:focus-visible')).toMatchObject({
      outline: "3pxsolid#12d7ed",
      "outline-offset": "3px",
    });
  });
});
