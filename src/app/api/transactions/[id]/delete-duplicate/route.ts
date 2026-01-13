import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import prisma from '@/lib/db';
import { unflagDuplicatePair } from '@/lib/duplicate-detection';

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

    const transaction = await prisma.transaction.findUnique({
      where: { id },
      include: { claimedBy: true },
    });

    if (!transaction) {
      return NextResponse.json({ error: 'Transaction not found' }, { status: 404 });
    }

    // Only allow deletion of FLAGGED duplicates that are UNCLAIMED
    if (!transaction.isDuplicateFlag) {
      return NextResponse.json(
        { error: 'This transaction is not flagged as a duplicate' },
        { status: 400 }
      );
    }

    if (transaction.claimedById) {
      return NextResponse.json(
        { error: 'Cannot delete a claimed transaction. Ask the owner to delete it.' },
        { status: 400 }
      );
    }

    // Unflag the paired transaction before deleting
    await unflagDuplicatePair(id);

    // Delete the transaction
    await prisma.transaction.delete({
      where: { id },
    });

    return NextResponse.json({ success: true, message: 'Duplicate deleted' });
  } catch (error) {
    console.error('[Delete Duplicate API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to delete duplicate' },
      { status: 500 }
    );
  }
}
