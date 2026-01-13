import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import prisma from '@/lib/db';

// Get all accounts for current user
export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const accounts = await prisma.account.findMany({
      where: { userId: session.id },
      orderBy: { createdAt: 'asc' },
    });

    return NextResponse.json({ accounts });
  } catch (error) {
    console.error('[Accounts API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch accounts' },
      { status: 500 }
    );
  }
}

// Create a new account
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { name, cashBalance, isShared } = await request.json();

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json(
        { error: 'Account name is required' },
        { status: 400 }
      );
    }

    const account = await prisma.account.create({
      data: {
        userId: session.id,
        name: name.trim(),
        cashBalance: Number(cashBalance) || 0,
        isShared: Boolean(isShared),
      },
    });

    return NextResponse.json({ account });
  } catch (error) {
    console.error('[Accounts API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to create account' },
      { status: 500 }
    );
  }
}
