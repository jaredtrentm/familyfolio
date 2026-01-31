import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import prisma from '@/lib/db';
import { fetchStockData, fetchMultipleStocks } from '@/lib/stock-data';

// Fetch and cache stock data for a symbol
async function fetchAndCacheStockData(symbol: string) {
  const normalizedSymbol = symbol.toUpperCase().trim();

  try {
    const data = await fetchStockData(normalizedSymbol);

    if (data) {
      const cached = await prisma.stockCache.upsert({
        where: { symbol: normalizedSymbol },
        update: {
          name: data.name,
          currentPrice: data.currentPrice,
          dayChange: data.dayChange,
          dayChangePercent: data.dayChangePercent,
          previousClose: data.previousClose,
          marketCap: data.marketCap,
          sector: data.sector,
          industry: data.industry,
        },
        create: {
          symbol: normalizedSymbol,
          name: data.name,
          currentPrice: data.currentPrice,
          dayChange: data.dayChange,
          dayChangePercent: data.dayChangePercent,
          previousClose: data.previousClose,
          marketCap: data.marketCap,
          sector: data.sector,
          industry: data.industry,
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
      const freshData = await fetchMultipleStocks(symbolsToFetch.slice(0, 10));

      // Cache all fetched data
      for (const [, data] of freshData) {
        await prisma.stockCache.upsert({
          where: { symbol: data.symbol },
          update: {
            name: data.name,
            currentPrice: data.currentPrice,
            dayChange: data.dayChange,
            dayChangePercent: data.dayChangePercent,
            previousClose: data.previousClose,
            marketCap: data.marketCap,
            sector: data.sector,
            industry: data.industry,
          },
          create: {
            symbol: data.symbol,
            name: data.name,
            currentPrice: data.currentPrice,
            dayChange: data.dayChange,
            dayChangePercent: data.dayChangePercent,
            previousClose: data.previousClose,
            marketCap: data.marketCap,
            sector: data.sector,
            industry: data.industry,
          },
        });
      }

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
