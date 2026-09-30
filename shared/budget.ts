export const DEFAULT_BUDGET_INPUT = {
  productId: "1001",
  productName: "Vaso orgânico v3",
  plateCosts: [0],
  otherCosts: 3.44,
  mkp: 130,
  lossPercentage: 10,
  depreciationPercentage: 5,
  maintenancePercentage: 5,
  shopeePercentage: 20,
  shopeeFixedFee: 4,
} as const;

export type BudgetInput = {
  productId: string;
  productName: string;
  plateCosts: readonly (number | string)[];
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

export function isValidProductId(value: string) {
  return /^\d+$/.test(value.trim());
}

export function hasDuplicateProductId(items: readonly { productId: string }[], productId: string) {
  return items.some((item) => item.productId === productId);
}

const money = (value: number) => Math.round(((Number.isFinite(value) ? value : 0) + 1e-9) * 100) / 100;
const percentage = (value: number) => Math.max(0, Number.isFinite(value) ? value : 0) / 100;

export function calculateBudget(input: BudgetInput): BudgetResult {
  const materialCost = money(input.plateCosts.reduce<number>((total, cost) => {
    const numericCost = Number(cost);
    return total + (Number.isFinite(numericCost) ? Math.max(0, numericCost) : 0);
  }, 0));
  const costWithOtherExpenses = money(materialCost + Math.max(0, input.otherCosts));
  const lossCost = money(costWithOtherExpenses * percentage(input.lossPercentage));
  const depreciationCost = money(costWithOtherExpenses * percentage(input.depreciationPercentage));
  const maintenanceCost = money(costWithOtherExpenses * percentage(input.maintenancePercentage));
  const operationalCost = money(costWithOtherExpenses + lossCost + depreciationCost + maintenanceCost);
  const priceBeforeShopee = money(operationalCost * percentage(input.mkp));
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
