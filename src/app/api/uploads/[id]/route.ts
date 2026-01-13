import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import prisma from '@/lib/db';

// Update an upload (e.g., set account)
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
    const existing = await prisma.dataUpload.findFirst({
      where: { id, userId: session.id },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Upload not found' }, { status: 404 });
    }

    const updateData: { accountId?: string | null } = {};

    if (body.accountId !== undefined) {
      updateData.accountId = body.accountId || null;
    }

    const upload = await prisma.dataUpload.update({
      where: { id },
      data: updateData,
    });

    // Also update all transactions from this upload
    if (body.accountId !== undefined) {
      await prisma.transaction.updateMany({
        where: { dataUploadId: id },
        data: { accountId: body.accountId || null },
      });
    }

    return NextResponse.json({ upload });
  } catch (error) {
    console.error('[Uploads API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to update upload' },
      { status: 500 }
    );
  }
}

// Delete an upload and its transactions
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
    const existing = await prisma.dataUpload.findFirst({
      where: { id, userId: session.id },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Upload not found' }, { status: 404 });
    }

    // Delete all transactions from this upload
    await prisma.transaction.deleteMany({
      where: { dataUploadId: id },
    });

    // Delete the upload
    await prisma.dataUpload.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Uploads API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to delete upload' },
      { status: 500 }
    );
  }
}
