import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import prisma from '@/lib/db';
import {
  getInvestmentTransactions,
  decryptToken,
} from '@/lib/plaid';

// Sync investment transactions from Plaid
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { connectionId, startDate, endDate } = await request.json();

    if (!connectionId) {
      return NextResponse.json(
        { error: 'Connection ID is required' },
        { status: 400 }
      );
    }

    // Get the Plaid connection
    const connection = await prisma.plaidConnection.findUnique({
      where: { id: connectionId, userId: session.id },
      include: { accounts: true },
    });

    if (!connection) {
      return NextResponse.json(
        { error: 'Connection not found' },
        { status: 404 }
      );
    }

    const accessToken = decryptToken(connection.accessToken);

    // Default to last 30 days if no dates provided
    const end = endDate || new Date().toISOString().split('T')[0];
    const start = startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    // Get investment transactions from Plaid
    const transactionsResponse = await getInvestmentTransactions(
      accessToken,
      start,
      end
    );

    const importedTransactions = [];

    for (const tx of transactionsResponse.investment_transactions) {
      // Map Plaid transaction type to our types
      let type: 'BUY' | 'SELL' | 'DIVIDEND' = 'BUY';
      const txType = tx.type?.toLowerCase() || '';
      const txSubtype = tx.subtype?.toLowerCase() || '';

      if (txType === 'sell' || txSubtype.includes('sell')) {
        type = 'SELL';
      } else if (txType === 'dividend' || txSubtype.includes('dividend') || txSubtype.includes('income')) {
        type = 'DIVIDEND';
      }

      // Find the security info
      const security = transactionsResponse.securities.find(
        (s) => s.security_id === tx.security_id
      );

      const symbol = security?.ticker_symbol || tx.name || 'UNKNOWN';
      const quantity = Math.abs(tx.quantity || 0);
      const price = tx.price || 0;
      const amount = Math.abs(tx.amount || quantity * price);

      // Check for duplicate based on date, symbol, quantity, and amount
      const existingTx = await prisma.transaction.findFirst({
        where: {
          claimedById: session.id,
          date: new Date(tx.date),
          symbol: symbol.toUpperCase(),
          quantity,
          amount,
        },
      });

      if (!existingTx) {
        const transaction = await prisma.transaction.create({
          data: {
            claimedById: session.id,
            date: new Date(tx.date),
            type,
            symbol: symbol.toUpperCase(),
            description: tx.name || security?.name,
            quantity,
            price,
            amount,
            fees: tx.fees || 0,
            currency: tx.iso_currency_code || 'USD',
          },
        });
        importedTransactions.push(transaction);
      }
    }

    // Update last synced timestamp
    await prisma.plaidConnection.update({
      where: { id: connectionId },
      data: { lastSyncedAt: new Date() },
    });

    return NextResponse.json({
      success: true,
      imported: importedTransactions.length,
      total: transactionsResponse.investment_transactions.length,
      startDate: start,
      endDate: end,
    });
  } catch (error) {
    console.error('[Plaid Sync] Error:', error);
    return NextResponse.json(
      { error: 'Failed to sync transactions' },
      { status: 500 }
    );
  }
}

// GET - List all Plaid connections
export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const connections = await prisma.plaidConnection.findMany({
      where: { userId: session.id },
      include: {
        accounts: {
          select: {
            id: true,
            name: true,
            type: true,
            subtype: true,
            mask: true,
            isActive: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Don't expose access tokens
    const safeConnections = connections.map((conn) => ({
      id: conn.id,
      institutionName: conn.institutionName,
      institutionId: conn.institutionId,
      status: conn.status,
      lastSyncedAt: conn.lastSyncedAt,
      consentExpiresAt: conn.consentExpiresAt,
      accounts: conn.accounts,
      createdAt: conn.createdAt,
    }));

    return NextResponse.json({ connections: safeConnections });
  } catch (error) {
    console.error('[Plaid Connections] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch connections' },
      { status: 500 }
    );
  }
}

// DELETE - Remove a Plaid connection
export async function DELETE(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const connectionId = searchParams.get('connectionId');

    if (!connectionId) {
      return NextResponse.json(
        { error: 'Connection ID is required' },
        { status: 400 }
      );
    }

    const connection = await prisma.plaidConnection.findUnique({
      where: { id: connectionId, userId: session.id },
    });

    if (!connection) {
      return NextResponse.json(
        { error: 'Connection not found' },
        { status: 404 }
      );
    }

    // Delete the connection (cascade will delete accounts)
    await prisma.plaidConnection.delete({
      where: { id: connectionId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Plaid Delete] Error:', error);
    return NextResponse.json(
      { error: 'Failed to delete connection' },
      { status: 500 }
    );
  }
}
