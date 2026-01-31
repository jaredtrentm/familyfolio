import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import prisma from '@/lib/db';
import { Prisma } from '@prisma/client';

// Revert a transaction to a previous state
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { historyId } = body;

    if (!historyId) {
      return NextResponse.json(
        { error: 'History entry ID is required' },
        { status: 400 }
      );
    }

    // Verify the transaction exists and belongs to the user
    const transaction = await prisma.transaction.findUnique({
      where: { id },
    });

    if (!transaction) {
      return NextResponse.json({ error: 'Transaction not found' }, { status: 404 });
    }

    if (transaction.claimedById !== session.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Get the history entry to revert to
    const historyEntry = await prisma.transactionHistory.findUnique({
      where: { id: historyId },
    });

    if (!historyEntry || historyEntry.transactionId !== id) {
      return NextResponse.json({ error: 'History entry not found' }, { status: 404 });
    }

    // Can only revert UPDATE or UNCLAIM
    if (historyEntry.changeType !== 'UPDATE' && historyEntry.changeType !== 'UNCLAIM') {
      return NextResponse.json(
        { error: 'Cannot revert this type of change' },
        { status: 400 }
      );
    }

    const previousData = historyEntry.previousData as Record<string, unknown> | null;
    if (!previousData) {
      return NextResponse.json(
        { error: 'No previous data to revert to' },
        { status: 400 }
      );
    }

    // Store current state for the revert history
    const currentState = {
      date: transaction.date.toISOString(),
      type: transaction.type,
      symbol: transaction.symbol,
      description: transaction.description,
      quantity: transaction.quantity,
      price: transaction.price,
      amount: transaction.amount,
      fees: transaction.fees,
      notes: transaction.notes,
      claimedById: transaction.claimedById,
      accountId: transaction.accountId,
    };

    // Prepare update data from previous state
    const updateData: Record<string, unknown> = {};
    const allowedFields = [
      'date', 'type', 'symbol', 'description', 'quantity',
      'price', 'amount', 'fees', 'notes', 'claimedById', 'accountId'
    ];

    for (const field of allowedFields) {
      if (field in previousData) {
        if (field === 'date' && typeof previousData[field] === 'string') {
          updateData[field] = new Date(previousData[field] as string);
        } else {
          updateData[field] = previousData[field];
        }
      }
    }

    // Update the transaction
    const updatedTransaction = await prisma.transaction.update({
      where: { id },
      data: updateData,
    });

    // Create history entry for the revert
    await prisma.transactionHistory.create({
      data: {
        transactionId: id,
        userId: session.id,
        changeType: 'UPDATE',
        previousData: currentState as Prisma.InputJsonValue,
        newData: previousData as Prisma.InputJsonValue,
      },
    });

    return NextResponse.json({
      success: true,
      transaction: {
        ...updatedTransaction,
        date: updatedTransaction.date.toISOString(),
        createdAt: updatedTransaction.createdAt.toISOString(),
        updatedAt: updatedTransaction.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    console.error('[Transaction Revert API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to revert transaction' },
      { status: 500 }
    );
  }
}
