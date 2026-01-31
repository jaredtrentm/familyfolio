import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import prisma from '@/lib/db';
import { fetchStockData, fetchMultipleStocks, type StockQuote } from '@/lib/stock-data';

// Cache stock data to database
async function cacheStockData(data: StockQuote) {
  return prisma.stockCache.upsert({
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
      fiftyTwoWeekHigh: data.fiftyTwoWeekHigh,
      fiftyTwoWeekLow: data.fiftyTwoWeekLow,
      peRatio: data.peRatio,
      dividendYield: data.dividendYield,
      volume: data.volume,
      averageVolume: data.averageVolume,
      targetPrice: data.targetPrice,
      earningsDate: data.earningsDate,
      beta: data.beta,
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
      fiftyTwoWeekHigh: data.fiftyTwoWeekHigh,
      fiftyTwoWeekLow: data.fiftyTwoWeekLow,
      peRatio: data.peRatio,
      dividendYield: data.dividendYield,
      volume: data.volume,
      averageVolume: data.averageVolume,
      targetPrice: data.targetPrice,
      earningsDate: data.earningsDate,
      beta: data.beta,
    },
  });
}

// Fetch and cache stock data for a symbol
async function fetchAndCacheStockData(symbol: string) {
  const normalizedSymbol = symbol.toUpperCase().trim();

  try {
    console.log(`[Watchlist API] Fetching stock data for ${normalizedSymbol}...`);

    const data = await fetchStockData(normalizedSymbol);

    if (data) {
      const cached = await cacheStockData(data);
      console.log(`[Watchlist API] Cached ${normalizedSymbol}: price=$${cached.currentPrice}, PE=${cached.peRatio}, target=$${cached.targetPrice}`);
      return cached;
    }
  } catch (error) {
    console.error(`[Watchlist API] Failed to fetch stock data for ${normalizedSymbol}:`, error instanceof Error ? error.message : 'Unknown');
  }

  return null;
}

// Get watchlist items
export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const watchlist = await prisma.watchlistItem.findMany({
      where: { userId: session.id },
      orderBy: { addedAt: 'desc' },
    });

    if (watchlist.length === 0) {
      return NextResponse.json({ watchlist: [] });
    }

    // Get current prices for the symbols
    const symbols = watchlist.map(w => w.symbol);
    let stockData = await prisma.stockCache.findMany({
      where: { symbol: { in: symbols } },
      select: {
        symbol: true,
        name: true,
        currentPrice: true,
        dayChange: true,
        dayChangePercent: true,
        sector: true,
        marketCap: true,
        fiftyTwoWeekHigh: true,
        fiftyTwoWeekLow: true,
        peRatio: true,
        dividendYield: true,
        volume: true,
        averageVolume: true,
        targetPrice: true,
        earningsDate: true,
        beta: true,
        updatedAt: true,
      },
    });

    // Find symbols that are missing from cache or have stale data
    const cacheThreshold = new Date(Date.now() - 15 * 60 * 1000);
    const cachedSymbols = new Set(stockData.map(s => s.symbol));
    const staleSymbols = stockData
      .filter(s => s.updatedAt < cacheThreshold)
      .map(s => s.symbol);
    const missingSymbols = symbols.filter(s => !cachedSymbols.has(s));
    const symbolsToFetch = [...new Set([...missingSymbols, ...staleSymbols])];

    // Fetch fresh data for missing/stale symbols
    if (symbolsToFetch.length > 0) {
      console.log(`[Watchlist API] Fetching fresh data for ${symbolsToFetch.length} symbols:`, symbolsToFetch);

      // Use the batch fetcher which handles retries and fallbacks
      const freshData = await fetchMultipleStocks(symbolsToFetch.slice(0, 10));

      // Cache all fetched data
      for (const [, data] of freshData) {
        await cacheStockData(data);
      }

      // Re-fetch from cache after updates
      stockData = await prisma.stockCache.findMany({
        where: { symbol: { in: symbols } },
        select: {
          symbol: true,
          name: true,
          currentPrice: true,
          dayChange: true,
          dayChangePercent: true,
          sector: true,
          marketCap: true,
          fiftyTwoWeekHigh: true,
          fiftyTwoWeekLow: true,
          peRatio: true,
          dividendYield: true,
          volume: true,
          averageVolume: true,
          targetPrice: true,
          earningsDate: true,
          beta: true,
          updatedAt: true,
        },
      });
    }

    const stockMap = new Map(stockData.map(s => [s.symbol, s]));

    return NextResponse.json({
      watchlist: watchlist.map(item => {
        const stock = stockMap.get(item.symbol);
        return {
          ...item,
          addedAt: item.addedAt.toISOString(),
          name: stock?.name || null,
          currentPrice: stock?.currentPrice || null,
          dayChange: stock?.dayChange || null,
          dayChangePercent: stock?.dayChangePercent || null,
          sector: stock?.sector || null,
          marketCap: stock?.marketCap || null,
          fiftyTwoWeekHigh: stock?.fiftyTwoWeekHigh || null,
          fiftyTwoWeekLow: stock?.fiftyTwoWeekLow || null,
          peRatio: stock?.peRatio || null,
          dividendYield: stock?.dividendYield || null,
          volume: stock?.volume || null,
          averageVolume: stock?.averageVolume || null,
          targetPrice: stock?.targetPrice || null,
          earningsDate: stock?.earningsDate?.toISOString() || null,
          beta: stock?.beta || null,
        };
      }),
    });
  } catch (error) {
    console.error('[Watchlist API] Error:', error);
    return NextResponse.json({ error: 'Failed to fetch watchlist' }, { status: 500 });
  }
}

// Add to watchlist
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { symbol, notes } = body;

    if (!symbol) {
      return NextResponse.json({ error: 'Symbol is required' }, { status: 400 });
    }

    const normalizedSymbol = symbol.toUpperCase().trim();

    // Check if already in watchlist
    const existing = await prisma.watchlistItem.findUnique({
      where: {
        userId_symbol: {
          userId: session.id,
          symbol: normalizedSymbol,
        },
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: 'Symbol already in watchlist' },
        { status: 400 }
      );
    }

    const item = await prisma.watchlistItem.create({
      data: {
        userId: session.id,
        symbol: normalizedSymbol,
        notes: notes || null,
      },
    });

    // Fetch and cache stock info
    let stockInfo = await prisma.stockCache.findUnique({
      where: { symbol: normalizedSymbol },
    });

    // If not in cache or cache is stale (older than 15 minutes), fetch fresh data
    const cacheThreshold = new Date(Date.now() - 15 * 60 * 1000);
    if (!stockInfo || stockInfo.updatedAt < cacheThreshold) {
      const freshData = await fetchAndCacheStockData(normalizedSymbol);
      if (freshData) {
        stockInfo = freshData;
      }
    }

    return NextResponse.json({
      item: {
        ...item,
        addedAt: item.addedAt.toISOString(),
        name: stockInfo?.name || null,
        currentPrice: stockInfo?.currentPrice || null,
        dayChange: stockInfo?.dayChange || null,
        dayChangePercent: stockInfo?.dayChangePercent || null,
        sector: stockInfo?.sector || null,
      },
    });
  } catch (error) {
    console.error('[Watchlist API] Error:', error);
    return NextResponse.json({ error: 'Failed to add to watchlist' }, { status: 500 });
  }
}

// Update watchlist item (notes)
export async function PUT(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { id, notes } = body;

    if (!id) {
      return NextResponse.json({ error: 'Item ID is required' }, { status: 400 });
    }

    // Verify ownership
    const item = await prisma.watchlistItem.findUnique({
      where: { id },
    });

    if (!item || item.userId !== session.id) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 });
    }

    const updated = await prisma.watchlistItem.update({
      where: { id },
      data: { notes: notes || null },
    });

    return NextResponse.json({
      item: {
        ...updated,
        addedAt: updated.addedAt.toISOString(),
      },
    });
  } catch (error) {
    console.error('[Watchlist API] Error:', error);
    return NextResponse.json({ error: 'Failed to update item' }, { status: 500 });
  }
}

// Remove from watchlist
export async function DELETE(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const symbol = searchParams.get('symbol');

    if (!id && !symbol) {
      return NextResponse.json({ error: 'ID or symbol is required' }, { status: 400 });
    }

    if (id) {
      // Verify ownership
      const item = await prisma.watchlistItem.findUnique({
        where: { id },
      });

      if (!item || item.userId !== session.id) {
        return NextResponse.json({ error: 'Item not found' }, { status: 404 });
      }

      await prisma.watchlistItem.delete({
        where: { id },
      });
    } else if (symbol) {
      await prisma.watchlistItem.deleteMany({
        where: {
          userId: session.id,
          symbol: symbol.toUpperCase(),
        },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Watchlist API] Error:', error);
    return NextResponse.json({ error: 'Failed to remove from watchlist' }, { status: 500 });
  }
}
