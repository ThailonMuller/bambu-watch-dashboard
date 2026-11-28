import React from "react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import postcss, { type AtRule, type Declaration, type Rule } from "postcss";
import { describe, expect, it } from "vitest";
import FilamentSpoolSelect from "../client/src/components/FilamentSpoolSelect";

Object.assign(globalThis, { React });

const selectPath = resolve("client/src/components/FilamentSpoolSelect.tsx");
const homePath = resolve("client/src/pages/Home.tsx");
const selectSource = readFileSync(selectPath, "utf8");
const homeSource = readFileSync(homePath, "utf8");
const stylesheet = postcss.parse(readFileSync(resolve("client/src/index.css"), "utf8"));

type Spool = { id: number; name: string; grams: number; color: string };

const spools: Spool[] = [
  { id: 10, name: "PLA Preto", grams: 125, color: "#000000" },
  { id: 20, name: "PLA Branco", grams: 830, color: "#ffffff" },
];

function renderSelect(value: string) {
  return renderToStaticMarkup(
    React.createElement(FilamentSpoolSelect, {
      items: spools,
      value,
      onChange: () => undefined,
    })
  );
}

function trigger(markup: string) {
  return (
    markup.match(
      /<button\b(?=[^>]*\bclass="[^"]*\bdebit-spool-select\b)(?=[^>]*\baria-label="Selecionar bobina")[^>]*>/
    )?.[0] ?? ""
  );
}

function declarations(rule: Rule | undefined) {
  const values: Record<string, string> = {};
  rule?.walkDecls((declaration: Declaration) => {
    values[declaration.prop] = declaration.value;
  });
  return values;
}

function rulesWithSelector(selector: string) {
  const matches: Rule[] = [];
  stylesheet.walkRules(rule => {
    if (rule.selectors.includes(selector)) matches.push(rule);
  });
  return matches;
}

function mediaRulesMatching(marker: RegExp, selector: string) {
  const matches: Rule[] = [];
  stylesheet.walkAtRules("media", (atRule: AtRule) => {
    if (!marker.test(atRule.params)) return;
    atRule.walkRules(rule => {
      if (rule.selectors.includes(selector)) matches.push(rule);
    });
  });
  return matches;
}

describe("filament debit spool selection", () => {
  it("renders the selected spool name and its literal black or white edge color", () => {
    const blackTrigger = trigger(renderSelect("10"));
    const whiteTrigger = trigger(renderSelect("20"));

    expect(blackTrigger).toContain('aria-label="Selecionar bobina"');
    expect(blackTrigger).toContain("debit-spool-select");
    expect(blackTrigger).toMatch(/style="[^"]*border-left-color:\s*#000000/i);
    expect(renderSelect("10")).toContain("PLA Preto · 125 g");

    expect(whiteTrigger).toMatch(/style="[^"]*border-left-color:\s*#ffffff/i);
    expect(renderSelect("20")).toContain("PLA Branco · 830 g");
  });

  it("renders the no-selection prompt without applying a fallback black border", () => {
    const markup = renderSelect("");
    const button = trigger(markup);

    expect(button).toContain('aria-label="Selecionar bobina"');
    expect(button).toContain("debit-spool-select");
    expect(button).not.toMatch(/\bstyle=/);
    expect(markup).toContain("Selecionar bobina");
  });

  it("uses the existing Radix Select and maps its explicit no-spool item to an empty value", () => {
    expect(selectSource).toMatch(/from\s+["']\.\/ui\/select["']/);
    expect(selectSource).toMatch(/<Select\b/);
    expect(selectSource).toContain('value="__none__"');
    expect(selectSource).toMatch(/onValueChange=\{\s*next\s*=>\s*onChange\(next\s*===\s*"__none__"\s*\?\s*""\s*:\s*next\)/);
    expect(selectSource).toContain('className="debit-spool-option"');
    expect(selectSource).toContain('style={{ borderLeftColor: item.color }}');
    expect(selectSource).toContain('style={{ borderLeftColor: selected?.color }}');
    expect(selectSource).toMatch(/type SpoolOption\s*=\s*\{\s*id:\s*number;\s*name:\s*string;\s*grams:\s*number;\s*color:\s*string\s*;?\s*\}/);
  });

  it("synchronizes debit color with spool identity and color edits, while preserving the mismatch guard and reset value", () => {
    expect(homeSource).toMatch(/import\s+FilamentSpoolSelect\s+from\s+["'][^"']*FilamentSpoolSelect["']/);
    expect(homeSource).toMatch(/const\s+\[newDebit,\s*setNewDebit\]\s*=\s*useState\(\s*\{[^}]*\bcolor:\s*""/);
    expect(homeSource).toMatch(/const selectedDebitFilament\s*=\s*filaments\.find\(\s*\(?item\)?\s*=>\s*String\(item\.id\)\s*===\s*newDebit\.filamentId\s*\)/);

    const selector = homeSource.match(/<FilamentSpoolSelect\b[\s\S]*?\/>/)?.[0] ?? "";
    expect(selector).not.toBe("");
    expect(selector).toMatch(/\bitems=\{filaments\}/);
    expect(selector).toMatch(/\bvalue=\{newDebit\.filamentId\}/);
    expect(selector).toMatch(/onChange=\{\s*\(filamentId\)\s*=>/);
    expect(selector).toMatch(/filaments\.find\(\s*\(?item\)?\s*=>\s*String\(item\.id\)\s*===\s*filamentId\s*\)\?\.color\s*\?\?\s*""/);
    expect(selector).toMatch(/setNewDebit\(\s*\(current\)\s*=>\s*\(\{\s*\.\.\.current,\s*filamentId,/);

    expect(homeSource).toMatch(/useEffect\(\(\)\s*=>\s*\{\s*setNewDebit\(\s*\(current\)\s*=>\s*\(\{\s*\.\.\.current,\s*color:\s*selectedDebitFilament\?\.color\s*\?\?\s*""\s*\}\)\);\s*setDebitColorError\(""\);\s*\},\s*\[\s*selectedDebitFilament\?\.id\s*,\s*selectedDebitFilament\?\.color\s*\]\s*\)/);

    expect(homeSource).toMatch(/<RequiredFilamentColor\b(?=[^>]*\bcompact\b)(?=[^>]*\bvalue=\{newDebit\.color\})(?=[^>]*\binvalid=\{Boolean\(debitColorError\)\})/s);
    expect(homeSource).toContain('setNewDebit({ piece: "", grams: "", color: selectedDebitFilament.color, filamentId: newDebit.filamentId });');

    const debitStart = homeSource.indexOf("const addDebit =");
    const debitEnd = homeSource.indexOf("const updateFilament", debitStart);
    const addDebit = homeSource.slice(debitStart, debitEnd);
    expect(addDebit).toContain('newDebit.color.toLowerCase() !== selectedDebitFilament.color.toLowerCase()');
    expect(addDebit).toContain("color: newDebit.color");
  });

  it("styles trigger and options with color-matched left borders, rounded corners and unchanged mobile height", () => {
    const triggerRule = rulesWithSelector(".debit-spool-select").find(rule => {
      const style = declarations(rule);
      return style["border-left"]?.startsWith("5px solid") ?? false;
    });
    const optionRule = rulesWithSelector(".debit-spool-option").find(rule => {
      const style = declarations(rule);
      return style["border-left"]?.startsWith("4px solid") ?? false;
    });

    expect(triggerRule).toBeDefined();
    expect(declarations(triggerRule)).toMatchObject({
      "border-left": expect.stringMatching(/^5px\s+solid\b/i),
      "border-radius": "9px",
      height: "39px",
      "min-height": "39px",
    });
    expect(optionRule).toBeDefined();
    expect(declarations(optionRule)).toMatchObject({
      "border-left": expect.stringMatching(/^4px\s+solid\b/i),
      "border-radius": "6px",
    });

    const mobileRules = mediaRulesMatching(/max-width\s*:\s*600px/i, ".debit-spool-select");
    expect(mobileRules.length).toBeGreaterThan(0);
    expect(
      mobileRules.some(rule => {
        const style = declarations(rule);
        return Object.hasOwn(style, "height") || Object.hasOwn(style, "min-height");
      })
    ).toBe(false);
  });

  it("keeps spool and action full-width on mobile with color and grams in separate usable columns", () => {
    const gridRules = mediaRulesMatching(/max-width\s*:\s*600px/i, ".debit-add-controls");
    expect(declarations(gridRules.at(-1))["grid-template-columns"]).toBe("39px minmax(0,1fr)");
    const spoolRules = mediaRulesMatching(/max-width\s*:\s*600px/i, ".debit-add-controls .debit-spool-select");
    expect(declarations(spoolRules.at(-1))["grid-column"]).toBe("1 / -1");
    const actionRules = mediaRulesMatching(/max-width\s*:\s*600px/i, ".debit-add-controls .filament-primary-button");
    expect(declarations(actionRules.at(-1))).toMatchObject({ "grid-column": "1 / -1", width: "100%" });
  });
});
