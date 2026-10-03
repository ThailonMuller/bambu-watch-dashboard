import { describe, expect, it } from "vitest";
import { calculateBudget, CUSTOM_BUDGET_INPUT, DEFAULT_BUDGET_INPUT, hasDuplicateProductId, isValidProductId } from "../shared/budget";

describe("budget calculator", () => {
  it("replicates the store sequence and includes the fixed Shopee fee", () => {
    const result = calculateBudget(DEFAULT_BUDGET_INPUT);
    expect(result.materialCost).toBe(0);
    expect(result.costWithOtherExpenses).toBe(3.44);
    expect(result.operationalCost).toBeCloseTo(4.0133333333, 8);
    expect(result.priceBeforeShopee).toBeCloseTo(9.2306666667, 8);
    expect(result.shopeeFee).toBeCloseTo(6.1538294574, 8);
    expect(result.suggestedPrice).toBeCloseTo(15.3844961248, 8);
  });

  it("keeps the store defaults aligned with the requested rates", () => {
    expect(DEFAULT_BUDGET_INPUT).toMatchObject({ mkp: 130, lossPercentage: 10, depreciationPercentage: 3, maintenancePercentage: 2, shopeePercentage: 14, shopeeFixedFee: 4 });
  });

  it("keeps the custom defaults aligned with the requested rates", () => {
    expect(CUSTOM_BUDGET_INPUT).toMatchObject({ mkp: 150, lossPercentage: 30, depreciationPercentage: 3, maintenancePercentage: 2, shopeePercentage: 14, shopeeFixedFee: 4 });
  });

  it("calculates the custom quote with its own defaults", () => {
    const result = calculateBudget(CUSTOM_BUDGET_INPUT);
    expect(result.operationalCost).toBeCloseTo(5.16, 8);
    expect(result.priceBeforeShopee).toBeCloseTo(12.9, 8);
    expect(result.shopeeFee).toBeCloseTo(6.7511627907, 8);
    expect(result.suggestedPrice).toBeCloseTo(19.6511627907, 8);
  });

  it("sums each Orca plate independently", () => {
    const result = calculateBudget({ ...DEFAULT_BUDGET_INPUT, plateCosts: [2.5, 2.4], packagingCost: 0, otherCosts: 0, lossPercentage: 0, depreciationPercentage: 0, maintenancePercentage: 0, mkp: 100, shopeePercentage: 0, shopeeFixedFee: 4 });
    expect(result.materialCost).toBe(4.9);
    expect(result.suggestedPrice).toBeCloseTo(13.8, 8);
  });

  it("treats an empty plate field as zero while accepting typed decimals", () => {
    const result = calculateBudget({ ...DEFAULT_BUDGET_INPUT, plateCosts: ["", "2.50"], packagingCost: 0, otherCosts: 0, lossPercentage: 0, depreciationPercentage: 0, maintenancePercentage: 0, mkp: 100, shopeePercentage: 0, shopeeFixedFee: 0 });
    expect(result.materialCost).toBe(2.5);
    expect(result.costWithOtherExpenses).toBe(2.5);
    expect(result.suggestedPrice).toBeCloseTo(5, 8);
  });

  it("does not include negative plate values in the material cost", () => {
    const result = calculateBudget({ ...DEFAULT_BUDGET_INPUT, plateCosts: ["-5", 2], packagingCost: 0, otherCosts: 0, lossPercentage: 0, depreciationPercentage: 0, maintenancePercentage: 0, mkp: 100, shopeePercentage: 0, shopeeFixedFee: 0 });
    expect(result.materialCost).toBe(2);
  });

  it("keeps product identity available for the spreadsheet record", () => {
    expect(DEFAULT_BUDGET_INPUT.productId).toBe("1001");
    expect(DEFAULT_BUDGET_INPUT.productName).toBe("Vaso orgânico v3");
  });

  it("accepts only numeric IDs and rejects duplicates", () => {
    expect(isValidProductId("12345")).toBe(true);
    expect(isValidProductId("FALCAO-001")).toBe(false);
    expect(hasDuplicateProductId([{ productId: "12345" }], "12345")).toBe(true);
    expect(hasDuplicateProductId([{ productId: "12345" }], "67890")).toBe(false);
  });
});
