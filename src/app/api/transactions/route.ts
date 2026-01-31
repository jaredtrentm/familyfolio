import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import prisma from '@/lib/db';
import { checkAndFlagDuplicates } from '@/lib/duplicate-detection';

// Create a new transaction manually
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { date, type, symbol, quantity, price, amount, fees, description, claimImmediately } = body;

    // Validate required fields
    if (!date || !type || !symbol || quantity === undefined || price === undefined) {
      return NextResponse.json(
        { error: 'Date, type, symbol, quantity, and price are required' },
        { status: 400 }
      );
    }

    // Validate type
    const validTypes = ['BUY', 'SELL', 'DIVIDEND'];
    if (!validTypes.includes(type.toUpperCase())) {
      return NextResponse.json(
        { error: 'Invalid transaction type. Must be BUY, SELL, or DIVIDEND.' },
        { status: 400 }
      );
    }

    const txDate = new Date(date);
    const calculatedAmount = amount || quantity * price;

    // Create the transaction
    const transaction = await prisma.transaction.create({
      data: {
        date: txDate,
        type: type.toUpperCase(),
        symbol: symbol.toUpperCase(),
        quantity: Number(quantity),
        price: Number(price),
        amount: Number(calculatedAmount),
        fees: Number(fees) || 0,
        description: description || null,
        claimedById: claimImmediately ? session.id : null,
      },
    });

    // Check for duplicates if not claimed immediately
    if (!claimImmediately) {
      await checkAndFlagDuplicates(transaction.id, {
        date: txDate,
        symbol: symbol.toUpperCase(),
        type: type.toUpperCase(),
        quantity: Number(quantity),
        price: Number(price),
      });
    }

    return NextResponse.json({
      success: true,
      transaction: {
        ...transaction,
        date: transaction.date.toISOString(),
        createdAt: transaction.createdAt.toISOString(),
        updatedAt: transaction.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    console.error('[Transactions API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to create transaction' },
      { status: 500 }
    );
  }
}

// Get transactions for current user
export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const unclaimed = searchParams.get('unclaimed') === 'true';

    let transactions;

    if (unclaimed) {
      // For unclaimed transactions, only show those from connected users
      // Get all users who are connected to the current user (approved share requests)
      const connections = await prisma.shareRequest.findMany({
        where: {
          status: 'approved',
          OR: [
            { requesterId: session.id },
            { targetId: session.id },
          ],
        },
      });

      // Build list of user IDs who can share unclaimed transactions
      const sharedUserIds = new Set<string>([session.id]);
      for (const conn of connections) {
        sharedUserIds.add(conn.requesterId);
        sharedUserIds.add(conn.targetId);
      }
      const allowedUserIds = Array.from(sharedUserIds);

      // Get unclaimed transactions that were uploaded by allowed users
      transactions = await prisma.transaction.findMany({
        where: {
          claimedById: null,
          dataUpload: {
            userId: { in: allowedUserIds },
          },
        },
        orderBy: [
          { isDuplicateFlag: 'desc' },
          { date: 'desc' },
        ],
      });
    } else {
      // For claimed transactions, only show user's own
      transactions = await prisma.transaction.findMany({
        where: { claimedById: session.id },
        orderBy: { date: 'desc' },
      });
    }

    return NextResponse.json({
      transactions: transactions.map((tx) => ({
        ...tx,
        date: tx.date.toISOString(),
        createdAt: tx.createdAt.toISOString(),
        updatedAt: tx.updatedAt.toISOString(),
      })),
    });
  } catch (error) {
    console.error('[Transactions API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch transactions' },
      { status: 500 }
    );
  }
}
