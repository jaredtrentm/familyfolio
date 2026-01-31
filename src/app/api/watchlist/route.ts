import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import prisma from '@/lib/db';

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

    // Get current prices for the symbols
    const symbols = watchlist.map(w => w.symbol);
    const stockData = await prisma.stockCache.findMany({
      where: { symbol: { in: symbols } },
      select: {
        symbol: true,
        name: true,
        currentPrice: true,
        dayChange: true,
        dayChangePercent: true,
        sector: true,
      },
    });
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

    // Get stock info
    const stockInfo = await prisma.stockCache.findUnique({
      where: { symbol: normalizedSymbol },
    });

    return NextResponse.json({
      item: {
        ...item,
        addedAt: item.addedAt.toISOString(),
        name: stockInfo?.name || null,
        currentPrice: stockInfo?.currentPrice || null,
        dayChange: stockInfo?.dayChange || null,
        dayChangePercent: stockInfo?.dayChangePercent || null,
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
