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

// Update user preferences (full update)
export async function PUT(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { costBasisMethod, widgetLayout, theme } = body;

    // Validate cost basis method
    const validMethods = ['FIFO', 'LIFO', 'HIFO', 'SPECID'];
    if (costBasisMethod && !validMethods.includes(costBasisMethod)) {
      return NextResponse.json(
        { error: 'Invalid cost basis method' },
        { status: 400 }
      );
    }

    // Validate theme
    const validThemes = ['light', 'dark', 'system'];
    if (theme && !validThemes.includes(theme)) {
      return NextResponse.json(
        { error: 'Invalid theme' },
        { status: 400 }
      );
    }

    const preferences = await prisma.userPreferences.upsert({
      where: { userId: session.id },
      create: {
        userId: session.id,
        costBasisMethod: costBasisMethod || 'FIFO',
        widgetLayout: widgetLayout || null,
        theme: theme || 'system',
      },
      update: {
        ...(costBasisMethod && { costBasisMethod }),
        ...(widgetLayout !== undefined && { widgetLayout }),
        ...(theme && { theme }),
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

// Partial update (for theme toggle, etc.)
export async function PATCH(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { theme, costBasisMethod, widgetLayout } = body;

    // Validate theme if provided
    const validThemes = ['light', 'dark', 'system'];
    if (theme && !validThemes.includes(theme)) {
      return NextResponse.json(
        { error: 'Invalid theme' },
        { status: 400 }
      );
    }

    // Validate cost basis method if provided
    const validMethods = ['FIFO', 'LIFO', 'HIFO', 'SPECID'];
    if (costBasisMethod && !validMethods.includes(costBasisMethod)) {
      return NextResponse.json(
        { error: 'Invalid cost basis method' },
        { status: 400 }
      );
    }

    const updateData: Record<string, unknown> = {};
    if (theme) updateData.theme = theme;
    if (costBasisMethod) updateData.costBasisMethod = costBasisMethod;
    if (widgetLayout !== undefined) updateData.widgetLayout = widgetLayout;

    const preferences = await prisma.userPreferences.upsert({
      where: { userId: session.id },
      create: {
        userId: session.id,
        theme: theme || 'system',
        costBasisMethod: costBasisMethod || 'FIFO',
        widgetLayout: widgetLayout || null,
      },
      update: updateData,
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
