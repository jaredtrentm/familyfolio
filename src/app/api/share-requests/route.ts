import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import prisma from '@/lib/db';

// Get all share requests (sent and received) for the current user
export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get requests sent by this user
    const sentRequests = await prisma.shareRequest.findMany({
      where: { requesterId: session.id },
      include: {
        target: {
          select: { id: true, name: true, email: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Get requests received by this user
    const receivedRequests = await prisma.shareRequest.findMany({
      where: { targetId: session.id },
      include: {
        requester: {
          select: { id: true, name: true, email: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Get active connections (approved requests in either direction)
    const connections = await prisma.shareRequest.findMany({
      where: {
        status: 'approved',
        OR: [
          { requesterId: session.id },
          { targetId: session.id },
        ],
      },
      include: {
        requester: {
          select: { id: true, name: true, email: true },
        },
        target: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    // Map connections to show the "other" user
    const activeConnections = connections.map((conn) => ({
      id: conn.id,
      connectedUser: conn.requesterId === session.id ? conn.target : conn.requester,
      createdAt: conn.createdAt,
    }));

    return NextResponse.json({
      sentRequests,
      receivedRequests: receivedRequests.filter((r) => r.status === 'pending'),
      activeConnections,
    });
  } catch (error) {
    console.error('[Share Requests API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch share requests' },
      { status: 500 }
    );
  }
}

// Send a new share request by email
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { email } = body;

    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    // Normalize email
    const normalizedEmail = email.toLowerCase().trim();

    // Can't send request to yourself
    if (normalizedEmail === session.email?.toLowerCase()) {
      return NextResponse.json(
        { error: 'You cannot send a share request to yourself' },
        { status: 400 }
      );
    }

    // Find the target user by email
    const targetUser = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (!targetUser) {
      return NextResponse.json(
        { error: 'No user found with that email address' },
        { status: 404 }
      );
    }

    // Check if a request already exists (in either direction)
    const existingRequest = await prisma.shareRequest.findFirst({
      where: {
        OR: [
          { requesterId: session.id, targetId: targetUser.id },
          { requesterId: targetUser.id, targetId: session.id },
        ],
      },
    });

    if (existingRequest) {
      if (existingRequest.status === 'approved') {
        return NextResponse.json(
          { error: 'You are already connected with this user' },
          { status: 400 }
        );
      }
      if (existingRequest.status === 'pending') {
        return NextResponse.json(
          { error: 'A share request already exists between you and this user' },
          { status: 400 }
        );
      }
      // If denied, allow creating a new request by deleting the old one
      if (existingRequest.status === 'denied') {
        await prisma.shareRequest.delete({
          where: { id: existingRequest.id },
        });
      }
    }

    // Create the share request
    const shareRequest = await prisma.shareRequest.create({
      data: {
        requesterId: session.id,
        targetId: targetUser.id,
        status: 'pending',
      },
      include: {
        target: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    return NextResponse.json({
      success: true,
      shareRequest,
      message: `Share request sent to ${targetUser.name}`,
    });
  } catch (error) {
    console.error('[Share Requests API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to send share request' },
      { status: 500 }
    );
  }
}
