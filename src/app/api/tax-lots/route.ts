import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import prisma from '@/lib/db';

// Get all tax lots for the current user
export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const symbol = searchParams.get('symbol');

    // Get all transactions claimed by this user
    const transactions = await prisma.transaction.findMany({
      where: { claimedById: session.id },
      select: { id: true },
    });

    const transactionIds = transactions.map(t => t.id);

    // Get tax lots for these transactions
    const whereClause: {
      transactionId: { in: string[] };
      symbol?: { equals: string; mode: 'insensitive' };
    } = {
      transactionId: { in: transactionIds },
    };

    if (symbol) {
      whereClause.symbol = { equals: symbol, mode: 'insensitive' };
    }

    const taxLots = await prisma.taxLot.findMany({
      where: whereClause,
      include: {
        transaction: {
          select: {
            date: true,
            type: true,
          },
        },
      },
      orderBy: [
        { symbol: 'asc' },
        { acquiredDate: 'asc' },
      ],
    });

    interface TaxLotResult {
      id: string;
      transactionId: string;
      symbol: string;
      quantity: number;
      remainingQty: number;
      costBasis: number;
      acquiredDate: Date;
      createdAt: Date;
      transaction: { date: Date; type: string } | null;
    }

    return NextResponse.json({
      taxLots: taxLots.map((lot: TaxLotResult) => ({
        ...lot,
        acquiredDate: lot.acquiredDate.toISOString(),
        createdAt: lot.createdAt.toISOString(),
        transaction: lot.transaction ? {
          ...lot.transaction,
          date: lot.transaction.date.toISOString(),
        } : null,
      })),
    });
  } catch (error) {
    console.error('[Tax Lots API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch tax lots' },
      { status: 500 }
    );
  }
}
