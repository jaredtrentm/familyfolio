import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import prisma from '@/lib/db';

type TimePeriod = '1D' | '1W' | '1M' | '3M' | 'YTD' | '1Y' | '5Y' | 'MAX';

function getStartDate(period: TimePeriod): Date {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  switch (period) {
    case '1D':
      return new Date(today.getTime() - 1 * 24 * 60 * 60 * 1000);
    case '1W':
      return new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    case '1M':
      return new Date(today.getFullYear(), today.getMonth() - 1, today.getDate());
    case '3M':
      return new Date(today.getFullYear(), today.getMonth() - 3, today.getDate());
    case 'YTD':
      return new Date(today.getFullYear(), 0, 1);
    case '1Y':
      return new Date(today.getFullYear() - 1, today.getMonth(), today.getDate());
    case '5Y':
      return new Date(today.getFullYear() - 5, today.getMonth(), today.getDate());
    case 'MAX':
    default:
      return new Date(2000, 0, 1);
  }
}

function getDataPoints(period: TimePeriod): number {
  switch (period) {
    case '1D':
      return 24;
    case '1W':
      return 7;
    case '1M':
      return 30;
    case '3M':
      return 90;
    case 'YTD':
    case '1Y':
      return 52;
    case '5Y':
      return 60;
    case 'MAX':
    default:
      return 100;
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const period = (searchParams.get('period') || '1M') as TimePeriod;
    const startDate = getStartDate(period);
    const dataPoints = getDataPoints(period);

    // Get all transactions for this user ordered by date
    const transactions = await prisma.transaction.findMany({
      where: { claimedById: session.id },
      orderBy: { date: 'asc' },
    });

    if (transactions.length === 0) {
      return NextResponse.json({ history: [], period });
    }

    // Get current stock prices for calculating current value
    // Normalize symbols to uppercase for consistent matching
    const symbols = [...new Set(transactions.map((tx) => tx.symbol.toUpperCase().trim()))];
    const stockCache = await prisma.stockCache.findMany({
      where: { symbol: { in: symbols } },
    });
    // Normalize cache keys for consistent matching
    const priceMap = new Map(stockCache.map((s) => [s.symbol.toUpperCase().trim(), s.currentPrice || 0]));

    // Calculate portfolio value at different points in time
    const firstTxDate = new Date(Math.min(...transactions.map((tx) => tx.date.getTime())));
    const effectiveStartDate = firstTxDate > startDate ? firstTxDate : startDate;
    const now = new Date();

    // Generate date points
    const dateRange = now.getTime() - effectiveStartDate.getTime();
    const interval = dateRange / dataPoints;

    const history: { date: string; value: number; costBasis: number }[] = [];

    for (let i = 0; i <= dataPoints; i++) {
      const pointDate = new Date(effectiveStartDate.getTime() + interval * i);

      // Calculate holdings at this date
      const holdingsMap = new Map<string, { quantity: number; costBasis: number }>();

      for (const tx of transactions) {
        if (tx.date > pointDate) break;

        // Normalize symbol to uppercase for consistent matching
        const normalizedSymbol = tx.symbol.toUpperCase().trim();
        const existing = holdingsMap.get(normalizedSymbol) || { quantity: 0, costBasis: 0 };

        switch (tx.type) {
          case 'BUY':
          case 'TRANSFER_IN':
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

        if (existing.quantity > 0.0001) {
          holdingsMap.set(normalizedSymbol, existing);
        } else {
          holdingsMap.delete(normalizedSymbol);
        }
      }

      // Calculate total value at this point
      // For historical points, we estimate value based on cost basis with growth factor
      // For current, we use actual prices
      let totalValue = 0;
      let totalCostBasis = 0;

      for (const [symbol, holding] of holdingsMap) {
        const currentPrice = priceMap.get(symbol) || holding.costBasis / holding.quantity;
        const avgCost = holding.costBasis / holding.quantity;

        // Interpolate between cost basis and current value based on time
        const timeFactor = (pointDate.getTime() - effectiveStartDate.getTime()) / dateRange;
        const estimatedPrice = avgCost + (currentPrice - avgCost) * timeFactor;

        totalValue += holding.quantity * estimatedPrice;
        totalCostBasis += holding.costBasis;
      }

      // Format date based on period
      let dateLabel: string;
      if (period === '1D') {
        dateLabel = pointDate.toLocaleTimeString('en-US', { hour: 'numeric' });
      } else if (period === '1W' || period === '1M') {
        dateLabel = pointDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      } else {
        dateLabel = pointDate.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
      }

      history.push({
        date: dateLabel,
        value: Math.abs(Math.round(totalValue * 100) / 100),
        costBasis: Math.abs(Math.round(totalCostBasis * 100) / 100),
      });
    }

    // Calculate summary statistics
    const startValue = history[0]?.value || 0;
    const endValue = history[history.length - 1]?.value || 0;
    const change = endValue - startValue;
    const changePercent = startValue > 0 ? (change / startValue) * 100 : 0;

    return NextResponse.json({
      history,
      period,
      summary: {
        startValue,
        endValue,
        change,
        changePercent,
      },
    });
  } catch (error) {
    console.error('[Portfolio History API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch portfolio history' },
      { status: 500 }
    );
  }
}
