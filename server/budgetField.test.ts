import React, { type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import postcss from "postcss";
import { describe, expect, it, vi } from "vitest";
import BudgetField from "../client/src/components/BudgetField";

type ElementProps = { children?: ReactNode; onClick?: () => void; className?: string; type?: string; "aria-label"?: string };

function elements(node: ReactNode): ReactElement<ElementProps>[] {
  const found: ReactElement<ElementProps>[] = [];
  React.Children.forEach(node, child => {
    if (!React.isValidElement<ElementProps>(child)) return;
    found.push(child, ...elements(child.props.children));
  });
  return found;
}

const stylesheet = postcss.parse(readFileSync(resolve("client/src/index.css"), "utf8"));
function finalStyles(selector: string) {
  const values: Record<string, string> = {};
  stylesheet.walkRules(rule => {
    if (rule.selectors.includes(selector)) {
      rule.walkDecls(declaration => { values[declaration.prop] = declaration.value; });
    }
  });
  return values;
}

describe("FR3D custom budget increment controls", () => {
  it("renders exactly the two styled buttons beside a number input and its unit", () => {
    const node = BudgetField({ label: "MKP", value: 130, suffix: "%", onChange: vi.fn() });
    const buttons = elements(node).filter(element => element.type === "button");
    expect(buttons).toHaveLength(2);
    expect(buttons.map(button => button.props["aria-label"])).toEqual(["Aumentar MKP", "Diminuir MKP"]);
    expect(buttons.every(button => button.props.type === "button" && button.props.className?.includes("budget-step-button"))).toBe(true);
    const html = renderToStaticMarkup(node);
    expect(html).toContain('type="number"');
    expect(html).toContain('class="budget-stepper"');
    expect(html).toContain('class="budget-input-suffix"');
    expect(html).toContain('aria-label="Ajustar MKP"');
  });

  it("increments and decrements using the existing integer step", () => {
    const onChange = vi.fn();
    const buttons = elements(BudgetField({ label: "MKP", value: 130, onChange })).filter(element => element.type === "button");
    buttons[0].props.onClick?.();
    buttons[1].props.onClick?.();
    expect(onChange.mock.calls).toEqual([["131"], ["129"]]);
  });

  it("honors fractional steps and the minimum instead of producing negative costs", () => {
    const onChange = vi.fn();
    const buttons = elements(BudgetField({ label: "Embalagem", value: 0, prefix: "R$", step: "0.01", onChange })).filter(element => element.type === "button");
    buttons[0].props.onClick?.();
    buttons[1].props.onClick?.();
    expect(onChange.mock.calls).toEqual([["0.01"], ["0.00"]]);
  });

  it("keeps native arrows hidden while restoring the original blue edge and spacing", () => {
    expect(finalStyles('.budget-number-control input[type="number"]::-webkit-inner-spin-button')).toMatchObject({ display: "none", opacity: "0", width: "0" });
    expect(finalStyles('.budget-number-control input[type="number"]::-webkit-outer-spin-button')).toMatchObject({ display: "none", opacity: "0", width: "0" });
    expect(finalStyles('input[type="number"]::-webkit-inner-spin-button')["display"]).toBe("none");
    expect(finalStyles(".budget-stepper")).toMatchObject({ display: "grid", width: "25px", right: "-10px" });
    expect(finalStyles(".budget-step-button")).toMatchObject({ display: "grid", color: "#8ff5ff" });
    expect(finalStyles('html.light .budget-step-button')["color"]).toBe("#147892");
    expect(finalStyles('.budget-number-control input[type="number"]')["padding-right"]).toBe("52px");
    expect(finalStyles('.budget-input-wrap:not(.has-suffix) .budget-number-control input[type="number"]')["padding-right"]).toBe("52px");
    expect(finalStyles(".budget-input-suffix")["right"]).toBe("27px");
  });
});
