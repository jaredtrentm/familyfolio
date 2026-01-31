/**
 * Cost Basis Calculation Engine
 * Supports FIFO, LIFO, HIFO, and SpecID methods for tax lot tracking
 */

export type CostBasisMethod = 'FIFO' | 'LIFO' | 'HIFO' | 'SPECID';

export interface TaxLot {
  id: string;
  transactionId: string;
  symbol: string;
  quantity: number;
  remainingQty: number;
  costBasis: number;
  acquiredDate: Date;
}

export interface SellAllocation {
  lotId: string;
  quantitySold: number;
  costBasisAllocated: number;
  acquiredDate: Date;
  proceeds: number;
  gainLoss: number;
  isLongTerm: boolean;
  holdingDays: number;
}

export interface SellResult {
  allocations: SellAllocation[];
  totalCostBasis: number;
  totalProceeds: number;
  totalGainLoss: number;
  longTermGain: number;
  shortTermGain: number;
}

/**
 * Sort lots by the specified cost basis method
 */
export function sortLotsByMethod(lots: TaxLot[], method: CostBasisMethod): TaxLot[] {
  const sortedLots = [...lots];

  switch (method) {
    case 'FIFO':
      // First In, First Out - oldest lots first
      sortedLots.sort((a, b) =>
        new Date(a.acquiredDate).getTime() - new Date(b.acquiredDate).getTime()
      );
      break;
    case 'LIFO':
      // Last In, First Out - newest lots first
      sortedLots.sort((a, b) =>
        new Date(b.acquiredDate).getTime() - new Date(a.acquiredDate).getTime()
      );
      break;
    case 'HIFO':
      // Highest In, First Out - highest cost basis per share first (minimizes taxable gain)
      sortedLots.sort((a, b) => {
        const costPerShareA = a.costBasis / a.quantity;
        const costPerShareB = b.costBasis / b.quantity;
        return costPerShareB - costPerShareA;
      });
      break;
    case 'SPECID':
      // Specific Identification - no automatic sorting, user selects lots
      break;
  }

  return sortedLots;
}

/**
 * Calculate the number of days between two dates
 */
function daysBetween(date1: Date, date2: Date): number {
  const oneDay = 24 * 60 * 60 * 1000;
  return Math.floor(Math.abs(date2.getTime() - date1.getTime()) / oneDay);
}

/**
 * Check if holding period qualifies for long-term capital gains (> 365 days)
 */
function isLongTermHolding(acquiredDate: Date, soldDate: Date): boolean {
  return daysBetween(acquiredDate, soldDate) > 365;
}

/**
 * Allocate a sell transaction across available lots using the specified method
 */
export function allocateSell(
  lots: TaxLot[],
  sellQty: number,
  sellPrice: number,
  sellDate: Date,
  method: CostBasisMethod,
  specificLotIds?: string[]
): SellResult {
  // Filter to lots with remaining quantity
  const availableLots = lots.filter(lot => lot.remainingQty > 0);

  // Sort lots by method (or filter to specific lots for SpecID)
  let lotsToUse: TaxLot[];
  if (method === 'SPECID' && specificLotIds && specificLotIds.length > 0) {
    lotsToUse = specificLotIds
      .map(id => availableLots.find(lot => lot.id === id))
      .filter((lot): lot is TaxLot => lot !== undefined);
  } else {
    lotsToUse = sortLotsByMethod(availableLots, method);
  }

  const allocations: SellAllocation[] = [];
  let remainingSellQty = sellQty;

  for (const lot of lotsToUse) {
    if (remainingSellQty <= 0) break;

    const qtyFromThisLot = Math.min(remainingSellQty, lot.remainingQty);
    const costPerShare = lot.costBasis / lot.quantity;
    const costBasisAllocated = qtyFromThisLot * costPerShare;
    const proceeds = qtyFromThisLot * sellPrice;
    const gainLoss = proceeds - costBasisAllocated;
    const acquiredDate = new Date(lot.acquiredDate);
    const holdingDays = daysBetween(acquiredDate, sellDate);

    allocations.push({
      lotId: lot.id,
      quantitySold: qtyFromThisLot,
      costBasisAllocated,
      acquiredDate,
      proceeds,
      gainLoss,
      isLongTerm: isLongTermHolding(acquiredDate, sellDate),
      holdingDays,
    });

    remainingSellQty -= qtyFromThisLot;
  }

  // Calculate totals
  const totalCostBasis = allocations.reduce((sum, a) => sum + a.costBasisAllocated, 0);
  const totalProceeds = allocations.reduce((sum, a) => sum + a.proceeds, 0);
  const totalGainLoss = totalProceeds - totalCostBasis;
  const longTermGain = allocations
    .filter(a => a.isLongTerm)
    .reduce((sum, a) => sum + a.gainLoss, 0);
  const shortTermGain = allocations
    .filter(a => !a.isLongTerm)
    .reduce((sum, a) => sum + a.gainLoss, 0);

  return {
    allocations,
    totalCostBasis,
    totalProceeds,
    totalGainLoss,
    longTermGain,
    shortTermGain,
  };
}

/**
 * Get available lots for a symbol that have remaining quantity
 */
export function getAvailableLots(lots: TaxLot[], symbol: string): TaxLot[] {
  return lots
    .filter(lot =>
      lot.symbol.toUpperCase() === symbol.toUpperCase() &&
      lot.remainingQty > 0
    )
    .sort((a, b) =>
      new Date(a.acquiredDate).getTime() - new Date(b.acquiredDate).getTime()
    );
}

/**
 * Calculate the total available quantity for a symbol across all lots
 */
export function getTotalAvailableQty(lots: TaxLot[], symbol: string): number {
  return getAvailableLots(lots, symbol)
    .reduce((sum, lot) => sum + lot.remainingQty, 0);
}

/**
 * Calculate weighted average cost per share for available lots
 */
export function getWeightedAvgCost(lots: TaxLot[], symbol: string): number {
  const availableLots = getAvailableLots(lots, symbol);
  const totalQty = availableLots.reduce((sum, lot) => sum + lot.remainingQty, 0);

  if (totalQty === 0) return 0;

  const totalCost = availableLots.reduce((sum, lot) => {
    const costPerShare = lot.costBasis / lot.quantity;
    return sum + (costPerShare * lot.remainingQty);
  }, 0);

  return totalCost / totalQty;
}

/**
 * Preview sell allocation without actually modifying lots
 * Useful for showing user what would happen before confirming
 */
export function previewSellAllocation(
  lots: TaxLot[],
  symbol: string,
  sellQty: number,
  sellPrice: number,
  sellDate: Date,
  method: CostBasisMethod,
  specificLotIds?: string[]
): SellResult & { insufficientShares: boolean; shortfall: number } {
  const symbolLots = getAvailableLots(lots, symbol);
  const totalAvailable = getTotalAvailableQty(lots, symbol);

  const result = allocateSell(symbolLots, sellQty, sellPrice, sellDate, method, specificLotIds);

  return {
    ...result,
    insufficientShares: sellQty > totalAvailable,
    shortfall: Math.max(0, sellQty - totalAvailable),
  };
}

/**
 * Format method name for display
 */
export function formatCostBasisMethod(method: CostBasisMethod): string {
  const names: Record<CostBasisMethod, string> = {
    FIFO: 'First In, First Out (FIFO)',
    LIFO: 'Last In, First Out (LIFO)',
    HIFO: 'Highest Cost First (HIFO)',
    SPECID: 'Specific Identification',
  };
  return names[method];
}

/**
 * Get short description of cost basis method
 */
export function getCostBasisMethodDescription(method: CostBasisMethod): string {
  const descriptions: Record<CostBasisMethod, string> = {
    FIFO: 'Sells oldest shares first',
    LIFO: 'Sells newest shares first',
    HIFO: 'Sells highest-cost shares first to minimize taxable gains',
    SPECID: 'Choose specific lots to sell',
  };
  return descriptions[method];
}
