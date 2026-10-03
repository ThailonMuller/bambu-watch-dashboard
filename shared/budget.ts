export const STORE_BUDGET_INPUT = {
  productId: "1001",
  productName: "Vaso orgânico v3",
  plateCosts: [0],
  packagingCost: 3.44,
  otherCosts: 0,
  mkp: 130,
  lossPercentage: 10,
  depreciationPercentage: 3,
  maintenancePercentage: 2,
  shopeePercentage: 14,
  shopeeFixedFee: 4,
} as const;

export const CUSTOM_BUDGET_INPUT = {
  ...STORE_BUDGET_INPUT,
  mkp: 150,
  lossPercentage: 30,
  depreciationPercentage: 3,
  maintenancePercentage: 2,
  shopeePercentage: 14,
  otherCosts: 0,
} as const;

export const DEFAULT_BUDGET_INPUT = STORE_BUDGET_INPUT;

export type BudgetInput = {
  productId: string;
  productName: string;
  plateCosts: readonly (number | string)[];
  packagingCost: number;
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
  directProfit: number;
  shopeeProfit: number;
};

export function isValidProductId(value: string) {
  return /^\d+$/.test(value.trim());
}

export function hasDuplicateProductId(items: readonly { productId: string }[], productId: string) {
  return items.some((item) => item.productId === productId);
}

// A referência mantém a precisão interna e arredonda apenas na formatação monetária.
const money = (value: number) => Number.isFinite(value) ? value : 0;
const percentage = (value: number) => Math.max(0, Number.isFinite(value) ? value : 0) / 100;

export function calculateBudget(input: BudgetInput): BudgetResult {
  const materialCost = money(input.plateCosts.reduce<number>((total, cost) => {
    const numericCost = Number(cost);
    return total + (Number.isFinite(numericCost) ? Math.max(0, numericCost) : 0);
  }, 0));
  const costWithOtherExpenses = money(materialCost + Math.max(0, input.packagingCost) + Math.max(0, input.otherCosts));
  // Réplica do simulador: depreciação/manutenção aumentam a base; a perda é
  // recuperada dividindo por (1 - perda), antes do markup.
  const operationalCost = money(costWithOtherExpenses * (1 + percentage(input.depreciationPercentage) + percentage(input.maintenancePercentage)) / Math.max(0.000001, 1 - percentage(input.lossPercentage)));
  const lossCost = money(operationalCost - costWithOtherExpenses);
  const depreciationCost = money(costWithOtherExpenses * percentage(input.depreciationPercentage));
  const maintenanceCost = money(costWithOtherExpenses * percentage(input.maintenancePercentage));
  const priceBeforeShopee = money(operationalCost * (1 + percentage(input.mkp)));
  const shopeePrice = money((priceBeforeShopee + Math.max(0, input.shopeeFixedFee)) / Math.max(0.000001, 1 - percentage(input.shopeePercentage)));
  const shopeeFee = money(shopeePrice - priceBeforeShopee);

  return {
    materialCost,
    costWithOtherExpenses,
    lossCost,
    depreciationCost,
    maintenanceCost,
    operationalCost,
    priceBeforeShopee,
    shopeeFee,
    suggestedPrice: shopeePrice,
    directProfit: money(priceBeforeShopee - operationalCost),
    shopeeProfit: money(shopeePrice - operationalCost),
  };
}
