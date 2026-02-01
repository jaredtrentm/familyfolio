import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import prisma from '@/lib/db';

interface NewsItem {
  id: number;
  category: string;
  datetime: number;
  headline: string;
  image: string;
  related: string;
  source: string;
  summary: string;
  url: string;
}

// Fetch news with timeout
async function fetchWithTimeout(url: string, timeout: number = 10000): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

// Get unique holding symbols for a user (from claimed transactions)
async function getUserHoldings(userId: string): Promise<string[]> {
  const transactions = await prisma.transaction.findMany({
    where: { claimedById: userId },
    select: { symbol: true },
    distinct: ['symbol'],
  });
  return transactions.map((t) => t.symbol.toUpperCase());
}

// Get watchlist symbols for a user
async function getUserWatchlist(userId: string): Promise<string[]> {
  const watchlist = await prisma.watchlistItem.findMany({
    where: { userId },
    select: { symbol: true },
  });
  return watchlist.map((w) => w.symbol.toUpperCase());
}

// Fetch news for multiple symbols
async function fetchNewsForSymbols(
  symbols: string[],
  finnhubKey: string,
  maxPerSymbol: number = 3
): Promise<NewsItem[]> {
  const today = new Date();
  const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
  const fromDate = weekAgo.toISOString().split('T')[0];
  const toDate = today.toISOString().split('T')[0];

  // Limit to first 5 symbols to avoid too many API calls
  const limitedSymbols = symbols.slice(0, 5);

  const newsPromises = limitedSymbols.map(async (symbol) => {
    try {
      const url = `https://finnhub.io/api/v1/company-news?symbol=${symbol}&from=${fromDate}&to=${toDate}&token=${finnhubKey}`;
      const response = await fetchWithTimeout(url, 5000);
      if (!response.ok) return [];
      const data: NewsItem[] = await response.json();
      return data.slice(0, maxPerSymbol);
    } catch {
      return [];
    }
  });

  const results = await Promise.all(newsPromises);
  const allNews = results.flat();

  // Sort by datetime and dedupe by headline
  const seen = new Set<string>();
  return allNews
    .sort((a, b) => b.datetime - a.datetime)
    .filter((item) => {
      if (seen.has(item.headline)) return false;
      seen.add(item.headline);
      return true;
    });
}

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const symbol = searchParams.get('symbol');
    const filter = searchParams.get('filter'); // 'holdings', 'watchlist', 'market'
    const category = searchParams.get('category') || 'general';

    const finnhubKey = process.env.FINNHUB_API_KEY;
    if (!finnhubKey) {
      return NextResponse.json({
        news: [],
        error: 'News API not configured'
      });
    }

    let newsData: NewsItem[] = [];

    if (symbol) {
      // Single symbol news
      const today = new Date();
      const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
      const fromDate = weekAgo.toISOString().split('T')[0];
      const toDate = today.toISOString().split('T')[0];

      const newsUrl = `https://finnhub.io/api/v1/company-news?symbol=${symbol.toUpperCase()}&from=${fromDate}&to=${toDate}&token=${finnhubKey}`;
      const response = await fetchWithTimeout(newsUrl, 10000);

      if (response.ok) {
        newsData = await response.json();
      }
    } else if (filter === 'holdings') {
      // News for user's holdings
      const holdings = await getUserHoldings(session.id);
      if (holdings.length > 0) {
        newsData = await fetchNewsForSymbols(holdings, finnhubKey);
      }
    } else if (filter === 'watchlist') {
      // News for user's watchlist
      const watchlist = await getUserWatchlist(session.id);
      if (watchlist.length > 0) {
        newsData = await fetchNewsForSymbols(watchlist, finnhubKey);
      }
    } else {
      // General market news
      const newsUrl = `https://finnhub.io/api/v1/news?category=${category}&token=${finnhubKey}`;
      const response = await fetchWithTimeout(newsUrl, 10000);

      if (response.ok) {
        newsData = await response.json();
      }
    }

    // Format and limit news items
    const news = newsData.slice(0, 10).map((item) => ({
      id: item.id,
      headline: item.headline,
      summary: item.summary,
      source: item.source,
      url: item.url,
      image: item.image || null,
      symbol: item.related || symbol || null,
      publishedAt: new Date(item.datetime * 1000).toISOString(),
      category: item.category,
    }));

    return NextResponse.json({ news });
  } catch (error) {
    console.error('[News API] Error:', error);
    return NextResponse.json({
      news: [],
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
