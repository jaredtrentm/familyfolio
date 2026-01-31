import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { fetchStockData } from '@/lib/stock-data';
import prisma from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const symbol = searchParams.get('symbol') || 'AAPL';

    console.log(`[Debug Stock Test] Testing symbol: ${symbol}`);

    const results: Record<string, unknown> = {
      symbol,
      timestamp: new Date().toISOString(),
    };

    // Test 1: Direct fetch from stock-data library
    try {
      console.log('[Debug Stock Test] Calling fetchStockData...');
      const startTime = Date.now();
      const data = await fetchStockData(symbol);
      const duration = Date.now() - startTime;

      results.fetchStockData = {
        success: !!data,
        duration: `${duration}ms`,
        data: data ? {
          symbol: data.symbol,
          name: data.name,
          currentPrice: data.currentPrice,
          dayChange: data.dayChange,
          dayChangePercent: data.dayChangePercent,
          sector: data.sector,
          peRatio: data.peRatio,
          targetPrice: data.targetPrice,
          earningsDate: data.earningsDate,
          beta: data.beta,
        } : null,
      };
    } catch (error) {
      results.fetchStockData = {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }

    // Test 2: Check what's in the cache
    try {
      const cached = await prisma.stockCache.findUnique({
        where: { symbol: symbol.toUpperCase() },
      });

      results.cache = {
        found: !!cached,
        data: cached ? {
          symbol: cached.symbol,
          name: cached.name,
          currentPrice: cached.currentPrice,
          sector: cached.sector,
          peRatio: cached.peRatio,
          targetPrice: cached.targetPrice,
          updatedAt: cached.updatedAt,
        } : null,
      };
    } catch (error) {
      results.cache = {
        found: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }

    // Test 3: Check user's watchlist
    try {
      const watchlist = await prisma.watchlistItem.findMany({
        where: { userId: session.id },
        select: { symbol: true },
      });

      results.userWatchlist = watchlist.map(w => w.symbol);
    } catch (error) {
      results.userWatchlist = {
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }

    return NextResponse.json(results);
  } catch (error) {
    console.error('[Debug Stock Test] Error:', error);
    return NextResponse.json(
      { error: 'Test failed', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
}
