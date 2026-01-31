import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import prisma from '@/lib/db';
import {
  exchangePublicToken,
  getItem,
  getAccounts,
  encryptToken,
} from '@/lib/plaid';

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { publicToken, institutionId, institutionName } = await request.json();

    if (!publicToken) {
      return NextResponse.json(
        { error: 'Public token is required' },
        { status: 400 }
      );
    }

    // Exchange public token for access token
    const exchangeResponse = await exchangePublicToken(publicToken);
    const accessToken = exchangeResponse.access_token;
    const itemId = exchangeResponse.item_id;

    // Check if this item already exists
    const existingConnection = await prisma.plaidConnection.findUnique({
      where: { itemId },
    });

    if (existingConnection) {
      return NextResponse.json(
        { error: 'This institution is already connected' },
        { status: 400 }
      );
    }

    // Get item details
    const itemResponse = await getItem(accessToken);
    const consentExpiresAt = itemResponse.item.consent_expiration_time
      ? new Date(itemResponse.item.consent_expiration_time)
      : null;

    // Create Plaid connection
    const connection = await prisma.plaidConnection.create({
      data: {
        userId: session.id,
        accessToken: encryptToken(accessToken),
        itemId,
        institutionId: institutionId || itemResponse.item.institution_id,
        institutionName: institutionName || 'Connected Institution',
        status: 'active',
        consentExpiresAt,
      },
    });

    // Get and store accounts
    const accountsResponse = await getAccounts(accessToken);

    for (const account of accountsResponse.accounts) {
      await prisma.plaidAccount.create({
        data: {
          connectionId: connection.id,
          plaidAccountId: account.account_id,
          name: account.name,
          officialName: account.official_name,
          type: account.type,
          subtype: account.subtype || null,
          mask: account.mask,
          isActive: true,
        },
      });
    }

    return NextResponse.json({
      success: true,
      connectionId: connection.id,
      institutionName: connection.institutionName,
      accountCount: accountsResponse.accounts.length,
    });
  } catch (error) {
    console.error('[Plaid Exchange Token] Error:', error);
    return NextResponse.json(
      { error: 'Failed to connect institution' },
      { status: 500 }
    );
  }
}
