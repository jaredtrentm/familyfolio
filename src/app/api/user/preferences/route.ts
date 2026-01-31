import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import prisma from '@/lib/db';

// Get user preferences
export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let preferences = await prisma.userPreferences.findUnique({
      where: { userId: session.id },
    });

    // Create default preferences if none exist
    if (!preferences) {
      preferences = await prisma.userPreferences.create({
        data: {
          userId: session.id,
          costBasisMethod: 'FIFO',
        },
      });
    }

    return NextResponse.json({
      preferences: {
        ...preferences,
        createdAt: preferences.createdAt.toISOString(),
        updatedAt: preferences.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    console.error('[User Preferences API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch preferences' },
      { status: 500 }
    );
  }
}

// Update user preferences
export async function PUT(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { costBasisMethod, widgetLayout } = body;

    // Validate cost basis method
    const validMethods = ['FIFO', 'LIFO', 'HIFO', 'SPECID'];
    if (costBasisMethod && !validMethods.includes(costBasisMethod)) {
      return NextResponse.json(
        { error: 'Invalid cost basis method' },
        { status: 400 }
      );
    }

    const preferences = await prisma.userPreferences.upsert({
      where: { userId: session.id },
      create: {
        userId: session.id,
        costBasisMethod: costBasisMethod || 'FIFO',
        widgetLayout: widgetLayout || null,
      },
      update: {
        ...(costBasisMethod && { costBasisMethod }),
        ...(widgetLayout !== undefined && { widgetLayout }),
      },
    });

    return NextResponse.json({
      preferences: {
        ...preferences,
        createdAt: preferences.createdAt.toISOString(),
        updatedAt: preferences.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    console.error('[User Preferences API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to update preferences' },
      { status: 500 }
    );
  }
}
