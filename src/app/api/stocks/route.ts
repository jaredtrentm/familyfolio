import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import prisma from '@/lib/db';
import yahooFinance from 'yahoo-finance2';
import Anthropic from '@anthropic-ai/sdk';

// Cache duration in minutes
const CACHE_DURATION = 15;

// Fallback: Fetch price from Finnhub (free tier: 60 calls/min)
async function fetchPriceFromFinnhub(symbol: string): Promise<{ price: number; name?: string } | null> {
  const apiKey = process.env.FINNHUB_API_KEY;
  if (!apiKey) {
    console.log('[Stocks API] No FINNHUB_API_KEY configured');
    return null;
  }

  try {
    const response = await fetch(
      `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(symbol)}&token=${apiKey}`
    );

    if (!response.ok) {
      console.error(`[Stocks API] Finnhub returned ${response.status}`);
      return null;
    }

    const data = await response.json();
    // Finnhub returns: { c: current, h: high, l: low, o: open, pc: previous close, t: timestamp }
    if (data && data.c && data.c > 0) {
      console.log(`[Stocks API] Finnhub returned price for ${symbol}: $${data.c}`);
      return { price: data.c };
    }

    return null;
  } catch (error) {
    console.error(`[Stocks API] Finnhub fetch failed for ${symbol}:`, error instanceof Error ? error.message : 'Unknown');
    return null;
  }
}

// Fallback: Use AI to look up current stock price
async function fetchPriceFromAI(symbol: string, stockName: string): Promise<{ price: number } | null> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return null;
  }

  try {
    const anthropic = new Anthropic();
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 100,
      messages: [
        {
          role: 'user',
          content: `What is the current stock price for ${symbol} (${stockName})?
Respond with ONLY a JSON object in this exact format, no other text:
{"price": 123.45}

If you don't know the current price, respond with:
{"price": 0}`,
        },
      ],
    });

    const content = response.content[0];
    if (content.type === 'text') {
      const parsed = JSON.parse(content.text.trim());
      if (parsed.price && parsed.price > 0) {
        console.log(`[Stocks API] AI returned price for ${symbol}: $${parsed.price}`);
        return { price: parsed.price };
      }
    }
    return null;
  } catch (error) {
    console.error(`[Stocks API] AI price lookup failed for ${symbol}:`, error instanceof Error ? error.message : 'Unknown');
    return null;
  }
}

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
    const debug = searchParams.get('debug') === 'true';

    // Debug mode: test all price sources
    if (debug) {
      const testSymbol = symbols[0] || 'AAPL';
      const debugInfo: Record<string, unknown> = {
        testSymbol,
        timestamp: new Date().toISOString(),
        envVars: {
          hasFinnhubKey: !!process.env.FINNHUB_API_KEY,
          hasAnthropicKey: !!process.env.ANTHROPIC_API_KEY,
        },
      };

      // Test Yahoo Finance
      try {
        console.log(`[Stocks API Debug] Testing Yahoo Finance with ${testSymbol}...`);
        const quote = await yahooFinance.quote(testSymbol) as {
          symbol?: string;
          regularMarketPrice?: number;
          shortName?: string;
        } | null;
        debugInfo.yahooFinance = {
          working: true,
          quote: quote ? {
            symbol: quote.symbol,
            price: quote.regularMarketPrice,
            name: quote.shortName,
          } : null,
        };
      } catch (yahooError) {
        debugInfo.yahooFinance = {
          working: false,
          error: yahooError instanceof Error ? yahooError.message : 'Unknown error',
        };
      }

      // Test Finnhub
      try {
        const finnhubResult = await fetchPriceFromFinnhub(testSymbol);
        debugInfo.finnhub = {
          working: !!finnhubResult,
          price: finnhubResult?.price || null,
          hasApiKey: !!process.env.FINNHUB_API_KEY,
        };
      } catch (finnhubError) {
        debugInfo.finnhub = {
          working: false,
          error: finnhubError instanceof Error ? finnhubError.message : 'Unknown error',
        };
      }

      // Test AI price lookup
      try {
        const aiResult = await fetchPriceFromAI(testSymbol, 'Apple Inc');
        debugInfo.aiPriceLookup = {
          working: !!aiResult,
          price: aiResult?.price || null,
          hasApiKey: !!process.env.ANTHROPIC_API_KEY,
        };
      } catch (aiError) {
        debugInfo.aiPriceLookup = {
          working: false,
          error: aiError instanceof Error ? aiError.message : 'Unknown error',
        };
      }

      // Check what's in the cache
      const cached = await prisma.stockCache.findMany({ take: 10 });
      debugInfo.cacheEntries = cached.map(c => ({
        symbol: c.symbol,
        price: c.currentPrice,
        sector: c.sector,
        updatedAt: c.updatedAt,
      }));

      // Check user's transactions
      const transactions = await prisma.transaction.findMany({
        where: { claimedById: session.id },
        select: { symbol: true },
        distinct: ['symbol'],
      });
      debugInfo.userSymbols = transactions.map(t => t.symbol);

      return NextResponse.json(debugInfo);
    }

    if (symbols.length === 0) {
      return NextResponse.json({ stocks: [] });
    }

    const stocks = await getStockData(symbols);

    return NextResponse.json({ stocks });
  } catch (error) {
    console.error('[Stocks API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch stock data', details: error instanceof Error ? error.message : 'Unknown' },
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

    // Normalize symbols (uppercase, trim whitespace)
    const symbols = transactions
      .map((tx) => tx.symbol.toUpperCase().trim())
      .filter((s) => s.length > 0);

    console.log('[Stocks API] Fetching data for symbols:', symbols);

    if (symbols.length === 0) {
      console.log('[Stocks API] No symbols found for user');
      return NextResponse.json({ updated: 0, stocks: [] });
    }

    const stocks = await getStockData(symbols, true);
    console.log('[Stocks API] Fetched stocks:', stocks.map(s => ({ symbol: s.symbol, price: s.currentPrice, sector: s.sector })));

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

// Static sector mapping for common stocks as fallback
const SECTOR_MAP: Record<string, { sector: string; industry: string }> = {
  // Technology
  AAPL: { sector: 'Technology', industry: 'Consumer Electronics' },
  MSFT: { sector: 'Technology', industry: 'Software' },
  GOOGL: { sector: 'Technology', industry: 'Internet Services' },
  GOOG: { sector: 'Technology', industry: 'Internet Services' },
  META: { sector: 'Technology', industry: 'Social Media' },
  NVDA: { sector: 'Technology', industry: 'Semiconductors' },
  AMD: { sector: 'Technology', industry: 'Semiconductors' },
  INTC: { sector: 'Technology', industry: 'Semiconductors' },
  CRM: { sector: 'Technology', industry: 'Software' },
  ADBE: { sector: 'Technology', industry: 'Software' },
  ORCL: { sector: 'Technology', industry: 'Software' },
  CSCO: { sector: 'Technology', industry: 'Networking' },
  AVGO: { sector: 'Technology', industry: 'Semiconductors' },
  // Finance
  JPM: { sector: 'Financial Services', industry: 'Banking' },
  BAC: { sector: 'Financial Services', industry: 'Banking' },
  WFC: { sector: 'Financial Services', industry: 'Banking' },
  GS: { sector: 'Financial Services', industry: 'Investment Banking' },
  MS: { sector: 'Financial Services', industry: 'Investment Banking' },
  V: { sector: 'Financial Services', industry: 'Credit Services' },
  MA: { sector: 'Financial Services', industry: 'Credit Services' },
  BRK: { sector: 'Financial Services', industry: 'Insurance' },
  // Healthcare
  JNJ: { sector: 'Healthcare', industry: 'Pharmaceuticals' },
  UNH: { sector: 'Healthcare', industry: 'Healthcare Plans' },
  PFE: { sector: 'Healthcare', industry: 'Pharmaceuticals' },
  ABBV: { sector: 'Healthcare', industry: 'Pharmaceuticals' },
  MRK: { sector: 'Healthcare', industry: 'Pharmaceuticals' },
  LLY: { sector: 'Healthcare', industry: 'Pharmaceuticals' },
  // Consumer
  AMZN: { sector: 'Consumer Cyclical', industry: 'E-Commerce' },
  TSLA: { sector: 'Consumer Cyclical', industry: 'Auto Manufacturers' },
  HD: { sector: 'Consumer Cyclical', industry: 'Home Improvement' },
  NKE: { sector: 'Consumer Cyclical', industry: 'Footwear' },
  SBUX: { sector: 'Consumer Cyclical', industry: 'Restaurants' },
  MCD: { sector: 'Consumer Cyclical', industry: 'Restaurants' },
  WMT: { sector: 'Consumer Defensive', industry: 'Retail' },
  COST: { sector: 'Consumer Defensive', industry: 'Retail' },
  PG: { sector: 'Consumer Defensive', industry: 'Household Products' },
  KO: { sector: 'Consumer Defensive', industry: 'Beverages' },
  PEP: { sector: 'Consumer Defensive', industry: 'Beverages' },
  // Energy
  XOM: { sector: 'Energy', industry: 'Oil & Gas' },
  CVX: { sector: 'Energy', industry: 'Oil & Gas' },
  // Communications
  DIS: { sector: 'Communication Services', industry: 'Entertainment' },
  NFLX: { sector: 'Communication Services', industry: 'Entertainment' },
  CMCSA: { sector: 'Communication Services', industry: 'Telecom' },
  VZ: { sector: 'Communication Services', industry: 'Telecom' },
  T: { sector: 'Communication Services', industry: 'Telecom' },
  // ETFs
  SPY: { sector: 'ETF', industry: 'S&P 500 Index' },
  QQQ: { sector: 'ETF', industry: 'Nasdaq 100 Index' },
  VTI: { sector: 'ETF', industry: 'Total Stock Market' },
  VOO: { sector: 'ETF', industry: 'S&P 500 Index' },
  IWM: { sector: 'ETF', industry: 'Russell 2000 Index' },
  VGT: { sector: 'ETF', industry: 'Technology Sector' },
  XLF: { sector: 'ETF', industry: 'Financial Sector' },
  XLE: { sector: 'ETF', industry: 'Energy Sector' },
  VNQ: { sector: 'ETF', industry: 'Real Estate' },
  BND: { sector: 'ETF', industry: 'Bonds' },
  AGG: { sector: 'ETF', industry: 'Bonds' },
};

// AI-based sector classification for unknown stocks
async function classifyStockWithAI(symbol: string, name: string): Promise<{ sector: string; industry: string } | null> {
  try {
    const anthropic = new Anthropic();

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 150,
      messages: [
        {
          role: 'user',
          content: `Classify the following stock/ETF into a sector and industry. Stock symbol: ${symbol}, Name: ${name || 'Unknown'}.

Respond with ONLY valid JSON in this exact format (no markdown, no explanation):
{"sector": "Technology", "industry": "Software"}

Common sectors: Technology, Financial Services, Healthcare, Consumer Cyclical, Consumer Defensive, Energy, Communication Services, Industrials, Real Estate, Utilities, Basic Materials, ETF

If it's an ETF, use "ETF" as the sector and describe what it tracks as the industry.`,
        },
      ],
    });

    const content = response.content[0];
    if (content.type === 'text') {
      const parsed = JSON.parse(content.text.trim());
      if (parsed.sector && parsed.industry) {
        return parsed;
      }
    }
    return null;
  } catch (error) {
    console.error(`AI classification failed for ${symbol}:`, error);
    return null;
  }
}

async function getStockData(requestedSymbols: string[], forceRefresh = false) {
  const now = new Date();
  const cacheThreshold = new Date(now.getTime() - CACHE_DURATION * 60 * 1000);

  // Normalize all symbols to uppercase
  const allSymbols = requestedSymbols.map(s => s.toUpperCase().trim());
  let symbolsToFetch = [...allSymbols];

  // First, normalize any existing cache entries that might have wrong casing
  // This ensures case-insensitive matching by standardizing all to uppercase
  try {
    const existingEntries = await prisma.stockCache.findMany({
      where: {
        symbol: {
          in: allSymbols,
          mode: 'insensitive',
        },
      },
    });

    // Update any entries that have wrong casing
    for (const entry of existingEntries) {
      const upperSymbol = entry.symbol.toUpperCase().trim();
      if (entry.symbol !== upperSymbol) {
        console.log(`[Stocks API] Normalizing symbol casing: ${entry.symbol} -> ${upperSymbol}`);
        // Delete the old entry and we'll recreate with correct casing
        await prisma.stockCache.delete({ where: { id: entry.id } });
      }
    }
  } catch (normalizeError) {
    console.log('[Stocks API] Could not normalize existing entries:', normalizeError instanceof Error ? normalizeError.message : 'Unknown error');
  }

  // Check cache first (unless force refresh)
  if (!forceRefresh) {
    const cached = await prisma.stockCache.findMany({
      where: {
        symbol: { in: allSymbols },
        updatedAt: { gte: cacheThreshold },
      },
    });

    if (cached.length === allSymbols.length) {
      return cached;
    }

    // Find which symbols need updating
    const cachedSymbols = new Set(cached.map((s) => s.symbol.toUpperCase()));
    symbolsToFetch = allSymbols.filter((s) => !cachedSymbols.has(s));

    if (symbolsToFetch.length === 0) {
      return cached;
    }
  }

  // Fetch from Yahoo Finance
  const results = [];
  console.log('[Stocks API] Fetching from Yahoo Finance for:', symbolsToFetch);

  for (const symbol of symbolsToFetch) {
    const normalizedSymbol = symbol.toUpperCase().trim();

    // Initialize stock data with defaults - will be updated if Yahoo Finance works
    const stockData = {
      symbol: normalizedSymbol,
      name: normalizedSymbol,
      currentPrice: 0,
      dayChange: 0,
      dayChangePercent: 0,
      previousClose: 0,
      marketCap: null as number | null,
      sector: null as string | null,
      industry: null as string | null,
    };

    // Try to fetch from Yahoo Finance
    try {
      console.log(`[Stocks API] Fetching quote for ${symbol}...`);
      const quote = await yahooFinance.quote(symbol);

      if (quote && typeof quote === 'object') {
        const q = quote as {
          symbol?: string;
          shortName?: string;
          longName?: string;
          regularMarketPrice?: number;
          regularMarketChange?: number;
          regularMarketChangePercent?: number;
          regularMarketPreviousClose?: number;
          marketCap?: number;
        };

        stockData.name = q.shortName || q.longName || normalizedSymbol;
        stockData.currentPrice = q.regularMarketPrice || 0;
        stockData.dayChange = q.regularMarketChange || 0;
        stockData.dayChangePercent = q.regularMarketChangePercent || 0;
        stockData.previousClose = q.regularMarketPreviousClose || 0;
        stockData.marketCap = q.marketCap || null;

        console.log(`[Stocks API] Yahoo Finance returned for ${normalizedSymbol}: price=$${stockData.currentPrice}, name=${stockData.name}`);
      } else {
        console.warn(`[Stocks API] Yahoo Finance returned empty for ${symbol}`);
      }
    } catch (yahooError) {
      console.error(`[Stocks API] Yahoo Finance failed for ${symbol}:`, yahooError instanceof Error ? yahooError.message : 'Unknown error');
      // Continue with fallbacks below
    }

    // Fallback 1: Try Finnhub if Yahoo Finance didn't return a price
    if (stockData.currentPrice === 0) {
      const finnhubData = await fetchPriceFromFinnhub(normalizedSymbol);
      if (finnhubData && finnhubData.price > 0) {
        stockData.currentPrice = finnhubData.price;
        console.log(`[Stocks API] Using Finnhub price for ${normalizedSymbol}: $${stockData.currentPrice}`);
      }
    }

    // Fallback 2: Try AI if still no price (uses Claude's knowledge)
    if (stockData.currentPrice === 0) {
      const aiData = await fetchPriceFromAI(normalizedSymbol, stockData.name);
      if (aiData && aiData.price > 0) {
        stockData.currentPrice = aiData.price;
        console.log(`[Stocks API] Using AI price for ${normalizedSymbol}: $${stockData.currentPrice}`);
      }
    }

    // Try to get sector/industry info from quoteSummary (only if we got a price)
    if (stockData.currentPrice > 0) {
      try {
        const summary = await yahooFinance.quoteSummary(symbol, {
          modules: ['assetProfile'],
        });
        const summaryData = summary as { assetProfile?: { sector?: string; industry?: string } } | null;
        if (summaryData?.assetProfile) {
          stockData.sector = summaryData.assetProfile.sector || null;
          stockData.industry = summaryData.assetProfile.industry || null;
          console.log(`[Stocks API] Got sector from Yahoo for ${normalizedSymbol}: ${stockData.sector}`);
        }
      } catch (profileError) {
        console.log(`[Stocks API] Could not fetch profile for ${symbol}:`, profileError instanceof Error ? profileError.message : 'Unknown error');
      }
    }

    // Use static mapping as fallback if sector is still null
    if (!stockData.sector) {
      const staticData = SECTOR_MAP[normalizedSymbol] || SECTOR_MAP[normalizedSymbol.replace(/\.[A-Z]+$/, '')];
      if (staticData) {
        stockData.sector = staticData.sector;
        stockData.industry = staticData.industry;
        console.log(`[Stocks API] Using static sector for ${normalizedSymbol}: ${stockData.sector}`);
      }
    }

    // Use AI classification as final fallback (only if we have an API key)
    if (!stockData.sector && process.env.ANTHROPIC_API_KEY) {
      try {
        const aiClassification = await classifyStockWithAI(normalizedSymbol, stockData.name);
        if (aiClassification) {
          stockData.sector = aiClassification.sector;
          stockData.industry = aiClassification.industry;
          console.log(`[Stocks API] AI classified ${normalizedSymbol} as ${aiClassification.sector} / ${aiClassification.industry}`);
        }
      } catch (aiError) {
        console.error(`[Stocks API] AI classification failed for ${normalizedSymbol}:`, aiError instanceof Error ? aiError.message : 'Unknown error');
      }
    }

    // If still no sector, set to Unknown
    if (!stockData.sector) {
      stockData.sector = 'Unknown';
      console.log(`[Stocks API] No sector found for ${normalizedSymbol}, using Unknown`);
    }

    // Always upsert to cache (even with partial data)
    try {
      await prisma.stockCache.upsert({
        where: { symbol: normalizedSymbol },
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
          symbol: normalizedSymbol,
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
      console.log(`[Stocks API] Cached ${normalizedSymbol}: price=$${stockData.currentPrice}, sector=${stockData.sector}`);
    } catch (upsertError) {
      console.error(`[Stocks API] Failed to cache ${normalizedSymbol}:`, upsertError);
    }

    results.push(stockData);
  }

  // Always return from cache to ensure consistent format
  const allCached = await prisma.stockCache.findMany({
    where: { symbol: { in: allSymbols } },
  });

  return allCached;
}
