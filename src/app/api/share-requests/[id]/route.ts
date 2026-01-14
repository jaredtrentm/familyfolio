import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import prisma from '@/lib/db';

// Update share request status (approve/deny)
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
    const { status } = body;

    if (!status || !['approved', 'denied'].includes(status)) {
      return NextResponse.json(
        { error: 'Invalid status. Must be "approved" or "denied"' },
        { status: 400 }
      );
    }

    // Find the share request
    const shareRequest = await prisma.shareRequest.findUnique({
      where: { id },
      include: {
        requester: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    if (!shareRequest) {
      return NextResponse.json(
        { error: 'Share request not found' },
        { status: 404 }
      );
    }

    // Only the target user can approve/deny
    if (shareRequest.targetId !== session.id) {
      return NextResponse.json(
        { error: 'You can only respond to requests sent to you' },
        { status: 403 }
      );
    }

    // Only pending requests can be updated
    if (shareRequest.status !== 'pending') {
      return NextResponse.json(
        { error: 'This request has already been responded to' },
        { status: 400 }
      );
    }

    // Update the request status
    const updatedRequest = await prisma.shareRequest.update({
      where: { id },
      data: { status },
      include: {
        requester: {
          select: { id: true, name: true, email: true },
        },
        target: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    const actionText = status === 'approved' ? 'approved' : 'denied';
    return NextResponse.json({
      success: true,
      shareRequest: updatedRequest,
      message: `Share request ${actionText}`,
    });
  } catch (error) {
    console.error('[Share Requests API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to update share request' },
      { status: 500 }
    );
  }
}

// Delete/remove a share connection or cancel pending request
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

    // Find the share request
    const shareRequest = await prisma.shareRequest.findUnique({
      where: { id },
    });

    if (!shareRequest) {
      return NextResponse.json(
        { error: 'Share request not found' },
        { status: 404 }
      );
    }

    // Users can delete requests they sent (cancel) or remove connections they're part of
    if (shareRequest.requesterId !== session.id && shareRequest.targetId !== session.id) {
      return NextResponse.json(
        { error: 'You do not have permission to delete this request' },
        { status: 403 }
      );
    }

    // Delete the request
    await prisma.shareRequest.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      message: shareRequest.status === 'approved'
        ? 'Connection removed'
        : 'Share request cancelled',
    });
  } catch (error) {
    console.error('[Share Requests API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to delete share request' },
      { status: 500 }
    );
  }
}
