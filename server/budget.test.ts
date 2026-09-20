import { describe, expect, it } from "vitest";
import { calculateBudget, DEFAULT_BUDGET_INPUT } from "../shared/budget";

describe("budget calculator", () => {
  it("calculates the default quote and includes the fixed Shopee fee", () => {
    const result = calculateBudget(DEFAULT_BUDGET_INPUT);
    expect(result.materialCost).toBe(18.9);
    expect(result.costWithOtherExpenses).toBe(22.34);
    expect(result.operationalCost).toBe(26.81);
    expect(result.priceBeforeShopee).toBe(67.03);
    expect(result.shopeeFee).toBe(17.41);
    expect(result.suggestedPrice).toBe(84.44);
  });

  it("multiplies Orca cost by the number of plates", () => {
    const result = calculateBudget({ ...DEFAULT_BUDGET_INPUT, plateCount: 3, otherCosts: 0, lossPercentage: 0, depreciationPercentage: 0, maintenancePercentage: 0, mkp: 1, shopeePercentage: 0, shopeeFixedFee: 4 });
    expect(result.materialCost).toBe(56.7);
    expect(result.suggestedPrice).toBe(60.7);
  });
});
