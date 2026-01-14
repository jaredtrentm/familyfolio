import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import prisma from '@/lib/db';
import yahooFinance from 'yahoo-finance2';

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

// Generate date points based on period - returns actual dates to use
function generateDatePoints(startDate: Date, endDate: Date, period: TimePeriod): Date[] {
  const points: Date[] = [];
  const start = new Date(startDate);
  const end = new Date(endDate);

  switch (period) {
    case '1D':
      // Hourly points
      for (let d = new Date(start); d <= end; d.setHours(d.getHours() + 1)) {
        points.push(new Date(d));
      }
      break;

    case '1W':
      // Daily points
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        points.push(new Date(d));
      }
      break;

    case '1M':
      // Every 2-3 days
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 2)) {
        points.push(new Date(d));
      }
      break;

    case '3M':
      // Weekly points
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 7)) {
        points.push(new Date(d));
      }
      break;

    case 'YTD':
      // Weekly points for YTD to show better trend
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 7)) {
        points.push(new Date(d));
      }
      break;

    case '1Y':
      // Monthly points - one per month
      const currentMonth = end.getMonth();
      const startMonth = start.getMonth();
      const startYear = start.getFullYear();
      const endYear = end.getFullYear();

      for (let year = startYear; year <= endYear; year++) {
        const monthStart = (year === startYear) ? startMonth : 0;
        const monthEnd = (year === endYear) ? currentMonth : 11;

        for (let month = monthStart; month <= monthEnd; month++) {
          // Use mid-month for the data point
          points.push(new Date(year, month, 15));
        }
      }
      break;

    case '5Y':
      // Quarterly points
      for (let d = new Date(start); d <= end; d.setMonth(d.getMonth() + 3)) {
        points.push(new Date(d));
      }
      break;

    case 'MAX':
    default:
      // Yearly points
      for (let d = new Date(start); d <= end; d.setFullYear(d.getFullYear() + 1)) {
        points.push(new Date(d));
      }
      // Always include current date
      if (points.length === 0 || points[points.length - 1].getTime() < end.getTime() - 30 * 24 * 60 * 60 * 1000) {
        points.push(new Date(end));
      }
      break;
  }

  // Always include the end date if not already there
  if (points.length > 0 && points[points.length - 1].getTime() < end.getTime() - 24 * 60 * 60 * 1000) {
    points.push(new Date(end));
  }

  return points;
}

function formatDateLabel(date: Date, period: TimePeriod): string {
  switch (period) {
    case '1D':
      return date.toLocaleTimeString('en-US', { hour: 'numeric', hour12: true });
    case '1W':
      return date.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric' });
    case '1M':
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    case '3M':
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    case 'YTD':
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    case '1Y':
      return date.toLocaleDateString('en-US', { month: 'short' });
    case '5Y':
      const quarter = Math.floor(date.getMonth() / 3) + 1;
      return `Q${quarter} '${date.getFullYear().toString().slice(-2)}`;
    case 'MAX':
    default:
      return date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
  }
}

// Type for yahoo-finance2 chart response
interface ChartQuote {
  date: Date;
  close: number | null;
  open?: number | null;
  high?: number | null;
  low?: number | null;
  volume?: number | null;
}

interface ChartResult {
  quotes: ChartQuote[];
  meta?: {
    currency?: string;
    symbol?: string;
  };
}

// Fetch historical prices for a symbol
async function getHistoricalPrices(
  symbol: string,
  startDate: Date,
  endDate: Date
): Promise<Map<string, number>> {
  const priceMap = new Map<string, number>();

  try {
    const result = await yahooFinance.chart(symbol, {
      period1: startDate,
      period2: endDate,
      interval: '1d',
    }) as ChartResult | null;

    if (result && result.quotes) {
      for (const quote of result.quotes) {
        if (quote.date && quote.close) {
          // Store by date string for easy lookup
          const dateKey = quote.date.toISOString().split('T')[0];
          priceMap.set(dateKey, quote.close);
        }
      }
    }
  } catch (error) {
    console.log(`[Portfolio History] Could not fetch history for ${symbol}:`, error instanceof Error ? error.message : 'Unknown');
  }

  return priceMap;
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

    // Get all transactions for this user ordered by date
    const transactions = await prisma.transaction.findMany({
      where: { claimedById: session.id },
      orderBy: { date: 'asc' },
    });

    if (transactions.length === 0) {
      return NextResponse.json({ history: [], period });
    }

    // Get unique symbols
    const symbols = [...new Set(transactions.map((tx) => tx.symbol.toUpperCase().trim()))];

    // Calculate date range
    const firstTxDate = new Date(Math.min(...transactions.map((tx) => tx.date.getTime())));
    const effectiveStartDate = firstTxDate > startDate ? firstTxDate : startDate;
    const now = new Date();

    // Generate date points based on period
    const datePoints = generateDatePoints(effectiveStartDate, now, period);

    // Fetch historical prices for each symbol
    const historicalPrices = new Map<string, Map<string, number>>();
    for (const symbol of symbols) {
      const prices = await getHistoricalPrices(symbol, effectiveStartDate, now);
      historicalPrices.set(symbol, prices);
    }

    // Get current prices from cache as fallback
    const stockCache = await prisma.stockCache.findMany({
      where: { symbol: { in: symbols } },
    });
    const currentPriceMap = new Map(stockCache.map((s) => [s.symbol.toUpperCase().trim(), s.currentPrice || 0]));

    const history: { date: string; value: number; costBasis: number }[] = [];

    for (const pointDate of datePoints) {
      // Calculate holdings at this date
      const holdingsMap = new Map<string, { quantity: number; costBasis: number }>();

      for (const tx of transactions) {
        if (tx.date > pointDate) break;

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

      // Calculate total value using historical prices
      let totalValue = 0;
      let totalCostBasis = 0;
      const dateKey = pointDate.toISOString().split('T')[0];

      for (const [symbol, holding] of holdingsMap) {
        const symbolHistory = historicalPrices.get(symbol);
        let price: number;

        // Try to find historical price for this date (or closest date before)
        if (symbolHistory && symbolHistory.size > 0) {
          price = symbolHistory.get(dateKey) || 0;

          // If no exact match, find closest earlier date
          if (price === 0) {
            const sortedDates = Array.from(symbolHistory.keys()).sort();
            for (const d of sortedDates.reverse()) {
              if (d <= dateKey) {
                price = symbolHistory.get(d) || 0;
                break;
              }
            }
          }
        } else {
          price = 0;
        }

        // Fall back to current price or avg cost
        if (price === 0) {
          price = currentPriceMap.get(symbol) || holding.costBasis / holding.quantity;
        }

        totalValue += holding.quantity * price;
        totalCostBasis += holding.costBasis;
      }

      const dateLabel = formatDateLabel(pointDate, period);

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
