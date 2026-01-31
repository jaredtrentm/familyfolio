import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import prisma from '@/lib/db';
import { detectWashSale } from '@/lib/wash-sale-detector';

// Update a transaction (date, etc.)
export async function PATCH(
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

    // Get the transaction first to check ownership
    const transaction = await prisma.transaction.findUnique({
      where: { id },
      include: { dataUpload: true },
    });

    if (!transaction) {
      return NextResponse.json({ error: 'Transaction not found' }, { status: 404 });
    }

    // For claimed transactions, only the owner can edit
    if (transaction.claimedById && transaction.claimedById !== session.id) {
      return NextResponse.json({ error: 'Not authorized to edit this transaction' }, { status: 403 });
    }

    // For unclaimed transactions, verify user is connected to the uploader
    if (!transaction.claimedById && transaction.dataUpload) {
      const uploaderId = transaction.dataUpload.userId;
      if (uploaderId !== session.id) {
        // Check if user is connected to the uploader
        const connection = await prisma.shareRequest.findFirst({
          where: {
            status: 'approved',
            OR: [
              { requesterId: session.id, targetId: uploaderId },
              { requesterId: uploaderId, targetId: session.id },
            ],
          },
        });

        if (!connection) {
          return NextResponse.json({ error: 'Not authorized to edit this transaction' }, { status: 403 });
        }
      }
    }

    // Store previous state for history
    const previousState = {
      date: transaction.date.toISOString(),
      type: transaction.type,
      symbol: transaction.symbol,
      description: transaction.description,
      quantity: transaction.quantity,
      price: transaction.price,
      amount: transaction.amount,
      fees: transaction.fees,
      notes: transaction.notes,
    };

    // Build update data
    const updateData: Record<string, unknown> = {};

    if (body.date) {
      updateData.date = new Date(body.date);
    }
    if (body.type) {
      updateData.type = body.type;
    }
    if (body.symbol) {
      updateData.symbol = body.symbol.toUpperCase();
    }
    if (body.quantity !== undefined) {
      updateData.quantity = Number(body.quantity);
    }
    if (body.price !== undefined) {
      updateData.price = Number(body.price);
    }
    if (body.amount !== undefined) {
      updateData.amount = Number(body.amount);
    }
    if (body.description !== undefined) {
      updateData.description = body.description || null;
    }
    if (body.notes !== undefined) {
      updateData.notes = body.notes || null;
    }
    if (body.fees !== undefined) {
      updateData.fees = Number(body.fees);
    }

    const updated = await prisma.transaction.update({
      where: { id },
      data: updateData,
    });

    // Create history entry for claimed transactions
    if (transaction.claimedById) {
      const newState = {
        date: updated.date.toISOString(),
        type: updated.type,
        symbol: updated.symbol,
        description: updated.description,
        quantity: updated.quantity,
        price: updated.price,
        amount: updated.amount,
        fees: updated.fees,
        notes: updated.notes,
      };

      await prisma.transactionHistory.create({
        data: {
          transactionId: id,
          userId: session.id,
          changeType: 'UPDATE',
          previousData: previousState,
          newData: newState,
        },
      });
    }

    return NextResponse.json({
      success: true,
      transaction: {
        ...updated,
        date: updated.date.toISOString(),
        createdAt: updated.createdAt.toISOString(),
        updatedAt: updated.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    console.error('[Transaction PATCH API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to update transaction' },
      { status: 500 }
    );
  }
}

// GET single transaction with history
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    const transaction = await prisma.transaction.findUnique({
      where: { id },
      include: {
        taxLots: true,
        history: {
          include: {
            user: {
              select: { name: true, email: true },
            },
          },
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
      },
    });

    if (!transaction) {
      return NextResponse.json({ error: 'Transaction not found' }, { status: 404 });
    }

    // Check access
    if (transaction.claimedById && transaction.claimedById !== session.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    return NextResponse.json({
      transaction: {
        ...transaction,
        date: transaction.date.toISOString(),
        createdAt: transaction.createdAt.toISOString(),
        updatedAt: transaction.updatedAt.toISOString(),
        taxLots: transaction.taxLots.map(lot => ({
          ...lot,
          acquiredDate: lot.acquiredDate.toISOString(),
          createdAt: lot.createdAt.toISOString(),
        })),
        history: transaction.history.map(h => ({
          ...h,
          createdAt: h.createdAt.toISOString(),
        })),
      },
    });
  } catch (error) {
    console.error('[Transaction GET API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch transaction' },
      { status: 500 }
    );
  }
}

// Delete a transaction
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') || 'delete'; // 'delete' or 'unclaim'

    // Get the transaction first
    const transaction = await prisma.transaction.findUnique({
      where: { id },
      include: { dataUpload: true },
    });

    if (!transaction) {
      return NextResponse.json({ error: 'Transaction not found' }, { status: 404 });
    }

    // For claimed transactions, only the owner can delete/unclaim
    if (transaction.claimedById && transaction.claimedById !== session.id) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
    }

    // For unclaimed transactions, verify user is connected to the uploader
    if (!transaction.claimedById && transaction.dataUpload) {
      const uploaderId = transaction.dataUpload.userId;
      if (uploaderId !== session.id) {
        // Check if user is connected to the uploader
        const connection = await prisma.shareRequest.findFirst({
          where: {
            status: 'approved',
            OR: [
              { requesterId: session.id, targetId: uploaderId },
              { requesterId: uploaderId, targetId: session.id },
            ],
          },
        });

        if (!connection) {
          return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
        }
      }
    }

    if (action === 'unclaim') {
      // Send back to unclaimed (remove claimedById)
      await prisma.transaction.update({
        where: { id },
        data: { claimedById: null },
      });

      // Record history
      await prisma.transactionHistory.create({
        data: {
          transactionId: id,
          userId: session.id,
          changeType: 'UNCLAIM',
          previousData: { claimedById: transaction.claimedById },
          newData: { claimedById: null },
        },
      });

      return NextResponse.json({ success: true, action: 'unclaimed' });
    } else {
      // Record delete history before deleting
      await prisma.transactionHistory.create({
        data: {
          transactionId: id,
          userId: session.id,
          changeType: 'DELETE',
          previousData: {
            date: transaction.date.toISOString(),
            type: transaction.type,
            symbol: transaction.symbol,
            quantity: transaction.quantity,
            price: transaction.price,
            amount: transaction.amount,
          },
        },
      });

      // Permanently delete (cascade will remove tax lots and history)
      await prisma.transaction.delete({
        where: { id },
      });

      return NextResponse.json({ success: true, action: 'deleted' });
    }
  } catch (error) {
    console.error('[Transaction DELETE API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to delete transaction' },
      { status: 500 }
    );
  }
}
