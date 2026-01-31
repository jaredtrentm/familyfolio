import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { createLinkToken } from '@/lib/plaid';

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Optional: pass access token for update mode (reconnecting an existing item)
    const body = await request.json().catch(() => ({}));
    const accessToken = body.accessToken;

    const linkTokenResponse = await createLinkToken(session.id, accessToken);

    return NextResponse.json({
      linkToken: linkTokenResponse.link_token,
      expiration: linkTokenResponse.expiration,
    });
  } catch (error) {
    console.error('[Plaid Link Token] Error:', error);
    return NextResponse.json(
      { error: 'Failed to create link token' },
      { status: 500 }
    );
  }
}
