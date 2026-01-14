import { getTranslations, setRequestLocale } from 'next-intl/server';
import { getSession } from '@/lib/auth';
import prisma from '@/lib/db';
import { GainsClient } from './GainsClient';
import {
  calculatePortfolioFromTransactions,
  type Transaction as PortfolioTransaction,
  type ClosedPosition,
} from '@/lib/portfolio-utils';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'gains' });

  return {
    title: t('title'),
  };
}

interface RealizedGain {
  id: string;
  date: string;
  symbol: string;
  quantity: number;
  proceeds: number;
  costBasis: number;
  gain: number;
  gainPercent: number;
}

interface UnrealizedGain {
  symbol: string;
  name: string;
  quantity: number;
  currentPrice: number;
  currentValue: number;
  costBasis: number;
  gain: number;
  gainPercent: number;
}

async function getGainsData(userId: string) {
  // Get all claimed transactions for this user, ordered by date
  const transactions = await prisma.transaction.findMany({
    where: { claimedById: userId },
    orderBy: { date: 'asc' },
  });

  // Track lots for FIFO cost basis calculation
  const lots = new Map<string, { quantity: number; price: number; date: Date }[]>();
  const realizedGains: RealizedGain[] = [];

  // Process transactions chronologically
  for (const tx of transactions) {
    if (tx.type === 'BUY') {
      // Add to lots
      const symbolLots = lots.get(tx.symbol) || [];
      symbolLots.push({
        quantity: tx.quantity,
        price: tx.price,
        date: tx.date,
      });
      lots.set(tx.symbol, symbolLots);
    } else if (tx.type === 'SELL') {
      // Calculate realized gain using FIFO
      const symbolLots = lots.get(tx.symbol) || [];
      let remainingToSell = tx.quantity;
      let totalCostBasis = 0;

      while (remainingToSell > 0 && symbolLots.length > 0) {
        const lot = symbolLots[0];
        const sellFromLot = Math.min(remainingToSell, lot.quantity);

        totalCostBasis += sellFromLot * lot.price;
        lot.quantity -= sellFromLot;
        remainingToSell -= sellFromLot;

        if (lot.quantity <= 0.0001) {
          symbolLots.shift();
        }
      }

      const proceeds = tx.quantity * tx.price;
      const gain = proceeds - totalCostBasis;
      const gainPercent = totalCostBasis > 0 ? (gain / totalCostBasis) * 100 : 0;

      realizedGains.push({
        id: tx.id,
        date: tx.date.toISOString(),
        symbol: tx.symbol,
        quantity: tx.quantity,
        proceeds,
        costBasis: totalCostBasis,
        gain,
        gainPercent,
      });

      lots.set(tx.symbol, symbolLots);
    }
    // DIVIDEND doesn't affect lots
  }

  // Calculate current holdings for unrealized gains
  const holdingsMap = new Map<string, { quantity: number; costBasis: number }>();

  for (const [symbol, symbolLots] of lots) {
    let quantity = 0;
    let costBasis = 0;

    for (const lot of symbolLots) {
      quantity += lot.quantity;
      costBasis += lot.quantity * lot.price;
    }

    if (quantity > 0.0001) {
      holdingsMap.set(symbol, { quantity, costBasis });
    }
  }

  // Get current prices
  const symbols = Array.from(holdingsMap.keys());
  const stockCache = await prisma.stockCache.findMany({
    where: { symbol: { in: symbols } },
  });
  const priceMap = new Map(stockCache.map((s) => [s.symbol, s]));

  // Calculate unrealized gains
  const unrealizedGains: UnrealizedGain[] = [];

  for (const [symbol, holding] of holdingsMap) {
    const stock = priceMap.get(symbol);
    const currentPrice = stock?.currentPrice || holding.costBasis / holding.quantity;
    const currentValue = holding.quantity * currentPrice;
    const gain = currentValue - holding.costBasis;
    const gainPercent = holding.costBasis > 0 ? (gain / holding.costBasis) * 100 : 0;

    unrealizedGains.push({
      symbol,
      name: stock?.name || symbol,
      quantity: holding.quantity,
      currentPrice,
      currentValue,
      costBasis: holding.costBasis,
      gain,
      gainPercent,
    });
  }

  // Sort unrealized by gain amount descending
  unrealizedGains.sort((a, b) => Math.abs(b.gain) - Math.abs(a.gain));

  // Sort realized by date descending (most recent first)
  realizedGains.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  // Calculate closed positions (fully sold stocks) using the utility
  const portfolioTx: PortfolioTransaction[] = transactions.map(tx => ({
    id: tx.id,
    symbol: tx.symbol,
    type: tx.type,
    quantity: tx.quantity,
    price: tx.price,
    amount: tx.amount,
    fees: tx.fees,
    date: tx.date,
  }));

  const portfolioData = calculatePortfolioFromTransactions(portfolioTx);
  const closedPositions = portfolioData.closedPositions;

  // Sort closed positions by last sell date descending
  closedPositions.sort((a, b) => b.lastSellDate.getTime() - a.lastSellDate.getTime());

  // Calculate totals
  const totalRealizedGain = realizedGains.reduce((sum, r) => sum + r.gain, 0);
  const totalRealizedProceeds = realizedGains.reduce((sum, r) => sum + r.proceeds, 0);
  const totalRealizedCostBasis = realizedGains.reduce((sum, r) => sum + r.costBasis, 0);

  const totalUnrealizedGain = unrealizedGains.reduce((sum, u) => sum + u.gain, 0);
  const totalUnrealizedValue = unrealizedGains.reduce((sum, u) => sum + u.currentValue, 0);
  const totalUnrealizedCostBasis = unrealizedGains.reduce((sum, u) => sum + u.costBasis, 0);

  return {
    realizedGains,
    unrealizedGains,
    closedPositions,
    totalRealizedGain,
    totalRealizedProceeds,
    totalRealizedCostBasis,
    totalRealizedGainPercent: totalRealizedCostBasis > 0
      ? (totalRealizedGain / totalRealizedCostBasis) * 100
      : 0,
    totalUnrealizedGain,
    totalUnrealizedValue,
    totalUnrealizedCostBasis,
    totalUnrealizedGainPercent: totalUnrealizedCostBasis > 0
      ? (totalUnrealizedGain / totalUnrealizedCostBasis) * 100
      : 0,
    totalClosedPositionGain: portfolioData.totalRealizedGain,
    totalClosedPositionGainLongTerm: portfolioData.totalRealizedGainLongTerm,
    totalClosedPositionGainShortTerm: portfolioData.totalRealizedGainShortTerm,
  };
}

export default async function GainsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const session = await getSession();
  if (!session) {
    return null;
  }

  const data = await getGainsData(session.id);

  // Serialize closed positions for client component
  const serializedClosedPositions = data.closedPositions.map(cp => ({
    symbol: cp.symbol,
    totalSharesBought: cp.totalSharesBought,
    totalSharesSold: cp.totalSharesSold,
    totalCostBasis: cp.totalCostBasis,
    totalProceeds: cp.totalProceeds,
    totalFees: cp.totalFees,
    realizedGain: cp.realizedGain,
    realizedGainPercent: cp.realizedGainPercent,
    firstBuyDate: cp.firstBuyDate.toISOString(),
    lastSellDate: cp.lastSellDate.toISOString(),
    holdingPeriodDays: cp.holdingPeriodDays,
    isLongTerm: cp.isLongTerm,
  }));

  return (
    <GainsClient
      {...data}
      closedPositions={serializedClosedPositions}
      locale={locale}
    />
  );
}
