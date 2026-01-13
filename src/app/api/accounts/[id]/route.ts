import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import prisma from '@/lib/db';

// Update an account
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

    // Verify ownership
    const existing = await prisma.account.findFirst({
      where: { id, userId: session.id },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 });
    }

    const updateData: { name?: string; cashBalance?: number; isShared?: boolean } = {};

    if (body.name !== undefined) {
      updateData.name = body.name.trim();
    }
    if (body.cashBalance !== undefined) {
      updateData.cashBalance = Number(body.cashBalance) || 0;
    }
    if (body.isShared !== undefined) {
      updateData.isShared = Boolean(body.isShared);
    }

    const account = await prisma.account.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({ account });
  } catch (error) {
    console.error('[Accounts API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to update account' },
      { status: 500 }
    );
  }
}

// Delete an account
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

    // Verify ownership
    const existing = await prisma.account.findFirst({
      where: { id, userId: session.id },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 });
    }

    // Remove account reference from transactions and uploads
    await prisma.transaction.updateMany({
      where: { accountId: id },
      data: { accountId: null },
    });

    await prisma.dataUpload.updateMany({
      where: { accountId: id },
      data: { accountId: null },
    });

    await prisma.account.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Accounts API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to delete account' },
      { status: 500 }
    );
  }
}
