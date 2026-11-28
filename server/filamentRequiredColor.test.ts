import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import postcss from "postcss";
import { describe, expect, it, vi } from "vitest";
import RequiredFilamentColor from "../client/src/components/RequiredFilamentColor";

Object.assign(globalThis, { React });

const componentPath = resolve("client/src/components/RequiredFilamentColor.tsx");
const homePath = resolve("client/src/pages/Home.tsx");
const spoolCardPath = resolve("client/src/components/FilamentSpoolCard.tsx");
const componentSource = readFileSync(componentPath, "utf8");
const homeSource = readFileSync(homePath, "utf8");
const spoolCardSource = readFileSync(spoolCardPath, "utf8");
const stylesheet = postcss.parse(readFileSync(resolve("client/src/index.css"), "utf8"));

function triggerButton(markup: string) {
  return markup.match(
    /<button\b(?=[^>]*\bclass="filament-color-trigger\b)[^>]*>/
  )?.[0] ?? "";
}

function rulesMatching(selectorPart: string) {
  const found: postcss.Rule[] = [];
  stylesheet.walkRules(rule => {
    if (rule.selectors.some(selector => selector.includes(selectorPart))) {
      found.push(rule);
    }
  });
  return found;
}

function declarations(rule: postcss.Rule | undefined) {
  const values: Record<string, string> = {};
  rule?.walkDecls(declaration => {
    values[declaration.prop] = declaration.value;
  });
  return values;
}

describe("required filament color", () => {
  it("renders an empty required trigger with a selection prompt and no filled swatch", () => {
    const html = renderToStaticMarkup(
      React.createElement(RequiredFilamentColor, {
        value: "",
        onChange: vi.fn(),
      })
    );
    const button = triggerButton(html);

    expect(button).toContain('class="filament-color-trigger is-empty"');
    expect(button).toContain('aria-required="true"');
    expect(button).not.toMatch(/\bstyle=/);
    expect(button).not.toContain("background-color");
    expect(html).toContain(">Selecionar</code>");
  });

  it("renders an existing color on the trigger and exposes invalid state accessibly", () => {
    const html = renderToStaticMarkup(
      React.createElement(RequiredFilamentColor, {
        value: "#0a1b2c",
        invalid: true,
        onChange: vi.fn(),
      })
    );
    const button = triggerButton(html);

    expect(button).toMatch(/style="[^"]*background-color:\s*#0a1b2c/i);
    expect(button).toContain('aria-required="true"');
    expect(button).toContain('aria-invalid="true"');
    expect(html).toContain(">#0A1B2C</code>");
  });

  it("keeps a separate controlled draft and applies it only on confirmation", () => {
    expect(componentSource).toMatch(
      /const \[draftColor,\s*setDraftColor\] = useState\(value \|\| "#000000"\)/
    );
    expect(componentSource).toMatch(
      /if\s*\(next\)\s*\{\s*const initialColor = value \|\| "#000000";\s*setDraftColor\(initialColor\);\s*setDraftHex\(initialColor\.toUpperCase\(\)\)/
    );
    expect(componentSource).toContain("onOpenChange={changeOpen}");
    expect(componentSource).toMatch(
      /<input\b(?=[^>]*\btype="color")(?=[^>]*\bclassName="filament-color-input")[^>]*\bvalue=\{draftColor\}[^>]*style=\{\{\s*backgroundColor:\s*draftColor\s*\}\}/s
    );
    expect(componentSource).toContain('aria-label="Código HEX da cor"');
    expect(componentSource).toContain('placeholder="#RRGGBB"');
    expect(componentSource).toContain('normalizeHexColor(nextHex)');
    expect(componentSource).toContain('disabled={!confirmedHex}');
    expect(componentSource).toContain("onChange(confirmedHex)");
    expect(componentSource).toContain("setDraftHex(nextColor.toUpperCase())");
    expect(componentSource).toMatch(
      /onClick=\{\(\)\s*=>\s*setOpen\(false\)\}[^>]*>\s*Cancelar/
    );
    expect(componentSource).toMatch(
      /onClick=\{\(\)\s*=>\s*\{\s*if\s*\(!confirmedHex\)\s*return;\s*onChange\(confirmedHex\);\s*setOpen\(false\);\s*\}\}[\s\S]*?>\s*Confirmar cor/
    );

    const openHandlerStart = componentSource.indexOf("const changeOpen");
    const renderStart = componentSource.indexOf("return (", openHandlerStart);
    const openHandler = componentSource.slice(openHandlerStart, renderStart);
    expect(openHandler).not.toMatch(/onChange\s*\(/);
  });

  it("requires an explicit color in registration, debit and spool editing", () => {
    expect(homeSource).toMatch(
      /const \[newFilament,\s*setNewFilament\] = useState\(\s*\{[^}]*\bcolor:\s*""/
    );
    expect(homeSource).toMatch(
      /setNewFilament\(\s*\{\s*name:\s*""\s*,\s*material:\s*"PLA"\s*,\s*manufacturer:\s*""\s*,\s*color:\s*""/
    );
    expect(homeSource).toMatch(
      /const \[filamentColorError,\s*setFilamentColorError\] = useState(?:<boolean>)?\(false\)/
    );
    expect(homeSource.match(/<RequiredFilamentColor\b/g)).toHaveLength(2);
    expect(homeSource).toMatch(
      /<RequiredFilamentColor\b(?=[^>]*\bvalue=\{newFilament\.color\})(?=[^>]*\binvalid=\{filamentColorError\})/
    );

    const addStart = homeSource.indexOf("const addFilament =");
    const debitStart = homeSource.indexOf("const addDebit =", addStart);
    const debitEnd = homeSource.indexOf("const updateFilament", debitStart);
    const addFilament = homeSource.slice(addStart, debitStart);
    const addDebit = homeSource.slice(debitStart, debitEnd);
    const colorGuard = addFilament.search(/\/\^#\[0-9a-f\]\{6\}\$\/i\.test\(newFilament\.color\)/);
    const stockWrite = addFilament.indexOf("setFilaments(");
    expect(colorGuard).toBeGreaterThanOrEqual(0);
    expect(addFilament).toContain(
      'toast.error("Selecione a cor da bobina antes de adicionar ao estoque")'
    );
    expect(colorGuard).toBeLessThan(stockWrite);
    expect(addFilament).toMatch(/color:\s*newFilament\.color/);

    expect(homeSource).toMatch(/const \[newDebit,\s*setNewDebit\] = useState\(\s*\{[^}]*\bcolor:\s*""/);
    expect(homeSource).toContain('setNewDebit({ piece: "", grams: "", color: selectedDebitFilament.color, filamentId: newDebit.filamentId });');
    expect(homeSource).toMatch(/<RequiredFilamentColor compact label="Selecionar cor do débito"[^>]*value=\{newDebit\.color\}[^>]*invalid=\{Boolean\(debitColorError\)\}/);
    expect(addDebit).toMatch(/\/\^#\[0-9a-f\]\{6\}\$\/i\.test\(newDebit\.color\)/);
    expect(addDebit).toContain('newDebit.color.toLowerCase() !== selectedDebitFilament.color.toLowerCase()');
    expect(addDebit).toContain('color: newDebit.color');
    expect(addDebit).toContain('setDebitColorError("Selecione a cor do débito.")');

    expect(spoolCardSource).toMatch(/setDraft\(\{ \.\.\.draftFrom\(item\), color: "" \}\)/);
    expect(spoolCardSource).toContain('<RequiredFilamentColor');
    expect(spoolCardSource).toContain('invalid={colorError}');
    expect(spoolCardSource).toMatch(/\/\^#\[0-9a-f\]\{6\}\$\/i\.test\(draft\.color\)/);
    expect(spoolCardSource).toMatch(/color:\s*draft\.color/);
    expect(homeSource).toMatch(/<FilamentSpoolCard[\s\S]*?item=\{item\}[\s\S]*?onSave=\{updateFilament\}/);
    expect(homeSource).toContain("color: linked?.color ?? debit.color");
  });

  it("keeps the low-stock pill outside the surface without low-only padding", () => {
    const ribbonIndex = spoolCardSource.indexOf('className="filament-card-low-ribbon"');
    const surfaceIndex = spoolCardSource.indexOf('className="filament-card-surface"');
    expect(ribbonIndex).toBeGreaterThanOrEqual(0);
    expect(surfaceIndex).toBeGreaterThan(ribbonIndex);

    const lowSurfacePadding = rulesMatching(".filament-spool-card.is-low").some(rule =>
      rule.selectors.some(selector => selector.includes(".filament-card-surface")) &&
      rule.nodes?.some(
        node =>
          node.type === "decl" &&
          (node.prop === "padding" || node.prop === "padding-top")
      )
    );
    expect(lowSurfacePadding).toBe(false);

    const ribbonRule = rulesMatching(".filament-card-low-ribbon").find(
      rule => declarations(rule).position === "absolute"
    );
    expect(declarations(ribbonRule)).toMatchObject({
      position: "absolute",
      top: "-10px",
      left: "50%",
      width: "max-content",
      "border-radius": "999px",
    });
    expect(rulesMatching(".filament-spool-card:focus-visible .filament-card-low-ribbon")).not.toHaveLength(0);
    expect(rulesMatching(".filament-spool-card:hover .filament-card-low-ribbon")).not.toHaveLength(0);
  });
});
