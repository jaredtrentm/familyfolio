import { NextRequest, NextResponse } from 'next/server';
import { getSession, createToken, setAuthCookie } from '@/lib/auth';
import prisma from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { locale } = await request.json();

    if (!locale || !['en', 'zh'].includes(locale)) {
      return NextResponse.json({ error: 'Invalid locale' }, { status: 400 });
    }

    // Update user locale in database
    const user = await prisma.user.update({
      where: { id: session.id },
      data: { locale },
    });

    // Create new token with updated locale
    const token = await createToken({
      id: user.id,
      email: user.email,
      name: user.name,
      locale: user.locale,
    });

    // Set new cookie
    await setAuthCookie(token);

    return NextResponse.json({ success: true, locale: user.locale });
  } catch (error) {
    console.error('[Update Locale API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to update locale' },
      { status: 500 }
    );
  }
}
