import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import prisma from '@/lib/db';

// Get rebalance targets
export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const targets = await prisma.rebalanceTarget.findMany({
      where: { userId: session.id },
      orderBy: [
        { targetType: 'asc' },
        { targetPercent: 'desc' },
      ],
    });

    return NextResponse.json({
      targets: targets.map((t: { id: string; userId: string; targetType: string; identifier: string; targetPercent: number; createdAt: Date; updatedAt: Date }) => ({
        ...t,
        createdAt: t.createdAt.toISOString(),
        updatedAt: t.updatedAt.toISOString(),
      })),
    });
  } catch (error) {
    console.error('[Rebalance Targets API] Error:', error);
    return NextResponse.json({ error: 'Failed to fetch targets' }, { status: 500 });
  }
}

// Create or update a rebalance target
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { targetType, identifier, targetPercent } = body;

    if (!targetType || !identifier || targetPercent === undefined) {
      return NextResponse.json(
        { error: 'Target type, identifier, and percent are required' },
        { status: 400 }
      );
    }

    if (!['SYMBOL', 'SECTOR', 'ASSET_TYPE'].includes(targetType)) {
      return NextResponse.json(
        { error: 'Invalid target type' },
        { status: 400 }
      );
    }

    const percent = Number(targetPercent);
    if (percent < 0 || percent > 100) {
      return NextResponse.json(
        { error: 'Target percent must be between 0 and 100' },
        { status: 400 }
      );
    }

    const target = await prisma.rebalanceTarget.upsert({
      where: {
        userId_targetType_identifier: {
          userId: session.id,
          targetType,
          identifier: identifier.toUpperCase(),
        },
      },
      create: {
        userId: session.id,
        targetType,
        identifier: identifier.toUpperCase(),
        targetPercent: percent,
      },
      update: {
        targetPercent: percent,
      },
    });

    return NextResponse.json({
      target: {
        ...target,
        createdAt: target.createdAt.toISOString(),
        updatedAt: target.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    console.error('[Rebalance Targets API] Error:', error);
    return NextResponse.json({ error: 'Failed to save target' }, { status: 500 });
  }
}

// Delete a rebalance target
export async function DELETE(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Target ID is required' }, { status: 400 });
    }

    // Verify ownership
    const target = await prisma.rebalanceTarget.findUnique({
      where: { id },
    });

    if (!target || target.userId !== session.id) {
      return NextResponse.json({ error: 'Target not found' }, { status: 404 });
    }

    await prisma.rebalanceTarget.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Rebalance Targets API] Error:', error);
    return NextResponse.json({ error: 'Failed to delete target' }, { status: 500 });
  }
}
