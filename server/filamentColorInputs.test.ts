import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import postcss from "postcss";
import { describe, expect, it } from "vitest";

const home = readFileSync(resolve("client/src/pages/Home.tsx"), "utf8");
const spoolCard = readFileSync(resolve("client/src/components/FilamentSpoolCard.tsx"), "utf8");
const requiredColor = readFileSync(resolve("client/src/components/RequiredFilamentColor.tsx"), "utf8");
const stylesheet = postcss.parse(readFileSync(resolve("client/src/index.css"), "utf8"));

function colorInputs(source: string) {
  return source.match(/<input\b(?=[^>]*\btype="color")[^>]*>/g) ?? [];
}
function ruleFor(selector: string) {
  let found: postcss.Rule | undefined;
  stylesheet.walkRules(rule => { if (rule.selectors.includes(selector)) found = rule; });
  return found;
}
function declarations(selector: string) {
  const values: Record<string, string> = {};
  ruleFor(selector)?.walkDecls(declaration => { values[declaration.prop] = declaration.value.replace(/\s+/g, ""); });
  return values;
}

describe("filament color inputs", () => {
  it("applies the same treatment to debit, editing and the explicit new-spool chooser", () => {
    const inputs = [...colorInputs(home), ...colorInputs(spoolCard), ...colorInputs(requiredColor)];
    expect(inputs).toHaveLength(3);
    expect(inputs.every(input => /className="[^"}]*filament-color-input/.test(input))).toBe(true);
    expect(home).toContain("<RequiredFilamentColor value={newFilament.color}");
    expect(requiredColor).toContain("backgroundColor: draftColor");
    expect(home).toContain("backgroundColor: newDebit.color");
    expect(spoolCard).toContain("backgroundColor: draft.color");
  });

  it("preserves controlled color values and explicitly confirms only the new-spool draft", () => {
    expect(home).toMatch(/value=\{newDebit\.color\}[\s\S]*?onChange=\{\(event\)[\s\S]*?color: event\.target\.value/);
    expect(spoolCard).toMatch(/value=\{draft\.color\}[\s\S]*?onChange=\{event[\s\S]*?color: event\.target\.value/);
    expect(requiredColor).toContain("value={draftColor}");
    expect(requiredColor).toContain("setDraftColor(event.target.value)");
    expect(requiredColor).toContain("onChange(draftColor)");
    expect(requiredColor).toContain("Confirmar cor");
  });

  it("defines the shared full-bleed rounded swatch treatment", () => {
    const selectors = [
      '.filament-color-input[type="color"]',
      '.filament-detail-color-control .filament-color-input[type="color"]',
      '.debit-add-controls .filament-color-input[type="color"]',
    ];
    expect(stylesheet.nodes.some(node => node.type === "rule" && selectors.every(selector => node.selectors.includes(selector)))).toBe(true);
    expect(declarations(selectors[0])).toMatchObject({ padding: "0", overflow: "hidden", "box-sizing": "border-box", "border-radius": "9px", appearance: "none", "-webkit-appearance": "none", cursor: "pointer" });
    expect(declarations('.filament-color-input[type="color"]::-webkit-color-swatch-wrapper')).toMatchObject({ padding: "0" });
    expect(declarations('.filament-color-input[type="color"]::-webkit-color-swatch')).toMatchObject({ border: "0", "border-radius": "8px" });
    expect(declarations('.filament-color-input[type="color"]::-moz-color-swatch')).toMatchObject({ border: "0", "border-radius": "8px" });
  });

  it("keeps the cyan keyboard focus ring", () => {
    expect(declarations('.filament-color-input[type="color"]:focus-visible')).toMatchObject({ outline: "3pxsolid#12d7ed", "outline-offset": "3px" });
  });
});
