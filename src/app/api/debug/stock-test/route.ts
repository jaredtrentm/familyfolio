import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { fetchStockData, getLastError } from '@/lib/stock-data';
import prisma from '@/lib/db';
import YahooFinance from 'yahoo-finance2';

const yahooFinance = new YahooFinance({
  suppressNotices: ['yahooSurvey'],
});

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const symbol = searchParams.get('symbol') || 'AAPL';
    const forceUpdate = searchParams.get('update') === 'true';

    console.log(`[Debug Stock Test] Testing symbol: ${symbol}, forceUpdate: ${forceUpdate}`);

    const results: Record<string, unknown> = {
      symbol,
      timestamp: new Date().toISOString(),
      environment: {
        nodeEnv: process.env.NODE_ENV,
        hasAlphaVantageKey: !!process.env.ALPHA_VANTAGE_API_KEY,
      },
    };

    // Test 1: Direct Yahoo Finance test
    try {
      console.log('[Debug] Testing Yahoo Finance directly...');
      const startTime = Date.now();

      const quotePromise = yahooFinance.quote(symbol);
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Timeout after 10s')), 10000)
      );

      const quote = await Promise.race([quotePromise, timeoutPromise]);
      const duration = Date.now() - startTime;

      results.yahooDirectTest = {
        success: true,
        duration: `${duration}ms`,
        data: quote ? {
          symbol: (quote as { symbol?: string }).symbol,
          price: (quote as { regularMarketPrice?: number }).regularMarketPrice,
          name: (quote as { shortName?: string }).shortName,
        } : null,
      };
    } catch (error) {
      results.yahooDirectTest = {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        errorType: error instanceof Error ? error.constructor.name : typeof error,
      };
    }

    // Test 2: Finnhub test (fallback provider)
    try {
      const finnhubKey = process.env.FINNHUB_API_KEY;
      if (!finnhubKey) {
        results.finnhubTest = {
          success: false,
          error: 'No FINNHUB_API_KEY configured',
          hint: 'Get a free key at https://finnhub.io/',
        };
      } else {
        console.log('[Debug] Testing Finnhub...');
        const startTime = Date.now();
        const url = `https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${finnhubKey}`;

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);

        const response = await fetch(url, { signal: controller.signal });
        clearTimeout(timeoutId);

        const data = await response.json();
        const duration = Date.now() - startTime;

        results.finnhubTest = {
          success: data && data.c > 0,
          duration: `${duration}ms`,
          data: data ? {
            price: data.c,
            change: data.d,
            changePercent: data.dp,
            previousClose: data.pc,
          } : null,
        };
      }
    } catch (error) {
      results.finnhubTest = {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }

    // Test 3: Full fetchStockData with fallbacks
    try {
      console.log('[Debug] Testing fetchStockData...');
      const startTime = Date.now();
      const data = await fetchStockData(symbol);
      const duration = Date.now() - startTime;

      results.fetchStockData = {
        success: !!data,
        duration: `${duration}ms`,
        lastError: getLastError(),
        data: data ? {
          symbol: data.symbol,
          name: data.name,
          currentPrice: data.currentPrice,
          dayChange: data.dayChange,
          dayChangePercent: data.dayChangePercent,
          sector: data.sector,
          peRatio: data.peRatio,
          targetPrice: data.targetPrice,
          beta: data.beta,
        } : null,
      };

      // Force update cache if requested
      if (forceUpdate && data) {
        console.log('[Debug] Force updating cache...');
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
        results.cacheUpdated = true;
      }
    } catch (error) {
      results.fetchStockData = {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        lastError: getLastError(),
      };
    }

    // Test 4: Check cache
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
          beta: cached.beta,
          updatedAt: cached.updatedAt,
          ageMinutes: Math.round((Date.now() - cached.updatedAt.getTime()) / 60000),
        } : null,
      };
    } catch (error) {
      results.cache = {
        found: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }

    // If update=all, refresh all watchlist symbols
    if (searchParams.get('update') === 'all') {
      console.log('[Debug] Refreshing all watchlist symbols...');
      const watchlist = await prisma.watchlistItem.findMany({
        where: { userId: session.id },
        select: { symbol: true },
      });

      const refreshResults: Record<string, unknown> = {};
      for (const item of watchlist) {
        try {
          const data = await fetchStockData(item.symbol);
          if (data) {
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
            refreshResults[item.symbol] = { success: true, price: data.currentPrice };
          } else {
            refreshResults[item.symbol] = { success: false, error: getLastError() };
          }
        } catch (error) {
          refreshResults[item.symbol] = {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown'
          };
        }
      }
      results.batchRefresh = refreshResults;
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
