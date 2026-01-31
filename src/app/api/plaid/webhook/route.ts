import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';

// Plaid webhook handler
// In production, verify webhook signatures using PLAID_WEBHOOK_VERIFICATION_KEY
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const { webhook_type, webhook_code, item_id, error } = body;

    console.log('[Plaid Webhook]', { webhook_type, webhook_code, item_id });

    // Find the connection by item ID
    const connection = await prisma.plaidConnection.findUnique({
      where: { itemId: item_id },
    });

    if (!connection) {
      console.log('[Plaid Webhook] Connection not found for item:', item_id);
      return NextResponse.json({ received: true });
    }

    switch (webhook_type) {
      case 'INVESTMENTS_TRANSACTIONS':
        // New investment transactions available
        if (webhook_code === 'DEFAULT_UPDATE') {
          // Mark connection as needing sync
          await prisma.plaidConnection.update({
            where: { id: connection.id },
            data: { status: 'active' },
          });
          console.log('[Plaid Webhook] Investment transactions available for sync');
        }
        break;

      case 'ITEM':
        switch (webhook_code) {
          case 'PENDING_EXPIRATION':
            // User's consent is about to expire
            await prisma.plaidConnection.update({
              where: { id: connection.id },
              data: { status: 'pending_expiration' },
            });
            break;

          case 'ERROR':
            // Item has encountered an error
            await prisma.plaidConnection.update({
              where: { id: connection.id },
              data: {
                status: 'error',
                errorCode: error?.error_code,
                errorMessage: error?.error_message,
              },
            });
            break;

          case 'USER_PERMISSION_REVOKED':
            // User revoked access
            await prisma.plaidConnection.update({
              where: { id: connection.id },
              data: {
                status: 'error',
                errorCode: 'USER_PERMISSION_REVOKED',
                errorMessage: 'User has revoked access to this institution',
              },
            });
            break;
        }
        break;

      case 'HOLDINGS':
        // Holdings data updated
        if (webhook_code === 'DEFAULT_UPDATE') {
          console.log('[Plaid Webhook] Holdings updated');
        }
        break;

      default:
        console.log('[Plaid Webhook] Unhandled webhook type:', webhook_type);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('[Plaid Webhook] Error:', error);
    return NextResponse.json({ received: true }, { status: 200 });
  }
}
