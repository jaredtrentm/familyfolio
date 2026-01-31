import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';

// Get VAPID public key for push notifications
export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const vapidPublicKey = process.env.VAPID_PUBLIC_KEY;

    if (!vapidPublicKey) {
      return NextResponse.json(
        { error: 'Push notifications not configured' },
        { status: 503 }
      );
    }

    return NextResponse.json({ publicKey: vapidPublicKey });
  } catch (error) {
    console.error('[VAPID API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to get VAPID key' },
      { status: 500 }
    );
  }
}
