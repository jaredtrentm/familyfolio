import { getTranslations, setRequestLocale } from 'next-intl/server';
import { getSession } from '@/lib/auth';
import prisma from '@/lib/db';
import { DashboardClient } from '@/components/dashboard/DashboardClient';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'dashboard' });

  return {
    title: t('title'),
  };
}

async function getDashboardData(userId: string) {
  // Get all claimed transactions for this user
  const transactions = await prisma.transaction.findMany({
    where: { claimedById: userId },
    orderBy: { date: 'desc' },
  });

  // Calculate holdings by aggregating transactions
  const holdingsMap = new Map<
    string,
    { symbol: string; quantity: number; costBasis: number }
  >();

  for (const tx of transactions) {
    const existing = holdingsMap.get(tx.symbol) || {
      symbol: tx.symbol,
      quantity: 0,
      costBasis: 0,
    };

    switch (tx.type) {
      case 'BUY':
        existing.quantity += tx.quantity;
        existing.costBasis += tx.amount + tx.fees;
        break;
      case 'SELL':
        if (existing.quantity > 0) {
          const sellRatio = Math.min(tx.quantity / existing.quantity, 1);
          existing.quantity -= tx.quantity;
          existing.costBasis -= existing.costBasis * sellRatio;
        }
        break;
      case 'DIVIDEND':
        // Dividends don't affect holdings quantity
        break;
    }

    if (existing.quantity > 0.0001) {
      holdingsMap.set(tx.symbol, existing);
    } else {
      holdingsMap.delete(tx.symbol);
    }
  }

  // Get current prices from cache
  const symbols = Array.from(holdingsMap.keys());
  const stockCache = await prisma.stockCache.findMany({
    where: { symbol: { in: symbols } },
  });

  const priceMap = new Map(stockCache.map((s) => [s.symbol, s]));

  // Calculate holdings with current values
  const holdings = Array.from(holdingsMap.values()).map((h) => {
    const stock = priceMap.get(h.symbol);
    const currentPrice = stock?.currentPrice || h.costBasis / h.quantity;
    const currentValue = h.quantity * currentPrice;
    const gainLoss = currentValue - h.costBasis;
    const gainLossPercent = h.costBasis > 0 ? (gainLoss / h.costBasis) * 100 : 0;
    const dayChange = stock?.dayChange || 0;
    const dayChangePercent = stock?.dayChangePercent || 0;

    return {
      symbol: h.symbol,
      name: stock?.name || h.symbol,
      quantity: h.quantity,
      costBasis: h.costBasis,
      currentPrice,
      currentValue,
      gainLoss,
      gainLossPercent,
      dayChange: dayChange * h.quantity,
      dayChangePercent,
      sector: stock?.sector || 'Unknown',
    };
  });

  // Sort by current value descending
  holdings.sort((a, b) => b.currentValue - a.currentValue);

  // Calculate totals
  const totalValue = holdings.reduce((sum, h) => sum + h.currentValue, 0);
  const totalCostBasis = holdings.reduce((sum, h) => sum + h.costBasis, 0);
  const totalGainLoss = totalValue - totalCostBasis;
  const totalDayChange = holdings.reduce((sum, h) => sum + h.dayChange, 0);

  // Calculate allocation by sector
  const sectorAllocation = holdings.reduce(
    (acc, h) => {
      const sector = h.sector || 'Unknown';
      acc[sector] = (acc[sector] || 0) + h.currentValue;
      return acc;
    },
    {} as Record<string, number>
  );

  return {
    holdings,
    totalValue,
    totalCostBasis,
    totalGainLoss,
    totalGainLossPercent: totalCostBasis > 0 ? (totalGainLoss / totalCostBasis) * 100 : 0,
    totalDayChange,
    totalDayChangePercent: totalValue > 0 ? (totalDayChange / totalValue) * 100 : 0,
    sectorAllocation,
  };
}

export default async function DashboardPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'dashboard' });

  const session = await getSession();
  if (!session) {
    return null;
  }

  const data = await getDashboardData(session.id);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
        {t('title')}
      </h1>

      <DashboardClient
        holdings={data.holdings}
        locale={locale}
        noHoldingsMessage={t('noHoldings')}
      />
    </div>
  );
}
