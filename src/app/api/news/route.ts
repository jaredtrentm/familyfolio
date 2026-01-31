import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';

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

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const symbol = searchParams.get('symbol');
    const category = searchParams.get('category') || 'general'; // general, forex, crypto, merger

    const finnhubKey = process.env.FINNHUB_API_KEY;
    if (!finnhubKey) {
      return NextResponse.json({
        news: [],
        error: 'News API not configured'
      });
    }

    let newsUrl: string;

    if (symbol) {
      // Company-specific news
      const today = new Date();
      const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
      const fromDate = weekAgo.toISOString().split('T')[0];
      const toDate = today.toISOString().split('T')[0];

      newsUrl = `https://finnhub.io/api/v1/company-news?symbol=${symbol.toUpperCase()}&from=${fromDate}&to=${toDate}&token=${finnhubKey}`;
    } else {
      // General market news
      newsUrl = `https://finnhub.io/api/v1/news?category=${category}&token=${finnhubKey}`;
    }

    const response = await fetchWithTimeout(newsUrl, 10000);

    if (!response.ok) {
      console.error(`[News API] Finnhub returned ${response.status}`);
      return NextResponse.json({ news: [], error: 'Failed to fetch news' });
    }

    const data: NewsItem[] = await response.json();

    // Limit to 10 most recent news items and format
    const news = data.slice(0, 10).map((item) => ({
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
