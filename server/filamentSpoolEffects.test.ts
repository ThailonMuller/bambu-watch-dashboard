import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import FilamentSpoolCard from "../client/src/components/FilamentSpoolCard";

Object.assign(globalThis, { React });

const cardSource = readFileSync(
  resolve("client/src/components/FilamentSpoolCard.tsx"),
  "utf8"
);
const stylesheet = readFileSync(resolve("client/src/index.css"), "utf8");

type MarkupElement = {
  tag: string;
  attributes: Record<string, string>;
  children: MarkupElement[];
};

type CssRule = { selector: string; body: string };

const baseItem = {
  id: 7,
  name: "PLA violeta",
  material: "PLA",
  color: "#8f77f4",
  grams: 100,
  lowThreshold: 200,
};

function renderCard(grams: number) {
  return renderToStaticMarkup(
    React.createElement(FilamentSpoolCard, {
      item: { ...baseItem, grams },
      relatedDebits: [],
      relatedHistory: [],
      onSave: () => undefined,
    })
  );
}

function parseMarkup(markup: string): MarkupElement {
  const root: MarkupElement = { tag: "#root", attributes: {}, children: [] };
  const stack = [root];
  const tokens = markup.match(/<!--[\s\S]*?-->|<\/?[^>]+>|[^<]+/g) ?? [];

  for (const token of tokens) {
    if (token.startsWith("<!--")) continue;

    if (token.startsWith("</")) {
      const tag = token.match(/^<\/\s*([^\s>]+)/)?.[1]?.toLowerCase();
      if (!tag) continue;
      while (stack.length > 1 && stack[stack.length - 1].tag !== tag)
        stack.pop();
      if (stack.length > 1) stack.pop();
      continue;
    }

    if (!token.startsWith("<")) continue;
    const opening = token.match(/^<\s*([^\s/>]+)([\s\S]*?)\/?\s*>$/);
    if (!opening) continue;

    const tag = opening[1].toLowerCase();
    const attributeText = opening[2];
    const attributes: Record<string, string> = {};
    for (const match of attributeText.matchAll(/([^\s=/>]+)(?:="([^"]*)")?/g)) {
      attributes[match[1]] = match[2] ?? "";
    }

    const element: MarkupElement = { tag, attributes, children: [] };
    stack[stack.length - 1].children.push(element);
    const isVoid =
      /^(area|base|br|col|embed|hr|img|input|link|meta|param|source|track|wbr)$/.test(
        tag
      );
    if (!isVoid && !/\/>$/.test(token)) stack.push(element);
  }

  return root;
}

function descendants(element: MarkupElement): MarkupElement[] {
  return element.children.flatMap(child => [child, ...descendants(child)]);
}

function classes(element: MarkupElement) {
  return (element.attributes.class ?? "").split(/\s+/).filter(Boolean);
}

function cssRules(css: string): CssRule[] {
  const uncommented = css.replace(/\/\*[\s\S]*?\*\//g, "");
  return Array.from(uncommented.matchAll(/([^{}]+)\{([^{}]*)\}/g), match => ({
    selector: match[1].trim(),
    body: match[2].trim(),
  }));
}

function selectors(rule: CssRule) {
  return rule.selector.split(",").map(selector => selector.trim());
}

function rulesMatching(
  css: string,
  selectorMatches: (selector: string) => boolean
) {
  return cssRules(css).filter(rule => selectors(rule).some(selectorMatches));
}

function declaration(body: string, property: string, value: RegExp) {
  const propertyPattern = property.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = body.match(
    new RegExp(`(?:^|;)\\s*${propertyPattern}\\s*:\\s*([^;}]*)`, "i")
  );
  return match ? value.test(match[1].trim()) : false;
}

function blockForAtRule(css: string, marker: RegExp, startAt = 0) {
  const source = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const match = marker.exec(source.slice(startAt));
  if (!match) return null;

  const markerIndex = startAt + match.index;
  const opening = source.indexOf("{", markerIndex + match[0].length);
  if (opening < 0) return null;

  let depth = 0;
  for (let index = opening; index < source.length; index += 1) {
    if (source[index] === "{") depth += 1;
    if (source[index] === "}") depth -= 1;
    if (depth === 0)
      return { body: source.slice(opening + 1, index), next: index + 1 };
  }
  return null;
}

function allAtRuleBodies(css: string, marker: RegExp) {
  const bodies: string[] = [];
  let offset = 0;
  while (offset < css.length) {
    const block = blockForAtRule(css, marker, offset);
    if (!block) break;
    bodies.push(block.body);
    offset = block.next;
  }
  return bodies;
}

function hasDeclaration(rules: CssRule[], property: string, value: RegExp) {
  return rules.some(rule => declaration(rule.body, property, value));
}

function rulesForClass(
  css: string,
  className: string,
  options: { excludeInteractive?: boolean } = {}
) {
  return rulesMatching(css, selector => {
    const hasClass = selector.includes(className);
    const isInteractive = /:(?:hover|focus-visible)\b/.test(selector);
    return hasClass && !(options.excludeInteractive && isInteractive);
  });
}

describe("filament spool visual effects", () => {
  it("renders low-stock-only alert rings as hidden decorative spans inside the card button", () => {
    const lowTree = parseMarkup(renderCard(100));
    const normalTree = parseMarkup(renderCard(500));
    const lowButton = descendants(lowTree).find(element =>
      classes(element).includes("filament-spool-card")
    );
    const normalButton = descendants(normalTree).find(element =>
      classes(element).includes("filament-spool-card")
    );

    expect(lowButton).toBeDefined();
    expect(normalButton).toBeDefined();
    expect(lowButton?.tag).toBe("button");
    expect(normalButton?.tag).toBe("button");
    expect(classes(lowButton!)).toContain("is-low");
    expect(classes(normalButton!)).not.toContain("is-low");

    const lowChildren = descendants(lowButton!);
    const normalChildren = descendants(normalButton!);
    const alertRings = lowChildren.filter(element =>
      classes(element).includes("filament-card-alert-ring")
    );
    expect(alertRings).toHaveLength(2);
    expect(alertRings.map(element => classes(element))).toEqual(
      expect.arrayContaining([
        expect.arrayContaining(["filament-card-alert-ring", "is-yellow"]),
        expect.arrayContaining(["filament-card-alert-ring", "is-red"]),
      ])
    );
    expect(alertRings.every(element => element.tag === "span")).toBe(true);
    expect(
      alertRings.every(element => element.attributes["aria-hidden"] === "true")
    ).toBe(true);
    expect(
      normalChildren.some(element =>
        classes(element).includes("filament-card-alert-ring")
      )
    ).toBe(false);

    const lowSurface = lowChildren.find(element =>
      classes(element).includes("filament-card-surface")
    );
    const normalSurface = normalChildren.find(element =>
      classes(element).includes("filament-card-surface")
    );
    expect(lowSurface).toBeDefined();
    expect(normalSurface).toBeDefined();
    for (const childClass of [
      "filament-card-swatch",
      "filament-card-name",
      "filament-card-material",
      "filament-card-weight",
    ]) {
      expect(
        descendants(lowSurface!).some(element =>
          classes(element).includes(childClass)
        )
      ).toBe(true);
    }
    expect(lowButton!.children.some(element => classes(element).includes("filament-card-low-ribbon"))).toBe(true);
    expect(
      descendants(normalSurface!).some(element =>
        classes(element).includes("filament-card-low-ribbon")
      )
    ).toBe(false);
  });

  it("keeps the clipped surface and stock ribbon out of layout flow", () => {
    const surfaces = rulesForClass(stylesheet, ".filament-card-surface", {
      excludeInteractive: true,
    });
    const lowSurfaces = rulesMatching(
      stylesheet,
      selector =>
        selector.includes(".filament-spool-card.is-low") &&
        selector.includes(".filament-card-surface")
    );
    const ribbons = rulesForClass(stylesheet, ".filament-card-low-ribbon", {
      excludeInteractive: true,
    });

    expect(surfaces.length).toBeGreaterThan(0);
    expect(hasDeclaration(surfaces, "overflow", /^(?:hidden|clip)$/i)).toBe(
      true
    );
    expect(hasDeclaration(surfaces, "border-radius", /.+/)).toBe(true);
    expect(lowSurfaces).toHaveLength(0);
    expect(hasDeclaration(surfaces, "padding", /^13px\s+8px\s+0$/i)).toBe(true);

    expect(ribbons.length).toBeGreaterThan(0);
    expect(hasDeclaration(ribbons, "position", /^absolute$/i)).toBe(true);
    expect(hasDeclaration(ribbons, "top", /^-10px$/i)).toBe(true);
    expect(hasDeclaration(ribbons, "left", /^50%$/i)).toBe(true);
    expect(hasDeclaration(ribbons, "width", /^max-content$/i)).toBe(true);
    expect(hasDeclaration(ribbons, "opacity", /^0(?:\.0+)?$/)).toBe(true);
    expect(
      hasDeclaration(ribbons, "transform", /^translateX\(\s*-50%\s*\)\s+translateY\(\s*-4px\s*\)$/i)
    ).toBe(true);

    const hoverMedia = allAtRuleBodies(
      stylesheet,
      /@media\s*\(\s*hover\s*:\s*hover\s*\)/i
    ).join("\n");
    const hoverRibbonRules = rulesMatching(
      hoverMedia,
      selector =>
        selector.includes(".filament-spool-card") &&
        selector.includes(":hover") &&
        selector.includes(".filament-card-low-ribbon")
    );
    const focusRibbonRules = rulesMatching(
      stylesheet,
      selector =>
        selector.includes(".filament-spool-card") &&
        selector.includes(":focus-visible") &&
        selector.includes(".filament-card-low-ribbon")
    );
    for (const revealRules of [hoverRibbonRules, focusRibbonRules]) {
      expect(revealRules.length).toBeGreaterThan(0);
      expect(hasDeclaration(revealRules, "opacity", /^1(?:\.0+)?$/)).toBe(true);
      expect(
        hasDeclaration(
          revealRules,
          "transform",
          /^translateX\(\s*-50%\s*\)\s+translateY\(\s*0(?:px)?\s*\)$/i
        )
      ).toBe(true);
    }
  });

  it("uses a color-matched blurred halo on hover and keyboard focus, without legacy after accents", () => {
    const baseHalo = rulesMatching(
      stylesheet,
      selector => selector === ".filament-spool-card::before"
    );
    expect(baseHalo.length).toBeGreaterThan(0);
    expect(hasDeclaration(baseHalo, "inset", /^-5px$/i)).toBe(true);
    expect(hasDeclaration(baseHalo, "z-index", /^-1$/)).toBe(true);
    expect(hasDeclaration(baseHalo, "filter", /blur\(/i)).toBe(true);
    expect(
      hasDeclaration(
        baseHalo,
        "background",
        /var\(\s*--filament-color(?:\s*,[^)]*)?\s*\)/i
      ) ||
        hasDeclaration(
          baseHalo,
          "background-color",
          /var\(\s*--filament-color(?:\s*,[^)]*)?\s*\)/i
        )
    ).toBe(true);
    expect(hasDeclaration(baseHalo, "opacity", /^0(?:\.0+)?$/)).toBe(true);

    for (const pseudo of [":hover", ":focus-visible"]) {
      const haloRules = rulesMatching(stylesheet, selector =>
        selector.includes(`.filament-spool-card${pseudo}::before`)
      );
      expect(haloRules.length).toBeGreaterThan(0);
      expect(hasDeclaration(haloRules, "opacity", /^0?\.6(?:0+)?$/)).toBe(true);
    }

    const legacyNeonAfterSelectors = cssRules(stylesheet)
      .flatMap(rule => selectors(rule))
      .filter(selector =>
        /\.filament-spool-card(?::hover)?::after\b/.test(selector)
      );
    expect(legacyNeonAfterSelectors).toEqual([]);
  });

  it("styles yellow and red contour spans with their own opacity-only pulse animations", () => {
    const commonRings = rulesMatching(
      stylesheet,
      selector => selector === ".filament-card-alert-ring"
    );
    expect(commonRings.length).toBeGreaterThan(0);
    expect(hasDeclaration(commonRings, "position", /^absolute$/i)).toBe(true);
    expect(hasDeclaration(commonRings, "inset", /^-1px$/i)).toBe(true);
    expect(
      hasDeclaration(commonRings, "border", /^2px\s+solid(?:\s+.+)?$/i)
    ).toBe(true);
    expect(hasDeclaration(commonRings, "border-radius", /^inherit$/i)).toBe(
      true
    );
    expect(hasDeclaration(commonRings, "pointer-events", /^none$/i)).toBe(true);
    expect(hasDeclaration(commonRings, "z-index", /^2$/)).toBe(true);

    const yellowRules = rulesMatching(stylesheet, selector =>
      selector.includes(".filament-card-alert-ring.is-yellow")
    );
    const redRules = rulesMatching(stylesheet, selector =>
      selector.includes(".filament-card-alert-ring.is-red")
    );
    expect(yellowRules.length).toBeGreaterThan(0);
    expect(redRules.length).toBeGreaterThan(0);
    expect(
      hasDeclaration(yellowRules, "border", /#facc15\b/i) ||
        hasDeclaration(yellowRules, "border-color", /#facc15\b/i)
    ).toBe(true);
    expect(
      hasDeclaration(redRules, "border", /#ef4444\b/i) ||
        hasDeclaration(redRules, "border-color", /#ef4444\b/i)
    ).toBe(true);

    const noPreferenceMedia = allAtRuleBodies(
      stylesheet,
      /@media\s*\(\s*prefers-reduced-motion\s*:\s*no-preference\s*\)/i
    ).join("\n");
    for (const [ringClass, animationName] of [
      [".filament-card-alert-ring.is-yellow", "filament-stock-yellow-pulse"],
      [".filament-card-alert-ring.is-red", "filament-stock-red-pulse"],
    ]) {
      const animatedRules = rulesMatching(noPreferenceMedia, selector =>
        selector.includes(ringClass)
      );
      expect(animatedRules.length).toBeGreaterThan(0);
      expect(
        hasDeclaration(
          animatedRules,
          "animation",
          new RegExp(`${animationName}\\b`)
        )
      ).toBe(true);
      expect(
        hasDeclaration(
          animatedRules,
          "animation",
          /6\.4s\s+ease-in-out\s+infinite/i
        )
      ).toBe(true);

      const keyframes = blockForAtRule(
        stylesheet,
        new RegExp(`@keyframes\\s+${animationName}\\b`, "i")
      );
      expect(keyframes).not.toBeNull();
      const frames = cssRules(keyframes!.body);
      expect(frames.length).toBeGreaterThan(0);
      for (const frame of frames) {
        const properties = frame.body
          .split(";")
          .map(part => part.trim().split(/\s*:/, 1)[0])
          .filter(Boolean);
        expect(properties.length).toBeGreaterThan(0);
        expect(
          properties.every(property => property.toLowerCase() === "opacity")
        ).toBe(true);
      }
    }

    const reducedMotion = allAtRuleBodies(
      stylesheet,
      /@media\s*\(\s*prefers-reduced-motion\s*:\s*reduce\s*\)/i
    ).join("\n");
    const reducedRings = rulesForClass(
      reducedMotion,
      ".filament-card-alert-ring"
    );
    expect(hasDeclaration(reducedRings, "animation", /^none$/i)).toBe(true);
    const reducedEffectRules = rulesMatching(
      reducedMotion,
      selector =>
        selector.includes(".filament-spool-card") ||
        selector.includes(".filament-card-low-ribbon") ||
        selector.includes(".filament-card-alert-ring")
    );
    expect(hasDeclaration(reducedEffectRules, "transition", /^none$/i)).toBe(
      true
    );
    for (const ringRules of [yellowRules, redRules]) {
      expect(
        hasDeclaration(
          ringRules,
          "opacity",
          /^(?:0?\.(?:[1-9]\d*)|1(?:\.0+)?)$/
        )
      ).toBe(true);
    }
  });

  it("keeps the low-stock class tied to the shared stock threshold helper", () => {
    expect(cardSource).toMatch(/isLowStock\s*\(/);
    expect(cardSource).toMatch(/filament-spool-card[\s\S]*?is-low/);
  });
});
