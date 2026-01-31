/**
 * Wash Sale Detection
 * IRS wash sale rule: Cannot claim a loss if you buy substantially identical
 * securities within 30 days before or after selling at a loss.
 */

export interface Transaction {
  id: string;
  date: Date;
  type: string;
  symbol: string;
  quantity: number;
  price: number;
  amount: number;
}

export interface WashSaleResult {
  isWashSale: boolean;
  disallowedLoss: number;
  matchingBuyId?: string;
  matchingBuyDate?: Date;
  matchingBuyQty?: number;
  daysFromSell?: number;
}

const WASH_SALE_WINDOW_DAYS = 30;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Calculate the number of days between two dates
 */
function daysBetween(date1: Date, date2: Date): number {
  return Math.floor(Math.abs(date2.getTime() - date1.getTime()) / ONE_DAY_MS);
}

/**
 * Check if a date falls within the wash sale window (30 days before or after)
 */
function isWithinWashSaleWindow(sellDate: Date, otherDate: Date): boolean {
  const days = daysBetween(sellDate, otherDate);
  return days <= WASH_SALE_WINDOW_DAYS;
}

/**
 * Detect if a sell transaction triggers the wash sale rule
 *
 * @param sellDate - Date of the sell transaction
 * @param sellSymbol - Symbol being sold
 * @param sellLoss - The loss amount from the sale (must be negative for wash sale)
 * @param sellQty - Quantity sold
 * @param allTransactions - All transactions to check against
 * @returns WashSaleResult indicating if wash sale applies
 */
export function detectWashSale(
  sellDate: Date,
  sellSymbol: string,
  sellLoss: number,
  sellQty: number,
  allTransactions: Transaction[]
): WashSaleResult {
  // Wash sale only applies to losses
  if (sellLoss >= 0) {
    return {
      isWashSale: false,
      disallowedLoss: 0,
    };
  }

  const normalizedSymbol = sellSymbol.toUpperCase().trim();
  const sellTime = sellDate.getTime();

  // Look for BUY transactions of the same symbol within 30-day window
  const potentialMatches = allTransactions
    .filter(tx => {
      if (tx.type !== 'BUY' && tx.type !== 'TRANSFER_IN') return false;
      if (tx.symbol.toUpperCase().trim() !== normalizedSymbol) return false;

      const txDate = new Date(tx.date);
      return isWithinWashSaleWindow(sellDate, txDate);
    })
    .sort((a, b) => {
      // Prioritize buys that occurred after the sell
      const aDate = new Date(a.date);
      const bDate = new Date(b.date);
      const aIsAfter = aDate.getTime() > sellTime;
      const bIsAfter = bDate.getTime() > sellTime;

      if (aIsAfter && !bIsAfter) return -1;
      if (!aIsAfter && bIsAfter) return 1;

      // If both are before or both are after, sort by closest to sell date
      return Math.abs(aDate.getTime() - sellTime) - Math.abs(bDate.getTime() - sellTime);
    });

  if (potentialMatches.length === 0) {
    return {
      isWashSale: false,
      disallowedLoss: 0,
    };
  }

  // The first matching buy triggers the wash sale
  const matchingBuy = potentialMatches[0];
  const matchingDate = new Date(matchingBuy.date);

  // Calculate disallowed loss based on the proportion of shares
  // If you sold 100 shares at a loss and bought back 50 shares,
  // only 50% of the loss is disallowed
  const sharesReplaced = Math.min(matchingBuy.quantity, sellQty);
  const proportionReplaced = sharesReplaced / sellQty;
  const disallowedLoss = Math.abs(sellLoss) * proportionReplaced;

  return {
    isWashSale: true,
    disallowedLoss,
    matchingBuyId: matchingBuy.id,
    matchingBuyDate: matchingDate,
    matchingBuyQty: sharesReplaced,
    daysFromSell: daysBetween(sellDate, matchingDate) * (matchingDate > sellDate ? 1 : -1),
  };
}

/**
 * Check if a proposed buy would trigger wash sale on recent losses
 */
export function wouldTriggerWashSale(
  buyDate: Date,
  buySymbol: string,
  recentSells: Transaction[],
  sellGainsLosses: Map<string, number>
): { wouldTrigger: boolean; affectedSellIds: string[] } {
  const normalizedSymbol = buySymbol.toUpperCase().trim();
  const affectedSellIds: string[] = [];

  for (const sell of recentSells) {
    if (sell.symbol.toUpperCase().trim() !== normalizedSymbol) continue;
    if (sell.type !== 'SELL' && sell.type !== 'TRANSFER_OUT') continue;

    const sellDate = new Date(sell.date);
    if (!isWithinWashSaleWindow(buyDate, sellDate)) continue;

    const gainLoss = sellGainsLosses.get(sell.id) || 0;
    if (gainLoss < 0) {
      affectedSellIds.push(sell.id);
    }
  }

  return {
    wouldTrigger: affectedSellIds.length > 0,
    affectedSellIds,
  };
}

/**
 * Get all transactions within the wash sale window of a given date
 */
export function getTransactionsInWashSaleWindow(
  centerDate: Date,
  symbol: string,
  allTransactions: Transaction[]
): Transaction[] {
  const normalizedSymbol = symbol.toUpperCase().trim();

  return allTransactions.filter(tx => {
    if (tx.symbol.toUpperCase().trim() !== normalizedSymbol) return false;
    const txDate = new Date(tx.date);
    return isWithinWashSaleWindow(centerDate, txDate);
  });
}

/**
 * Format wash sale warning message
 */
export function formatWashSaleWarning(result: WashSaleResult): string {
  if (!result.isWashSale) {
    return '';
  }

  const direction = result.daysFromSell && result.daysFromSell > 0 ? 'after' : 'before';
  const days = Math.abs(result.daysFromSell || 0);

  return `Wash Sale: $${result.disallowedLoss.toFixed(2)} loss disallowed due to purchase of ${result.matchingBuyQty} shares ${days} days ${direction} this sale.`;
}
