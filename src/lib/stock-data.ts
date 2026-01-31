/**
 * Stock Data Provider
 *
 * Fetches stock data with:
 * - Primary: Yahoo Finance
 * - Fallback: Sina Finance (works in China)
 * - Retry logic with exponential backoff
 * - Timeout handling
 * - Automatic provider switching on repeated failures
 */

import YahooFinance from 'yahoo-finance2';

// Configure Yahoo Finance with proper options
const yahooFinance = new YahooFinance({
  suppressNotices: ['yahooSurvey'],
});

// Track failures to auto-switch providers
let yahooFailureCount = 0;
const MAX_FAILURES_BEFORE_SWITCH = 3;
let lastFailureReset = Date.now();

// Reset failure count every 5 minutes
function resetFailureCountIfNeeded() {
  if (Date.now() - lastFailureReset > 5 * 60 * 1000) {
    yahooFailureCount = 0;
    lastFailureReset = Date.now();
  }
}

export interface StockQuote {
  symbol: string;
  name: string | null;
  currentPrice: number;
  dayChange: number;
  dayChangePercent: number;
  previousClose: number;
  marketCap: number | null;
  sector: string | null;
  industry: string | null;
  fiftyTwoWeekHigh: number | null;
  fiftyTwoWeekLow: number | null;
  peRatio: number | null;
  dividendYield: number | null;
  volume: number | null;
  averageVolume: number | null;
  targetPrice: number | null;
  earningsDate: Date | null;
  beta: number | null;
}

// Utility: fetch with timeout
async function fetchWithTimeout(url: string, timeout: number = 10000): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

// Utility: retry with exponential backoff
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Don't retry on certain errors
      if (lastError.message.includes('not found') ||
          lastError.message.includes('invalid symbol')) {
        throw lastError;
      }

      if (attempt < maxRetries - 1) {
        const delay = baseDelay * Math.pow(2, attempt);
        console.log(`[Stock Data] Retry ${attempt + 1}/${maxRetries} after ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError;
}

/**
 * Fetch stock data from Yahoo Finance
 */
async function fetchFromYahoo(symbol: string): Promise<StockQuote | null> {
  const normalizedSymbol = symbol.toUpperCase().trim();

  // Wrap in promise with timeout
  const quotePromise = yahooFinance.quote(normalizedSymbol);
  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error('Yahoo Finance timeout')), 15000)
  );

  const quote = await Promise.race([quotePromise, timeoutPromise]);

  if (!quote || typeof quote !== 'object') {
    return null;
  }

  const q = quote as {
    shortName?: string;
    longName?: string;
    regularMarketPrice?: number;
    regularMarketChange?: number;
    regularMarketChangePercent?: number;
    regularMarketPreviousClose?: number;
    marketCap?: number;
    fiftyTwoWeekHigh?: number;
    fiftyTwoWeekLow?: number;
    trailingPE?: number;
    dividendYield?: number;
    regularMarketVolume?: number;
    averageDailyVolume3Month?: number;
  };

  // Get additional data (sector, target price, etc.)
  let sector: string | null = null;
  let industry: string | null = null;
  let targetPrice: number | null = null;
  let earningsDate: Date | null = null;
  let beta: number | null = null;

  try {
    const summaryPromise = yahooFinance.quoteSummary(normalizedSymbol, {
      modules: ['assetProfile', 'financialData', 'calendarEvents', 'defaultKeyStatistics'],
    });
    const summaryTimeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Summary timeout')), 10000)
    );

    const summary = await Promise.race([summaryPromise, summaryTimeout]);
    const summaryData = summary as {
      assetProfile?: { sector?: string; industry?: string };
      financialData?: { targetMeanPrice?: number };
      calendarEvents?: { earnings?: { earningsDate?: Date[] } };
      defaultKeyStatistics?: { beta?: number };
    } | null;

    if (summaryData?.assetProfile) {
      sector = summaryData.assetProfile.sector || null;
      industry = summaryData.assetProfile.industry || null;
    }
    if (summaryData?.financialData?.targetMeanPrice) {
      targetPrice = summaryData.financialData.targetMeanPrice;
    }
    if (summaryData?.calendarEvents?.earnings?.earningsDate?.[0]) {
      earningsDate = new Date(summaryData.calendarEvents.earnings.earningsDate[0]);
    }
    if (summaryData?.defaultKeyStatistics?.beta) {
      beta = summaryData.defaultKeyStatistics.beta;
    }
  } catch (profileError) {
    console.log(`[Stock Data] Could not fetch profile for ${normalizedSymbol}:`,
      profileError instanceof Error ? profileError.message : 'Unknown');
  }

  return {
    symbol: normalizedSymbol,
    name: q.shortName || q.longName || normalizedSymbol,
    currentPrice: q.regularMarketPrice || 0,
    dayChange: q.regularMarketChange || 0,
    dayChangePercent: q.regularMarketChangePercent || 0,
    previousClose: q.regularMarketPreviousClose || 0,
    marketCap: q.marketCap || null,
    sector,
    industry,
    fiftyTwoWeekHigh: q.fiftyTwoWeekHigh || null,
    fiftyTwoWeekLow: q.fiftyTwoWeekLow || null,
    peRatio: q.trailingPE || null,
    dividendYield: q.dividendYield ? q.dividendYield * 100 : null,
    volume: q.regularMarketVolume || null,
    averageVolume: q.averageDailyVolume3Month || null,
    targetPrice,
    earningsDate,
    beta,
  };
}

/**
 * Fetch stock data from Sina Finance (works in China)
 * Format: US stocks use "gb_" prefix (e.g., gb_aapl)
 */
async function fetchFromSina(symbol: string): Promise<StockQuote | null> {
  const normalizedSymbol = symbol.toUpperCase().trim();

  // Sina uses lowercase with gb_ prefix for US stocks
  const sinaSymbol = `gb_${normalizedSymbol.toLowerCase()}`;
  const url = `https://hq.sinajs.cn/list=${sinaSymbol}`;

  try {
    const response = await fetchWithTimeout(url, 10000);
    const text = await response.text();

    // Parse Sina response format:
    // var hq_str_gb_aapl="Apple Inc,178.72,1.23,0.69,178.50,179.00,176.00,45000000,...";
    const match = text.match(/="([^"]+)"/);
    if (!match || !match[1]) {
      console.log(`[Stock Data] Sina: No data for ${normalizedSymbol}`);
      return null;
    }

    const parts = match[1].split(',');
    if (parts.length < 8) {
      console.log(`[Stock Data] Sina: Invalid data format for ${normalizedSymbol}`);
      return null;
    }

    // Sina format for US stocks:
    // 0: Name, 1: Current Price, 2: Change, 3: Change %, 4: Time, 5: Open, 6: High, 7: Low,
    // 8: 52wk High, 9: 52wk Low, 10: Volume, 11: Avg Volume, 12: Market Cap, 13: P/E, ...
    const currentPrice = parseFloat(parts[1]) || 0;
    const dayChange = parseFloat(parts[2]) || 0;
    const dayChangePercent = parseFloat(parts[3]) || 0;

    return {
      symbol: normalizedSymbol,
      name: parts[0] || normalizedSymbol,
      currentPrice,
      dayChange,
      dayChangePercent,
      previousClose: currentPrice - dayChange,
      marketCap: parts[12] ? parseFloat(parts[12]) * 1000000 : null, // Sina reports in millions
      sector: null, // Sina doesn't provide sector
      industry: null,
      fiftyTwoWeekHigh: parts[8] ? parseFloat(parts[8]) : null,
      fiftyTwoWeekLow: parts[9] ? parseFloat(parts[9]) : null,
      peRatio: parts[13] ? parseFloat(parts[13]) : null,
      dividendYield: null, // Sina doesn't provide in basic quote
      volume: parts[10] ? parseFloat(parts[10]) : null,
      averageVolume: parts[11] ? parseFloat(parts[11]) : null,
      targetPrice: null, // Sina doesn't provide analyst targets
      earningsDate: null,
      beta: null,
    };
  } catch (error) {
    console.log(`[Stock Data] Sina fetch failed for ${normalizedSymbol}:`,
      error instanceof Error ? error.message : 'Unknown');
    return null;
  }
}

/**
 * Fetch stock data from Alpha Vantage (free tier, 25 calls/day)
 * This is a backup option
 */
async function fetchFromAlphaVantage(symbol: string): Promise<StockQuote | null> {
  const apiKey = process.env.ALPHA_VANTAGE_API_KEY;
  if (!apiKey) {
    return null;
  }

  const normalizedSymbol = symbol.toUpperCase().trim();
  const url = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${normalizedSymbol}&apikey=${apiKey}`;

  try {
    const response = await fetchWithTimeout(url, 10000);
    const data = await response.json();

    const quote = data['Global Quote'];
    if (!quote || !quote['05. price']) {
      return null;
    }

    const currentPrice = parseFloat(quote['05. price']) || 0;
    const previousClose = parseFloat(quote['08. previous close']) || 0;
    const dayChange = currentPrice - previousClose;
    const dayChangePercent = previousClose > 0 ? (dayChange / previousClose) * 100 : 0;

    return {
      symbol: normalizedSymbol,
      name: normalizedSymbol, // Alpha Vantage doesn't provide name in quote
      currentPrice,
      dayChange,
      dayChangePercent,
      previousClose,
      marketCap: null,
      sector: null,
      industry: null,
      fiftyTwoWeekHigh: parseFloat(quote['03. high']) || null,
      fiftyTwoWeekLow: parseFloat(quote['04. low']) || null,
      peRatio: null,
      dividendYield: null,
      volume: parseFloat(quote['06. volume']) || null,
      averageVolume: null,
      targetPrice: null,
      earningsDate: null,
      beta: null,
    };
  } catch (error) {
    console.log(`[Stock Data] Alpha Vantage fetch failed for ${normalizedSymbol}:`,
      error instanceof Error ? error.message : 'Unknown');
    return null;
  }
}

/**
 * Main function to fetch stock data with fallbacks
 */
export async function fetchStockData(symbol: string): Promise<StockQuote | null> {
  const normalizedSymbol = symbol.toUpperCase().trim();
  resetFailureCountIfNeeded();

  // If Yahoo has been failing, try Sina first
  const useYahooFirst = yahooFailureCount < MAX_FAILURES_BEFORE_SWITCH;

  const providers = useYahooFirst
    ? [
        { name: 'Yahoo', fn: () => fetchFromYahoo(normalizedSymbol) },
        { name: 'Sina', fn: () => fetchFromSina(normalizedSymbol) },
        { name: 'AlphaVantage', fn: () => fetchFromAlphaVantage(normalizedSymbol) },
      ]
    : [
        { name: 'Sina', fn: () => fetchFromSina(normalizedSymbol) },
        { name: 'Yahoo', fn: () => fetchFromYahoo(normalizedSymbol) },
        { name: 'AlphaVantage', fn: () => fetchFromAlphaVantage(normalizedSymbol) },
      ];

  for (const provider of providers) {
    try {
      console.log(`[Stock Data] Trying ${provider.name} for ${normalizedSymbol}...`);

      const result = await retryWithBackoff(provider.fn, 2, 500);

      if (result && result.currentPrice > 0) {
        console.log(`[Stock Data] ${provider.name} success for ${normalizedSymbol}: $${result.currentPrice}`);

        // Reset Yahoo failure count on success
        if (provider.name === 'Yahoo') {
          yahooFailureCount = 0;
        }

        return result;
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown';
      console.log(`[Stock Data] ${provider.name} failed for ${normalizedSymbol}: ${errorMsg}`);

      // Track Yahoo failures
      if (provider.name === 'Yahoo') {
        yahooFailureCount++;
        console.log(`[Stock Data] Yahoo failure count: ${yahooFailureCount}/${MAX_FAILURES_BEFORE_SWITCH}`);
      }
    }
  }

  console.log(`[Stock Data] All providers failed for ${normalizedSymbol}`);
  return null;
}

/**
 * Batch fetch multiple symbols efficiently
 */
export async function fetchMultipleStocks(symbols: string[]): Promise<Map<string, StockQuote>> {
  const results = new Map<string, StockQuote>();

  // Fetch in batches of 3 to avoid overwhelming providers
  const batchSize = 3;
  for (let i = 0; i < symbols.length; i += batchSize) {
    const batch = symbols.slice(i, i + batchSize);

    const promises = batch.map(async (symbol) => {
      const data = await fetchStockData(symbol);
      if (data) {
        results.set(symbol.toUpperCase().trim(), data);
      }
    });

    await Promise.all(promises);

    // Small delay between batches to avoid rate limiting
    if (i + batchSize < symbols.length) {
      await new Promise(resolve => setTimeout(resolve, 200));
    }
  }

  return results;
}

/**
 * Check if we should use the China-friendly provider
 * This can be expanded to detect user location
 */
export function shouldUseChinaProvider(): boolean {
  // Can be enhanced to check:
  // 1. Request headers for location hints
  // 2. User preference stored in database
  // 3. Environment variable for deployment region
  return yahooFailureCount >= MAX_FAILURES_BEFORE_SWITCH;
}
