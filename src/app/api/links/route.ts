import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import prisma from '@/lib/db';

// Get all links for the user
export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const links = await prisma.link.findMany({
      where: { userId: session.id },
      orderBy: [{ accountId: 'asc' }, { name: 'asc' }],
    });

    // Also get accounts for grouping
    const accounts = await prisma.account.findMany({
      where: { userId: session.id },
      orderBy: { name: 'asc' },
    });

    return NextResponse.json({ links, accounts });
  } catch (error) {
    console.error('[Links API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch links' },
      { status: 500 }
    );
  }
}

// Create a new link
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { name, url, accountId, category } = body;

    if (!name || !url) {
      return NextResponse.json(
        { error: 'Name and URL are required' },
        { status: 400 }
      );
    }

    // Validate URL
    try {
      new URL(url);
    } catch {
      return NextResponse.json(
        { error: 'Invalid URL format' },
        { status: 400 }
      );
    }

    const link = await prisma.link.create({
      data: {
        userId: session.id,
        name,
        url,
        accountId: accountId || null,
        category: category || 'other',
      },
    });

    return NextResponse.json({ success: true, link });
  } catch (error) {
    console.error('[Links API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to create link' },
      { status: 500 }
    );
  }
}
