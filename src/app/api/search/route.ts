import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import prisma from '@/lib/db';

interface SearchResult {
  id: string;
  type: 'transaction' | 'holding' | 'closed' | 'watchlist';
  title: string;
  subtitle: string;
  url: string;
  meta?: {
    amount?: number;
    gainLoss?: number;
    date?: string;
  };
}

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q')?.trim().toUpperCase() || '';
    const type = searchParams.get('type') || 'all';

    if (!query) {
      return NextResponse.json({ results: [] });
    }

    const results: SearchResult[] = [];
    const locale = session.locale || 'en';

    // Search transactions
    if (type === 'all' || type === 'transaction') {
      const transactions = await prisma.transaction.findMany({
        where: {
          claimedById: session.id,
          OR: [
            { symbol: { contains: query, mode: 'insensitive' } },
            { description: { contains: query, mode: 'insensitive' } },
          ],
        },
        orderBy: { date: 'desc' },
        take: 10,
      });

      for (const tx of transactions) {
        const typeLabels: Record<string, string> = {
          BUY: 'Buy',
          SELL: 'Sell',
          DIVIDEND: 'Dividend',
          TRANSFER_IN: 'Transfer In',
          TRANSFER_OUT: 'Transfer Out',
        };

        results.push({
          id: tx.id,
          type: 'transaction',
          title: `${tx.symbol} - ${typeLabels[tx.type] || tx.type}`,
          subtitle: `${tx.date.toLocaleDateString()} - ${tx.quantity} shares @ $${tx.price.toFixed(2)}`,
          url: `/${locale}/transactions`,
          meta: {
            amount: tx.amount,
            date: tx.date.toISOString(),
          },
        });
      }
    }

    // Search holdings (aggregate from transactions)
    if (type === 'all' || type === 'holding') {
      // Get unique symbols that match the query
      const holdings = await prisma.transaction.groupBy({
        by: ['symbol'],
        where: {
          claimedById: session.id,
          symbol: { contains: query, mode: 'insensitive' },
        },
        _sum: {
          quantity: true,
          amount: true,
        },
      });

      // Filter to only show symbols with positive holdings (net buys > sells)
      const buyTotals = await prisma.transaction.groupBy({
        by: ['symbol'],
        where: {
          claimedById: session.id,
          symbol: { contains: query, mode: 'insensitive' },
          type: { in: ['BUY', 'TRANSFER_IN'] },
        },
        _sum: {
          quantity: true,
        },
      });

      const sellTotals = await prisma.transaction.groupBy({
        by: ['symbol'],
        where: {
          claimedById: session.id,
          symbol: { contains: query, mode: 'insensitive' },
          type: { in: ['SELL', 'TRANSFER_OUT'] },
        },
        _sum: {
          quantity: true,
        },
      });

      const buyMap = new Map(buyTotals.map(b => [b.symbol, b._sum.quantity || 0]));
      const sellMap = new Map(sellTotals.map(s => [s.symbol, s._sum.quantity || 0]));

      for (const h of holdings) {
        const bought = buyMap.get(h.symbol) || 0;
        const sold = sellMap.get(h.symbol) || 0;
        const netQuantity = bought - sold;

        if (netQuantity > 0.0001) {
          // Get stock info from cache
          const stockInfo = await prisma.stockCache.findUnique({
            where: { symbol: h.symbol },
          });

          results.push({
            id: `holding-${h.symbol}`,
            type: 'holding',
            title: h.symbol,
            subtitle: stockInfo?.name || `${netQuantity.toFixed(4)} shares`,
            url: `/${locale}/dashboard`,
            meta: {
              amount: h._sum.amount || 0,
            },
          });
        }
      }
    }

    // Search watchlist
    if (type === 'all' || type === 'watchlist') {
      const watchlist = await prisma.watchlistItem.findMany({
        where: {
          userId: session.id,
          symbol: { contains: query, mode: 'insensitive' },
        },
        take: 5,
      });

      for (const item of watchlist) {
        const stockInfo = await prisma.stockCache.findUnique({
          where: { symbol: item.symbol },
        });

        results.push({
          id: item.id,
          type: 'watchlist',
          title: item.symbol,
          subtitle: stockInfo?.name || item.notes || 'Watchlist item',
          url: `/${locale}/watchlist`,
        });
      }
    }

    // Sort by relevance (exact symbol matches first)
    results.sort((a, b) => {
      const aExact = a.title.toUpperCase().startsWith(query) ? 0 : 1;
      const bExact = b.title.toUpperCase().startsWith(query) ? 0 : 1;
      return aExact - bExact;
    });

    return NextResponse.json({
      results: results.slice(0, 20), // Limit total results
    });
  } catch (error) {
    console.error('[Search API] Error:', error);
    return NextResponse.json(
      { error: 'Search failed' },
      { status: 500 }
    );
  }
}
