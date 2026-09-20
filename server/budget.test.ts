import { describe, expect, it } from "vitest";
import { calculateBudget, DEFAULT_BUDGET_INPUT, hasDuplicateProductId, isValidProductId } from "../shared/budget";

describe("budget calculator", () => {
  it("calculates the default quote and includes the fixed Shopee fee", () => {
    const result = calculateBudget(DEFAULT_BUDGET_INPUT);
    expect(result.materialCost).toBe(0);
    expect(result.costWithOtherExpenses).toBe(3.44);
    expect(result.operationalCost).toBe(4.12);
    expect(result.priceBeforeShopee).toBe(10.3);
    expect(result.shopeeFee).toBe(6.06);
    expect(result.suggestedPrice).toBe(16.36);
  });

  it("sums each Orca plate independently", () => {
    const result = calculateBudget({ ...DEFAULT_BUDGET_INPUT, plateCosts: [2.5, 2.4], otherCosts: 0, lossPercentage: 0, depreciationPercentage: 0, maintenancePercentage: 0, mkp: 1, shopeePercentage: 0, shopeeFixedFee: 4 });
    expect(result.materialCost).toBe(4.9);
    expect(result.suggestedPrice).toBe(8.9);
  });

  it("treats an empty plate field as zero while accepting typed decimals", () => {
    const result = calculateBudget({ ...DEFAULT_BUDGET_INPUT, plateCosts: ["", "2.50"], otherCosts: 0, lossPercentage: 0, depreciationPercentage: 0, maintenancePercentage: 0, mkp: 1, shopeePercentage: 0, shopeeFixedFee: 0 });
    expect(result.materialCost).toBe(2.5);
    expect(result.suggestedPrice).toBe(2.5);
  });

  it("does not include negative plate values in the material cost", () => {
    const result = calculateBudget({ ...DEFAULT_BUDGET_INPUT, plateCosts: ["-5", 2], otherCosts: 0, lossPercentage: 0, depreciationPercentage: 0, maintenancePercentage: 0, mkp: 1, shopeePercentage: 0, shopeeFixedFee: 0 });
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
