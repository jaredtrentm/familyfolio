/**
 * Rebalancing Calculator
 * Calculates portfolio variance from targets and provides actionable suggestions
 */

export interface RebalanceTarget {
  id: string;
  targetType: 'SYMBOL' | 'SECTOR' | 'ASSET_TYPE';
  identifier: string;
  targetPercent: number;
}

export interface PortfolioPosition {
  identifier: string;
  currentValue: number;
  currentPercent: number;
}

export interface RebalanceAdvice {
  identifier: string;
  currentPercent: number;
  targetPercent: number;
  variance: number;
  action: 'BUY' | 'SELL' | 'HOLD';
  dollarAmount: number;
  shares?: number;
  currentPrice?: number;
}

export interface RebalanceAnalysis {
  totalValue: number;
  advice: RebalanceAdvice[];
  isBalanced: boolean;
  maxVariance: number;
  summary: {
    toBuy: RebalanceAdvice[];
    toSell: RebalanceAdvice[];
    onTarget: RebalanceAdvice[];
  };
}

const TOLERANCE_PERCENT = 2; // Consider "on target" if within 2%

/**
 * Analyze portfolio against targets and provide rebalancing advice
 */
export function analyzeRebalancing(
  positions: PortfolioPosition[],
  targets: RebalanceTarget[],
  totalValue: number,
  priceMap?: Map<string, number>
): RebalanceAnalysis {
  const advice: RebalanceAdvice[] = [];
  let maxVariance = 0;

  // Create a map of current allocations
  const currentMap = new Map<string, PortfolioPosition>();
  for (const pos of positions) {
    currentMap.set(pos.identifier.toUpperCase(), pos);
  }

  // Process each target
  for (const target of targets) {
    const identifier = target.identifier.toUpperCase();
    const current = currentMap.get(identifier);

    const currentPercent = current?.currentPercent || 0;
    const targetPercent = target.targetPercent;
    const variance = currentPercent - targetPercent;
    const absVariance = Math.abs(variance);

    if (absVariance > maxVariance) {
      maxVariance = absVariance;
    }

    // Calculate dollar amount needed to reach target
    const targetValue = (targetPercent / 100) * totalValue;
    const currentValue = current?.currentValue || 0;
    const dollarDiff = targetValue - currentValue;

    let action: 'BUY' | 'SELL' | 'HOLD' = 'HOLD';
    if (variance < -TOLERANCE_PERCENT) {
      action = 'BUY';
    } else if (variance > TOLERANCE_PERCENT) {
      action = 'SELL';
    }

    const adviceItem: RebalanceAdvice = {
      identifier,
      currentPercent,
      targetPercent,
      variance,
      action,
      dollarAmount: Math.abs(dollarDiff),
    };

    // If we have price data, calculate shares
    if (priceMap && target.targetType === 'SYMBOL') {
      const price = priceMap.get(identifier);
      if (price && price > 0) {
        adviceItem.currentPrice = price;
        adviceItem.shares = Math.abs(dollarDiff / price);
      }
    }

    advice.push(adviceItem);
  }

  // Sort by absolute variance (most off-target first)
  advice.sort((a, b) => Math.abs(b.variance) - Math.abs(a.variance));

  // Separate into categories
  const toBuy = advice.filter(a => a.action === 'BUY');
  const toSell = advice.filter(a => a.action === 'SELL');
  const onTarget = advice.filter(a => a.action === 'HOLD');

  return {
    totalValue,
    advice,
    isBalanced: maxVariance <= TOLERANCE_PERCENT,
    maxVariance,
    summary: {
      toBuy,
      toSell,
      onTarget,
    },
  };
}

/**
 * Calculate sector allocation from holdings
 */
export function calculateSectorAllocation(
  holdings: Array<{ symbol: string; currentValue: number; sector: string }>,
  totalValue: number
): PortfolioPosition[] {
  const sectorMap = new Map<string, number>();

  for (const h of holdings) {
    const sector = h.sector || 'Unknown';
    sectorMap.set(sector, (sectorMap.get(sector) || 0) + h.currentValue);
  }

  return Array.from(sectorMap.entries()).map(([identifier, value]) => ({
    identifier,
    currentValue: value,
    currentPercent: totalValue > 0 ? (value / totalValue) * 100 : 0,
  }));
}

/**
 * Calculate asset type allocation from holdings
 */
export function calculateAssetTypeAllocation(
  holdings: Array<{ symbol: string; currentValue: number; assetType: string }>,
  totalValue: number,
  cashBalance: number = 0
): PortfolioPosition[] {
  const typeMap = new Map<string, number>();

  for (const h of holdings) {
    const assetType = h.assetType || 'Unknown';
    typeMap.set(assetType, (typeMap.get(assetType) || 0) + h.currentValue);
  }

  if (cashBalance > 0) {
    typeMap.set('Cash', (typeMap.get('Cash') || 0) + cashBalance);
  }

  return Array.from(typeMap.entries()).map(([identifier, value]) => ({
    identifier,
    currentValue: value,
    currentPercent: totalValue > 0 ? (value / totalValue) * 100 : 0,
  }));
}

/**
 * Calculate symbol-level allocation
 */
export function calculateSymbolAllocation(
  holdings: Array<{ symbol: string; currentValue: number }>,
  totalValue: number
): PortfolioPosition[] {
  return holdings.map(h => ({
    identifier: h.symbol.toUpperCase(),
    currentValue: h.currentValue,
    currentPercent: totalValue > 0 ? (h.currentValue / totalValue) * 100 : 0,
  }));
}

/**
 * Format advice as actionable text
 */
export function formatAdvice(advice: RebalanceAdvice, locale: string = 'en'): string {
  const actionText = {
    BUY: locale === 'zh' ? '买入' : 'Buy',
    SELL: locale === 'zh' ? '卖出' : 'Sell',
    HOLD: locale === 'zh' ? '持有' : 'Hold',
  };

  const action = actionText[advice.action];

  if (advice.action === 'HOLD') {
    return locale === 'zh'
      ? `${advice.identifier}: 保持不变 (${advice.currentPercent.toFixed(1)}%)`
      : `${advice.identifier}: On target (${advice.currentPercent.toFixed(1)}%)`;
  }

  const shareText = advice.shares
    ? locale === 'zh'
      ? ` (~${advice.shares.toFixed(2)} 股)`
      : ` (~${advice.shares.toFixed(2)} shares)`
    : '';

  return locale === 'zh'
    ? `${advice.identifier}: ${action} $${advice.dollarAmount.toFixed(0)}${shareText} 以达到 ${advice.targetPercent}% 目标`
    : `${advice.identifier}: ${action} $${advice.dollarAmount.toFixed(0)}${shareText} to reach ${advice.targetPercent}% target`;
}
