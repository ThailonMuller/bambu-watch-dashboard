import React, { type ChangeEvent } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import DecimalInput from "../client/src/components/DecimalInput";

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const path = resolve(directory, entry.name);
    return entry.isDirectory() ? sourceFiles(path) : /\.tsx?$/.test(entry.name) ? [path] : [];
  });
}

describe("spinner-free decimal inputs", () => {
  it("renders text with a decimal keyboard even when min/step are provided", () => {
    const html = renderToStaticMarkup(React.createElement(DecimalInput, { min: 0, step: 1, value: 1000, onChange: vi.fn() }));
    expect(html).toContain('type="text"');
    expect(html).toContain('inputMode="decimal"');
    expect(html).not.toContain('type="number"');
    expect(html).not.toContain('min="');
    expect(html).not.toContain('step="');
  });

  it("normalizes comma decimal input and forwards valid values only", () => {
    const onChange = vi.fn();
    const input = DecimalInput({ onChange });
    const event = (value: string) => ({ target: { value } }) as ChangeEvent<HTMLInputElement>;
    const decimal = event("12,5");
    input.props.onChange(decimal);
    expect(decimal.target.value).toBe("12.5");
    expect(onChange).toHaveBeenCalledTimes(1);
    input.props.onChange(event("12abc"));
    input.props.onChange(event("1.2.3"));
    expect(onChange).toHaveBeenCalledTimes(1);
    input.props.onChange(event(""));
    expect(onChange).toHaveBeenCalledTimes(2);
  });

  it("does not instantiate any native number input in the application source", () => {
    const sources = sourceFiles(resolve("client/src"));
    for (const path of sources) {
      expect(readFileSync(path, "utf8"), path).not.toMatch(/type\s*=\s*["']number["']/);
    }
    const home = readFileSync(resolve("client/src/pages/Home.tsx"), "utf8");
    const spoolCard = readFileSync(resolve("client/src/components/FilamentSpoolCard.tsx"), "utf8");
    expect(`${home}\n${spoolCard}`.match(/<DecimalInput\b/g)).toHaveLength(6);
  });
});
