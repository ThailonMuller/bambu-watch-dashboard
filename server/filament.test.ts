import { describe, expect, it } from "vitest";
import { debitStock, filamentTextColor, isLowStock, remainingAfterDebit } from "../shared/filament";

describe("filament inventory", () => {
  it("flags stock at or below the configured threshold", () => {
    expect(isLowStock(200, 200)).toBe(true);
    expect(isLowStock(201, 200)).toBe(false);
  });

  it("never makes stock negative when approving a debit", () => {
    expect(debitStock(145, 38)).toBe(107);
    expect(debitStock(20, 50)).toBe(0);
  });

  it("shows the remaining stock after a pending debit", () => {
    expect(remainingAfterDebit(145, 38)).toBe(107);
    expect(remainingAfterDebit(20, 50)).toBe(0);
  });

  it("uses dark text on bright colors including cyan and white text on dark colors", () => {
    expect(filamentTextColor("#00d8f5")).toBe("#000000");
    expect(filamentTextColor("#ffffff")).toBe("#000000");
    expect(filamentTextColor("#000000")).toBe("#ffffff");
    expect(filamentTextColor("#121036")).toBe("#ffffff");
  });

  it("accepts uppercase and bare hex colors and safely handles invalid colors", () => {
    expect(filamentTextColor("00D8F5")).toBe("#000000");
    expect(filamentTextColor("invalid")).toBe("#ffffff");
  });
});
