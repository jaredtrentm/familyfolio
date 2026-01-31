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

    console.log(`[Debug Stock Test] Testing symbol: ${symbol}`);

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

    // Test 2: Sina Finance test (China fallback)
    try {
      console.log('[Debug] Testing Sina Finance...');
      const startTime = Date.now();
      const sinaSymbol = `gb_${symbol.toLowerCase()}`;
      const url = `https://hq.sinajs.cn/list=${sinaSymbol}`;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
      });
      clearTimeout(timeoutId);

      const text = await response.text();
      const duration = Date.now() - startTime;

      // Parse Sina response
      const match = text.match(/="([^"]+)"/);
      const parts = match?.[1]?.split(',') || [];

      results.sinaTest = {
        success: parts.length > 3 && parts[1] !== '',
        duration: `${duration}ms`,
        rawResponse: text.substring(0, 200),
        parsed: parts.length > 3 ? {
          name: parts[0],
          price: parts[1],
          change: parts[2],
          changePercent: parts[3],
        } : null,
      };
    } catch (error) {
      results.sinaTest = {
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

    return NextResponse.json(results);
  } catch (error) {
    console.error('[Debug Stock Test] Error:', error);
    return NextResponse.json(
      { error: 'Test failed', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
}
