import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import prisma from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { transactionIds } = body;

    if (!transactionIds || !Array.isArray(transactionIds) || transactionIds.length === 0) {
      return NextResponse.json(
        { error: 'Transaction IDs are required' },
        { status: 400 }
      );
    }

    // Update transactions to claim them
    const result = await prisma.transaction.updateMany({
      where: {
        id: { in: transactionIds },
        claimedById: null, // Only claim unclaimed transactions
      },
      data: {
        claimedById: session.id,
      },
    });

    return NextResponse.json({
      claimed: result.count,
    });
  } catch (error) {
    console.error('[Claim API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to claim transactions' },
      { status: 500 }
    );
  }
}

// Unclaim transactions
export async function DELETE(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { transactionIds } = body;

    if (!transactionIds || !Array.isArray(transactionIds) || transactionIds.length === 0) {
      return NextResponse.json(
        { error: 'Transaction IDs are required' },
        { status: 400 }
      );
    }

    // Update transactions to unclaim them (only if claimed by current user)
    const result = await prisma.transaction.updateMany({
      where: {
        id: { in: transactionIds },
        claimedById: session.id, // Only unclaim own transactions
      },
      data: {
        claimedById: null,
      },
    });

    return NextResponse.json({
      unclaimed: result.count,
    });
  } catch (error) {
    console.error('[Unclaim API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to unclaim transactions' },
      { status: 500 }
    );
  }
}
