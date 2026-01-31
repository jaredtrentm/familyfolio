import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import prisma from '@/lib/db';
import YahooFinance from 'yahoo-finance2';

const yahooFinance = new YahooFinance();

// Fetch and cache stock data for a symbol
async function fetchAndCacheStockData(symbol: string) {
  const normalizedSymbol = symbol.toUpperCase().trim();

  try {
    const quote = await yahooFinance.quote(normalizedSymbol);

    if (quote && typeof quote === 'object') {
      const q = quote as {
        shortName?: string;
        longName?: string;
        regularMarketPrice?: number;
        regularMarketChange?: number;
        regularMarketChangePercent?: number;
        regularMarketPreviousClose?: number;
        marketCap?: number;
      };

      let sector: string | null = null;
      let industry: string | null = null;

      try {
        const summary = await yahooFinance.quoteSummary(normalizedSymbol, {
          modules: ['assetProfile'],
        });
        const summaryData = summary as { assetProfile?: { sector?: string; industry?: string } } | null;
        if (summaryData?.assetProfile) {
          sector = summaryData.assetProfile.sector || null;
          industry = summaryData.assetProfile.industry || null;
        }
      } catch {
        // Ignore profile errors
      }

      const cached = await prisma.stockCache.upsert({
        where: { symbol: normalizedSymbol },
        update: {
          name: q.shortName || q.longName || normalizedSymbol,
          currentPrice: q.regularMarketPrice || 0,
          dayChange: q.regularMarketChange || 0,
          dayChangePercent: q.regularMarketChangePercent || 0,
          previousClose: q.regularMarketPreviousClose || 0,
          marketCap: q.marketCap || null,
          sector,
          industry,
        },
        create: {
          symbol: normalizedSymbol,
          name: q.shortName || q.longName || normalizedSymbol,
          currentPrice: q.regularMarketPrice || 0,
          dayChange: q.regularMarketChange || 0,
          dayChangePercent: q.regularMarketChangePercent || 0,
          previousClose: q.regularMarketPreviousClose || 0,
          marketCap: q.marketCap || null,
          sector,
          industry,
        },
      });

      return cached;
    }
  } catch (error) {
    console.error(`[Alerts API] Failed to fetch stock data for ${normalizedSymbol}:`, error instanceof Error ? error.message : 'Unknown');
  }

  return null;
}

// Get all price alerts for the user
export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const alerts = await prisma.priceAlert.findMany({
      where: { userId: session.id },
      orderBy: [
        { isActive: 'desc' },
        { createdAt: 'desc' },
      ],
    });

    if (alerts.length === 0) {
      return NextResponse.json({ alerts: [] });
    }

    // Get current prices for the symbols
    const symbols: string[] = [...new Set(alerts.map((a: { symbol: string }) => a.symbol))];
    let stockData = await prisma.stockCache.findMany({
      where: { symbol: { in: symbols } },
      select: { symbol: true, currentPrice: true, name: true, updatedAt: true },
    });

    // Find symbols that need fresh data (missing or stale)
    const cacheThreshold = new Date(Date.now() - 15 * 60 * 1000);
    const cachedSymbols = new Set(stockData.map(s => s.symbol));
    const staleSymbols = stockData.filter(s => s.updatedAt < cacheThreshold).map(s => s.symbol);
    const missingSymbols = symbols.filter(s => !cachedSymbols.has(s));
    const symbolsToFetch = [...new Set([...missingSymbols, ...staleSymbols])];

    // Fetch fresh data for missing/stale symbols
    if (symbolsToFetch.length > 0) {
      console.log(`[Alerts API] Fetching fresh data for ${symbolsToFetch.length} symbols`);
      const fetchPromises = symbolsToFetch.slice(0, 5).map(symbol => fetchAndCacheStockData(symbol));
      await Promise.all(fetchPromises);

      // Re-fetch from cache
      stockData = await prisma.stockCache.findMany({
        where: { symbol: { in: symbols } },
        select: { symbol: true, currentPrice: true, name: true, updatedAt: true },
      });
    }

    const priceMap = new Map(stockData.map((s: { symbol: string; currentPrice: number | null; name: string | null }) => [s.symbol, s]));

    return NextResponse.json({
      alerts: alerts.map((alert: { id: string; symbol: string; targetPrice: number; condition: string; isActive: boolean; triggeredAt: Date | null; createdAt: Date }) => ({
        ...alert,
        triggeredAt: alert.triggeredAt?.toISOString() || null,
        createdAt: alert.createdAt.toISOString(),
        currentPrice: priceMap.get(alert.symbol)?.currentPrice || null,
        stockName: priceMap.get(alert.symbol)?.name || null,
      })),
    });
  } catch (error) {
    console.error('[Alerts API] Error:', error);
    return NextResponse.json({ error: 'Failed to fetch alerts' }, { status: 500 });
  }
}

// Create a new price alert
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { symbol, targetPrice, condition } = body;

    if (!symbol || !targetPrice || !condition) {
      return NextResponse.json(
        { error: 'Symbol, target price, and condition are required' },
        { status: 400 }
      );
    }

    if (!['ABOVE', 'BELOW'].includes(condition)) {
      return NextResponse.json(
        { error: 'Condition must be ABOVE or BELOW' },
        { status: 400 }
      );
    }

    // Check if user already has an active alert for this symbol/condition
    const existing = await prisma.priceAlert.findFirst({
      where: {
        userId: session.id,
        symbol: symbol.toUpperCase(),
        condition,
        isActive: true,
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: 'You already have an active alert for this condition' },
        { status: 400 }
      );
    }

    const alert = await prisma.priceAlert.create({
      data: {
        userId: session.id,
        symbol: symbol.toUpperCase(),
        targetPrice: Number(targetPrice),
        condition,
      },
    });

    return NextResponse.json({
      alert: {
        ...alert,
        triggeredAt: null,
        createdAt: alert.createdAt.toISOString(),
      },
    });
  } catch (error) {
    console.error('[Alerts API] Error:', error);
    return NextResponse.json({ error: 'Failed to create alert' }, { status: 500 });
  }
}

// Delete an alert
export async function DELETE(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const alertId = searchParams.get('id');

    if (!alertId) {
      return NextResponse.json({ error: 'Alert ID is required' }, { status: 400 });
    }

    // Verify ownership
    const alert = await prisma.priceAlert.findUnique({
      where: { id: alertId },
    });

    if (!alert || alert.userId !== session.id) {
      return NextResponse.json({ error: 'Alert not found' }, { status: 404 });
    }

    await prisma.priceAlert.delete({
      where: { id: alertId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Alerts API] Error:', error);
    return NextResponse.json({ error: 'Failed to delete alert' }, { status: 500 });
  }
}
