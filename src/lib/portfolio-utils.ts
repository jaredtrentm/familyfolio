/**
 * Portfolio calculation utilities
 * Handles holdings, closed positions, and realized gains calculations
 */

export interface Transaction {
  id: string;
  symbol: string;
  type: string;
  quantity: number;
  price: number;
  amount: number;
  fees: number;
  date: Date;
}

export interface Holding {
  symbol: string;
  quantity: number;
  costBasis: number;
  avgCost: number;
}

export interface ClosedPosition {
  symbol: string;
  totalSharesBought: number;
  totalSharesSold: number;
  totalCostBasis: number;
  totalProceeds: number;
  totalFees: number;
  realizedGain: number;
  realizedGainPercent: number;
  firstBuyDate: Date;
  lastSellDate: Date;
  holdingPeriodDays: number;
  isLongTerm: boolean; // > 1 year holding period
  transactions: Transaction[];
}

export interface PortfolioSummary {
  currentHoldings: Map<string, Holding>;
  closedPositions: ClosedPosition[];
  totalRealizedGain: number;
  totalRealizedGainLongTerm: number;
  totalRealizedGainShortTerm: number;
}

/**
 * Calculate current holdings and closed positions from transaction history
 */
export function calculatePortfolioFromTransactions(transactions: Transaction[]): PortfolioSummary {
  // Sort transactions by date ascending
  const sortedTx = [...transactions].sort((a, b) =>
    new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  // Track holdings over time
  const holdingsMap = new Map<string, {
    quantity: number;
    costBasis: number;
    transactions: Transaction[];
    firstBuyDate: Date | null;
  }>();

  // Track closed positions
  const closedPositions: ClosedPosition[] = [];

  for (const tx of sortedTx) {
    const symbol = tx.symbol.toUpperCase().trim();
    const existing = holdingsMap.get(symbol) || {
      quantity: 0,
      costBasis: 0,
      transactions: [],
      firstBuyDate: null,
    };

    existing.transactions.push(tx);

    switch (tx.type) {
      case 'BUY':
      case 'TRANSFER_IN':
        if (existing.quantity === 0) {
          existing.firstBuyDate = new Date(tx.date);
        }
        existing.quantity += tx.quantity;
        existing.costBasis += tx.amount + tx.fees;
        break;

      case 'SELL':
      case 'TRANSFER_OUT':
        if (existing.quantity > 0) {
          const sellRatio = Math.min(tx.quantity / existing.quantity, 1);
          existing.quantity -= tx.quantity;
          existing.costBasis -= existing.costBasis * sellRatio;
        }
        break;
    }

    // Check if position is now closed
    if (existing.quantity <= 0.0001 && existing.transactions.length > 0) {
      // Calculate closed position details
      const closedPosition = calculateClosedPosition(symbol, existing.transactions);
      if (closedPosition) {
        closedPositions.push(closedPosition);
      }
      // Reset for potential future purchases of same symbol
      holdingsMap.set(symbol, {
        quantity: 0,
        costBasis: 0,
        transactions: [],
        firstBuyDate: null,
      });
    } else {
      holdingsMap.set(symbol, existing);
    }
  }

  // Convert remaining holdings to output format
  const currentHoldings = new Map<string, Holding>();
  for (const [symbol, data] of holdingsMap) {
    if (data.quantity > 0.0001) {
      currentHoldings.set(symbol, {
        symbol,
        quantity: data.quantity,
        costBasis: data.costBasis,
        avgCost: data.costBasis / data.quantity,
      });
    }
  }

  // Calculate totals
  const totalRealizedGain = closedPositions.reduce((sum, cp) => sum + cp.realizedGain, 0);
  const totalRealizedGainLongTerm = closedPositions
    .filter(cp => cp.isLongTerm)
    .reduce((sum, cp) => sum + cp.realizedGain, 0);
  const totalRealizedGainShortTerm = closedPositions
    .filter(cp => !cp.isLongTerm)
    .reduce((sum, cp) => sum + cp.realizedGain, 0);

  return {
    currentHoldings,
    closedPositions,
    totalRealizedGain,
    totalRealizedGainLongTerm,
    totalRealizedGainShortTerm,
  };
}

/**
 * Calculate details for a closed position from its transactions
 */
function calculateClosedPosition(symbol: string, transactions: Transaction[]): ClosedPosition | null {
  if (transactions.length === 0) return null;

  let totalSharesBought = 0;
  let totalSharesSold = 0;
  let totalCostBasis = 0;
  let totalProceeds = 0;
  let totalFees = 0;
  let firstBuyDate: Date | null = null;
  let lastSellDate: Date | null = null;

  for (const tx of transactions) {
    totalFees += tx.fees;

    switch (tx.type) {
      case 'BUY':
      case 'TRANSFER_IN':
        totalSharesBought += tx.quantity;
        totalCostBasis += tx.amount + tx.fees;
        if (!firstBuyDate) {
          firstBuyDate = new Date(tx.date);
        }
        break;

      case 'SELL':
      case 'TRANSFER_OUT':
        totalSharesSold += tx.quantity;
        totalProceeds += tx.amount - tx.fees;
        lastSellDate = new Date(tx.date);
        break;
    }
  }

  if (!firstBuyDate || !lastSellDate) return null;

  const realizedGain = totalProceeds - totalCostBasis;
  const realizedGainPercent = totalCostBasis > 0 ? (realizedGain / totalCostBasis) * 100 : 0;
  const holdingPeriodDays = Math.floor(
    (lastSellDate.getTime() - firstBuyDate.getTime()) / (1000 * 60 * 60 * 24)
  );
  const isLongTerm = holdingPeriodDays > 365;

  return {
    symbol,
    totalSharesBought,
    totalSharesSold,
    totalCostBasis,
    totalProceeds,
    totalFees,
    realizedGain,
    realizedGainPercent,
    firstBuyDate,
    lastSellDate,
    holdingPeriodDays,
    isLongTerm,
    transactions,
  };
}

/**
 * Format closed positions for AI context
 */
export function formatClosedPositionsForAI(closedPositions: ClosedPosition[]): string {
  if (closedPositions.length === 0) {
    return 'No closed positions (no fully sold holdings)';
  }

  return closedPositions.map(cp => {
    const gainLabel = cp.realizedGain >= 0 ? 'Gain' : 'Loss';
    const termLabel = cp.isLongTerm ? 'Long-term' : 'Short-term';
    const firstBuy = cp.firstBuyDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    const lastSell = cp.lastSellDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

    return `${cp.symbol}: CLOSED POSITION
  - Shares: Bought ${cp.totalSharesBought.toFixed(4)}, Sold ${cp.totalSharesSold.toFixed(4)}
  - Cost Basis: $${cp.totalCostBasis.toFixed(2)}, Proceeds: $${cp.totalProceeds.toFixed(2)}
  - Realized ${gainLabel}: ${cp.realizedGain >= 0 ? '+' : ''}$${cp.realizedGain.toFixed(2)} (${cp.realizedGainPercent >= 0 ? '+' : ''}${cp.realizedGainPercent.toFixed(2)}%)
  - Holding Period: ${firstBuy} to ${lastSell} (${cp.holdingPeriodDays} days, ${termLabel})`;
  }).join('\n\n');
}

export interface ClosedPositionExport {
  symbol: string;
  status: string;
  sharesBought: number;
  sharesSold: number;
  costBasis: number;
  proceeds: number;
  fees: number;
  realizedGain: number;
  realizedGainPercent: number;
  firstBuyDate: string;
  lastSellDate: string;
  holdingPeriodDays: number;
  taxTreatment: string;
}

/**
 * Format closed positions for export
 */
export function formatClosedPositionsForExport(closedPositions: ClosedPosition[]): ClosedPositionExport[] {
  return closedPositions.map(cp => ({
    symbol: cp.symbol,
    status: 'CLOSED',
    sharesBought: cp.totalSharesBought,
    sharesSold: cp.totalSharesSold,
    costBasis: cp.totalCostBasis,
    proceeds: cp.totalProceeds,
    fees: cp.totalFees,
    realizedGain: cp.realizedGain,
    realizedGainPercent: cp.realizedGainPercent,
    firstBuyDate: cp.firstBuyDate.toISOString().split('T')[0],
    lastSellDate: cp.lastSellDate.toISOString().split('T')[0],
    holdingPeriodDays: cp.holdingPeriodDays,
    taxTreatment: cp.isLongTerm ? 'Long-term Capital Gain' : 'Short-term Capital Gain',
  }));
}
