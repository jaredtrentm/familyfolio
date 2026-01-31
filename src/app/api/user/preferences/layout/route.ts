import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import prisma from '@/lib/db';

// Get widget layout
export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const preferences = await prisma.userPreferences.findUnique({
      where: { userId: session.id },
      select: { widgetLayout: true },
    });

    return NextResponse.json({
      layout: preferences?.widgetLayout || null,
    });
  } catch (error) {
    console.error('[Layout API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch layout' },
      { status: 500 }
    );
  }
}

// Save widget layout
export async function PUT(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { layout } = body;

    if (!layout || !Array.isArray(layout)) {
      return NextResponse.json(
        { error: 'Invalid layout data' },
        { status: 400 }
      );
    }

    await prisma.userPreferences.upsert({
      where: { userId: session.id },
      create: {
        userId: session.id,
        widgetLayout: layout,
      },
      update: {
        widgetLayout: layout,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Layout API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to save layout' },
      { status: 500 }
    );
  }
}
