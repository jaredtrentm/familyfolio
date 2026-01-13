import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import prisma from '@/lib/db';
import yahooFinance from 'yahoo-finance2';

// Cache duration in minutes
const CACHE_DURATION = 15;

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const symbols = searchParams.get('symbols')?.split(',').filter(Boolean) || [];

    if (symbols.length === 0) {
      return NextResponse.json({ stocks: [] });
    }

    const stocks = await getStockData(symbols);

    return NextResponse.json({ stocks });
  } catch (error) {
    console.error('[Stocks API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch stock data' },
      { status: 500 }
    );
  }
}

// Update stock cache
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get all unique symbols from user's transactions
    const transactions = await prisma.transaction.findMany({
      where: { claimedById: session.id },
      select: { symbol: true },
      distinct: ['symbol'],
    });

    const symbols = transactions.map((tx) => tx.symbol);

    if (symbols.length === 0) {
      return NextResponse.json({ updated: 0 });
    }

    const stocks = await getStockData(symbols, true);

    return NextResponse.json({
      updated: stocks.length,
      stocks,
    });
  } catch (error) {
    console.error('[Stocks Update API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to update stock data' },
      { status: 500 }
    );
  }
}

async function getStockData(symbols: string[], forceRefresh = false) {
  const now = new Date();
  const cacheThreshold = new Date(now.getTime() - CACHE_DURATION * 60 * 1000);

  // Check cache first (unless force refresh)
  if (!forceRefresh) {
    const cached = await prisma.stockCache.findMany({
      where: {
        symbol: { in: symbols },
        updatedAt: { gte: cacheThreshold },
      },
    });

    if (cached.length === symbols.length) {
      return cached;
    }

    // Find which symbols need updating
    const cachedSymbols = new Set(cached.map((s) => s.symbol));
    symbols = symbols.filter((s) => !cachedSymbols.has(s));

    if (symbols.length === 0) {
      return cached;
    }
  }

  // Fetch from Yahoo Finance
  const results = [];

  for (const symbol of symbols) {
    try {
      const quote = await yahooFinance.quote(symbol) as {
        symbol?: string;
        shortName?: string;
        longName?: string;
        regularMarketPrice?: number;
        regularMarketChange?: number;
        regularMarketChangePercent?: number;
        regularMarketPreviousClose?: number;
        marketCap?: number;
      } | null;

      if (quote) {
        const stockData = {
          symbol: quote.symbol || symbol,
          name: quote.shortName || quote.longName || symbol,
          currentPrice: quote.regularMarketPrice || 0,
          dayChange: quote.regularMarketChange || 0,
          dayChangePercent: quote.regularMarketChangePercent || 0,
          previousClose: quote.regularMarketPreviousClose || 0,
          marketCap: quote.marketCap || null,
          sector: null as string | null,
          industry: null as string | null,
        };

        // Try to get sector/industry info from quoteSummary
        try {
          const summary = await yahooFinance.quoteSummary(symbol, {
            modules: ['assetProfile'],
          });
          // Type assertion for the summary response
          const summaryData = summary as { assetProfile?: { sector?: string; industry?: string } } | null;
          if (summaryData?.assetProfile) {
            stockData.sector = summaryData.assetProfile.sector || null;
            stockData.industry = summaryData.assetProfile.industry || null;
          }
        } catch (profileError) {
          console.log(`Could not fetch profile for ${symbol}:`, profileError instanceof Error ? profileError.message : 'Unknown error');
          // Profile not available for all stocks (e.g., ETFs, some foreign stocks)
        }

        // Upsert to cache
        await prisma.stockCache.upsert({
          where: { symbol },
          update: {
            name: stockData.name,
            currentPrice: stockData.currentPrice,
            dayChange: stockData.dayChange,
            dayChangePercent: stockData.dayChangePercent,
            previousClose: stockData.previousClose,
            marketCap: stockData.marketCap,
            sector: stockData.sector,
            industry: stockData.industry,
          },
          create: {
            symbol,
            name: stockData.name,
            currentPrice: stockData.currentPrice,
            dayChange: stockData.dayChange,
            dayChangePercent: stockData.dayChangePercent,
            previousClose: stockData.previousClose,
            marketCap: stockData.marketCap,
            sector: stockData.sector,
            industry: stockData.industry,
          },
        });

        results.push(stockData);
      }
    } catch (error) {
      console.error(`Failed to fetch ${symbol}:`, error);
    }
  }

  // If not force refresh, merge with cached results
  if (!forceRefresh) {
    const allCached = await prisma.stockCache.findMany({
      where: { symbol: { in: [...symbols, ...results.map((r) => r.symbol)] } },
    });
    return allCached;
  }

  return results;
}
