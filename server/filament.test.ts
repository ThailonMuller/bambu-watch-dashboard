import { describe, expect, it } from "vitest";
import { debitStock, isLowStock } from "../shared/filament";

describe("filament inventory", () => {
  it("flags stock at or below the configured threshold", () => {
    expect(isLowStock(200, 200)).toBe(true);
    expect(isLowStock(201, 200)).toBe(false);
  });

  it("never makes stock negative when approving a debit", () => {
    expect(debitStock(145, 38)).toBe(107);
    expect(debitStock(20, 50)).toBe(0);
  });
});
