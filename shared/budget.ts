export const DEFAULT_BUDGET_INPUT = {
  productName: "Vaso orgânico v3",
  orcaPieceCost: 18.9,
  plateCount: 1,
  otherCosts: 3.44,
  mkp: 2.5,
  lossPercentage: 10,
  depreciationPercentage: 5,
  maintenancePercentage: 5,
  shopeePercentage: 20,
  shopeeFixedFee: 4,
} as const;

export type BudgetInput = {
  productName: string;
  orcaPieceCost: number;
  plateCount: number;
  otherCosts: number;
  mkp: number;
  lossPercentage: number;
  depreciationPercentage: number;
  maintenancePercentage: number;
  shopeePercentage: number;
  shopeeFixedFee: number;
};

export type BudgetResult = {
  materialCost: number;
  costWithOtherExpenses: number;
  lossCost: number;
  depreciationCost: number;
  maintenanceCost: number;
  operationalCost: number;
  priceBeforeShopee: number;
  shopeeFee: number;
  suggestedPrice: number;
};

const money = (value: number) => Math.round(((Number.isFinite(value) ? value : 0) + 1e-9) * 100) / 100;
const percentage = (value: number) => Math.max(0, Number.isFinite(value) ? value : 0) / 100;

export function calculateBudget(input: BudgetInput): BudgetResult {
  const materialCost = money(Math.max(0, input.orcaPieceCost) * Math.max(1, Math.floor(input.plateCount)));
  const costWithOtherExpenses = money(materialCost + Math.max(0, input.otherCosts));
  const lossCost = money(costWithOtherExpenses * percentage(input.lossPercentage));
  const depreciationCost = money(costWithOtherExpenses * percentage(input.depreciationPercentage));
  const maintenanceCost = money(costWithOtherExpenses * percentage(input.maintenancePercentage));
  const operationalCost = money(costWithOtherExpenses + lossCost + depreciationCost + maintenanceCost);
  const priceBeforeShopee = money(operationalCost * Math.max(0, input.mkp));
  const shopeeFee = money(priceBeforeShopee * percentage(input.shopeePercentage) + Math.max(0, input.shopeeFixedFee));

  return {
    materialCost,
    costWithOtherExpenses,
    lossCost,
    depreciationCost,
    maintenanceCost,
    operationalCost,
    priceBeforeShopee,
    shopeeFee,
    suggestedPrice: money(priceBeforeShopee + shopeeFee),
  };
}
